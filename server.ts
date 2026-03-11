import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database("inventory.db");
db.pragma('foreign_keys = ON');

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS sr_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS master_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_name TEXT NOT NULL UNIQUE,
    total_received INTEGER DEFAULT 0,
    unit_price REAL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS distribution_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    sr_id INTEGER,
    product_id INTEGER,
    type TEXT DEFAULT 'ISSUE', -- 'ISSUE' or 'RETURN'
    category TEXT DEFAULT 'Others', -- 'SE', 'BP', 'ME', 'Others'
    barcode_start TEXT,
    barcode_end TEXT,
    total_qty INTEGER,
    serial_range_text TEXT,
    FOREIGN KEY(sr_id) REFERENCES sr_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES master_inventory(id) ON DELETE CASCADE
  );
`);

// Migration: Add 'type' and 'category' columns if they don't exist
try {
  db.prepare("ALTER TABLE distribution_log ADD COLUMN type TEXT DEFAULT 'ISSUE'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE distribution_log ADD COLUMN category TEXT DEFAULT 'Others'").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE master_inventory ADD COLUMN unit_price REAL DEFAULT 0").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // SR Profiles CRUD
  app.get("/api/srs", (req, res) => {
    const srs = db.prepare("SELECT * FROM sr_profiles").all();
    res.json(srs);
  });

  app.post("/api/srs", (req, res) => {
    const { name, phone } = req.body;
    if (!phone || phone.length !== 11 || !/^\d+$/.test(phone)) {
      return res.status(400).json({ error: "Mobile number must be exactly 11 digits." });
    }
    try {
      db.prepare("INSERT INTO sr_profiles (name, phone) VALUES (?, ?)").run(name, phone);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/srs/:id", (req, res) => {
    const { name, phone } = req.body;
    if (!phone || phone.length !== 11 || !/^\d+$/.test(phone)) {
      return res.status(400).json({ error: "Mobile number must be exactly 11 digits." });
    }
    try {
      db.prepare("UPDATE sr_profiles SET name = ?, phone = ? WHERE id = ?").run(name, phone, req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/srs/:id", (req, res) => {
    try {
      // Use a transaction for absolute deletion
      const deleteLogs = db.prepare("DELETE FROM distribution_log WHERE sr_id = ?");
      const deleteSR = db.prepare("DELETE FROM sr_profiles WHERE id = ?");
      
      const transaction = db.transaction((id) => {
        deleteLogs.run(id);
        deleteSR.run(id);
      });
      
      transaction(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Master Inventory CRUD
  app.get("/api/inventory", (req, res) => {
    const products = db.prepare(`
      SELECT 
        m.*,
        COALESCE((SELECT SUM(CASE WHEN type = 'ISSUE' THEN total_qty ELSE -total_qty END) FROM distribution_log WHERE product_id = m.id), 0) as total_issued,
        (m.total_received - COALESCE((SELECT SUM(CASE WHEN type = 'ISSUE' THEN total_qty ELSE -total_qty END) FROM distribution_log WHERE product_id = m.id), 0)) as physical_balance
      FROM master_inventory m
    `).all();
    res.json(products);
  });

  app.post("/api/inventory", (req, res) => {
    const { product_name, total_received, unit_price } = req.body;
    try {
      const existing = db.prepare("SELECT * FROM master_inventory WHERE product_name = ?").get(product_name) as any;
      if (existing) {
        const newTotal = existing.total_received + total_received;
        db.prepare("UPDATE master_inventory SET total_received = ?, unit_price = ? WHERE id = ?").run(newTotal, unit_price || existing.unit_price, existing.id);
        
        // Forced Clear Logic: If master quantity reaches zero, wipe all serials for this product
        if (newTotal <= 0) {
          db.prepare("UPDATE distribution_log SET barcode_start = '', barcode_end = '', serial_range_text = '', total_qty = 0 WHERE product_id = ?").run(existing.id);
        }
      } else {
        db.prepare("INSERT INTO master_inventory (product_name, total_received, unit_price) VALUES (?, ?, ?)").run(product_name, total_received, unit_price || 0);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.put("/api/inventory/:id", (req, res) => {
    const { product_name, total_received, unit_price } = req.body;
    try {
      db.prepare("UPDATE master_inventory SET product_name = ?, total_received = ?, unit_price = ? WHERE id = ?")
        .run(product_name, total_received, unit_price, req.params.id);
      
      // Forced Clear Logic: If master quantity reaches zero, wipe all serials for this product
      if (parseInt(total_received) <= 0) {
        db.prepare("UPDATE distribution_log SET barcode_start = '', barcode_end = '', serial_range_text = '', total_qty = 0 WHERE product_id = ?").run(req.params.id);
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/inventory/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM master_inventory WHERE id = ?").run(req.params.id);
      db.prepare("DELETE FROM distribution_log WHERE product_id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  // Distribution Log
  app.post("/api/distribution", (req, res) => {
    const { sr_id, product_id, barcode_start, barcode_end, total_qty, serial_range_text, type = 'ISSUE', category = 'Others' } = req.body;
    try {
      if (type === 'ISSUE') {
        // Check if IT has enough stock
        const product = db.prepare(`
          SELECT (total_received - COALESCE((SELECT SUM(CASE WHEN type = 'ISSUE' THEN total_qty ELSE -total_qty END) FROM distribution_log WHERE product_id = master_inventory.id), 0)) as balance 
          FROM master_inventory WHERE id = ?
        `).get(product_id) as { balance: number };

        if (product.balance < total_qty) {
          return res.status(400).json({ error: "Insufficient IT Master Stock" });
        }
      }

      db.prepare(`
        INSERT INTO distribution_log (sr_id, product_id, barcode_start, barcode_end, total_qty, serial_range_text, type, category) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(sr_id, product_id, barcode_start, barcode_end, total_qty, serial_range_text, type, category);
      
      // Forced Clear Logic: If SR's balance for this product reaches zero, wipe their serial history for this product
      const srBalance = db.prepare(`
        SELECT SUM(CASE WHEN type = 'ISSUE' THEN total_qty ELSE -total_qty END) as qty
        FROM distribution_log WHERE sr_id = ? AND product_id = ?
      `).get(sr_id, product_id) as { qty: number };

      if (srBalance && srBalance.qty <= 0) {
        db.prepare(`
          UPDATE distribution_log 
          SET barcode_start = '', barcode_end = '', serial_range_text = '', total_qty = 0 
          WHERE sr_id = ? AND product_id = ?
        `).run(sr_id, product_id);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.delete("/api/distribution/:id", (req, res) => {
    try {
      const log = db.prepare("SELECT sr_id, product_id FROM distribution_log WHERE id = ?").get(req.params.id) as { sr_id: number, product_id: number };
      db.prepare("DELETE FROM distribution_log WHERE id = ?").run(req.params.id);
      
      // Re-check balance after deletion to ensure UI consistency
      if (log) {
        const srBalance = db.prepare(`
          SELECT SUM(CASE WHEN type = 'ISSUE' THEN total_qty ELSE -total_qty END) as qty
          FROM distribution_log WHERE sr_id = ? AND product_id = ?
        `).get(log.sr_id, log.product_id) as { qty: number };

        if (srBalance && srBalance.qty <= 0) {
          db.prepare(`
            UPDATE distribution_log 
            SET barcode_start = '', barcode_end = '', serial_range_text = '', total_qty = 0 
            WHERE sr_id = ? AND product_id = ?
          `).run(log.sr_id, log.product_id);
        }
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  app.get("/api/distribution", (req, res) => {
    const { start_date, end_date, category } = req.query;
    let query = `
      SELECT d.*, s.name as sr_name, m.product_name 
      FROM distribution_log d
      JOIN sr_profiles s ON d.sr_id = s.id
      JOIN master_inventory m ON d.product_id = m.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (start_date && end_date) {
      query += ` AND d.date BETWEEN ? AND ?`;
      params.push(`${start_date} 00:00:00`, `${end_date} 23:59:59`);
    }

    if (category) {
      query += ` AND d.category = ?`;
      params.push(category);
    }

    query += ` ORDER BY d.date DESC`;
    
    const logs = db.prepare(query).all(...params);
    res.json(logs);
  });

  app.get("/api/srs/:id/stock", (req, res) => {
    const srId = req.params.id;
    const stock = db.prepare(`
      SELECT 
        m.product_name,
        m.id as product_id,
        m.unit_price,
        SUM(CASE WHEN d.type = 'ISSUE' THEN d.total_qty ELSE -d.total_qty END) as total_qty,
        GROUP_CONCAT(CASE WHEN date(d.date) = date('now') THEN d.serial_range_text ELSE NULL END, '; ') as serial_details
      FROM distribution_log d
      JOIN master_inventory m ON d.product_id = m.id
      WHERE d.sr_id = ?
      GROUP BY m.id
      HAVING total_qty > 0
    `).all(srId);
    res.json(stock);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
