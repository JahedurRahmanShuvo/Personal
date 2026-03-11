import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Database, 
  History, 
  Plus, 
  Search,
  ArrowLeft,
  Loader2,
  Phone,
  Trash2,
  Edit2,
  X,
  PlusCircle,
  QrCode,
  Package,
  ArrowRight,
  Maximize,
  Minimize
} from 'lucide-react';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// GP Blue Theme
const PRIMARY_COLOR = "bg-[#0055A4]";
const PRIMARY_TEXT = "text-[#0055A4]";
const PRIMARY_BORDER = "border-[#0055A4]";

interface SR {
  id: number;
  name: string;
  phone: string;
}

interface MasterProduct {
  id: number;
  product_name: string;
  total_received: number;
  total_issued: number;
  physical_balance: number;
  unit_price: number;
}

interface DistributionLog {
  id: number;
  date: string;
  sr_id: number;
  product_id: number;
  type: 'ISSUE' | 'RETURN';
  category: string;
  barcode_start: string;
  barcode_end: string;
  total_qty: number;
  serial_range_text: string;
  sr_name: string;
  product_name: string;
}

interface SRStock {
  product_id: number;
  product_name: string;
  total_qty: number;
  unit_price: number;
  serial_details: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'srs' | 'it' | 'logs' | 'reports'>('srs');
  const [selectedSR, setSelectedSR] = useState<SR | null>(null);
  const [srs, setSrs] = useState<SR[]>([]);
  const [inventory, setInventory] = useState<MasterProduct[]>([]);
  const [logs, setLogs] = useState<DistributionLog[]>([]);
  const [srStock, setSrStock] = useState<SRStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [srsRes, invRes, logsRes] = await Promise.all([
        fetch('/api/srs'),
        fetch('/api/inventory'),
        fetch('/api/distribution')
      ]);
      setSrs(await srsRes.json());
      setInventory(await invRes.json());
      setLogs(await logsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSRStock = async (srId: number) => {
    try {
      const res = await fetch(`/api/srs/${srId}/stock`);
      setSrStock(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedSR) {
      fetchSRStock(selectedSR.id);
    }
  }, [selectedSR]);

  const filteredSRs = srs.filter(sr => 
    sr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sr.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans pb-20">
      <header className={cn("text-white p-4 sticky top-0 z-10 shadow-md", PRIMARY_COLOR)}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            {selectedSR ? (
              <button onClick={() => setSelectedSR(null)} className="p-1 hover:bg-white/10 rounded-full">
                <ArrowLeft size={24} />
              </button>
            ) : (
              <h1 className="font-bold text-xl tracking-tight">GP Distribution</h1>
            )}
            {selectedSR && <h1 className="font-bold text-lg truncate max-w-[150px] sm:max-w-md">{selectedSR.name}</h1>}
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={toggleFullscreen} 
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title={isFullscreen ? "Exit Full Screen" : "Enter Full Screen"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            {loading && <Loader2 className="animate-spin" size={20} />}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {selectedSR ? (
          <SRProfile sr={selectedSR} stock={srStock} onRefresh={() => fetchSRStock(selectedSR.id)} />
        ) : (
          <>
            {activeTab !== 'reports' && (
              <div className="relative mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab === 'srs' ? 'SRs' : 'Logs'}...`}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            )}

            {activeTab === 'srs' && (
              <SRManager srs={filteredSRs} onSelect={setSelectedSR} onRefresh={fetchData} />
            )}
            {activeTab === 'it' && (
              <ITDashboard inventory={inventory} srs={srs} onRefresh={fetchData} />
            )}
            {activeTab === 'logs' && (
              <DistributionLogs 
                logs={logs.filter(l => l.sr_name.toLowerCase().includes(searchQuery.toLowerCase()) || l.product_name.toLowerCase().includes(searchQuery.toLowerCase()))} 
                onRefresh={fetchData}
              />
            )}
            {activeTab === 'reports' && (
              <ReportingModule />
            )}
          </>
        )}
      </main>

      {!selectedSR && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-7xl mx-auto flex justify-around p-3">
            <NavButton active={activeTab === 'srs'} onClick={() => setActiveTab('srs')} icon={<Users size={22} />} label="SRs" />
            <NavButton active={activeTab === 'it'} onClick={() => setActiveTab('it')} icon={<Database size={22} />} label="IT Master" />
            <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<History size={22} />} label="Logs" />
            <NavButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<History size={22} />} label="Reports" />
          </div>
        </nav>
      )}
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button onClick={onClick} className={cn("flex flex-col items-center gap-1 transition-all", active ? PRIMARY_TEXT : "text-gray-400")}>
      <div className={cn("p-1 rounded-xl transition-all", active && "bg-blue-50")}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
    </button>
  );
}

function SRManager({ srs, onSelect, onRefresh }: { srs: SR[], onSelect: (sr: SR) => void, onRefresh: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editingSR, setEditingSR] = useState<SR | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length !== 11 || !/^\d+$/.test(phone)) {
      alert("Mobile number must be exactly 11 digits.");
      return;
    }
    const url = editingSR ? `/api/srs/${editingSR.id}` : '/api/srs';
    const method = editingSR ? 'PUT' : 'POST';
    
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone })
    });
    
    if (res.ok) {
      resetForm();
      onRefresh();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('PERMANENTLY DELETE THIS SR? This action is absolute and will remove all associated distribution records. This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/srs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        onRefresh();
      } else {
        const err = await res.json();
        alert(`Delete failed: ${err.error}`);
      }
    } catch (err) {
      alert('Network error during deletion.');
    }
  };

  const resetForm = () => {
    setName(''); setPhone(''); setEditingSR(null); setShowForm(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">SR Profiles</h2>
        <button onClick={() => setShowForm(true)} className={cn("text-white p-2 rounded-full shadow-lg", PRIMARY_COLOR)}>
          <Plus size={20} />
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSubmit} className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingSR ? 'Edit SR' : 'Add New SR'}</h3>
              <button type="button" onClick={resetForm} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">SR Name</label>
                <input required value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="Full Name" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Mobile Number</label>
                <input 
                  required 
                  type="tel"
                  maxLength={11}
                  value={phone} 
                  onChange={e => setPhone(e.target.value.replace(/\D/g, ''))} 
                  className="w-full bg-gray-50 border rounded-xl p-3 text-sm" 
                  placeholder="Enter 11-digit GP number" 
                />
                <p className="text-[9px] text-gray-400 italic">Example: 017XXXXXXXX</p>
              </div>
            </div>
            <button type="submit" className={cn("w-full text-white py-4 rounded-2xl font-bold", PRIMARY_COLOR)}>
              {editingSR ? 'Update' : 'Save'}
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {srs.map(sr => (
          <div key={sr.id} className="tally-card p-4 flex items-center justify-between group">
            <button 
              onClick={() => onSelect(sr)} 
              className="flex items-center gap-4 flex-1 text-left min-w-0"
            >
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white font-bold text-lg shrink-0", PRIMARY_COLOR)}>
                {sr.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-gray-900 truncate">{sr.name}</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 truncate">
                  <Phone size={12} /> {sr.phone}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => { setEditingSR(sr); setName(sr.name); setPhone(sr.phone); setShowForm(true); }} className="p-2 text-gray-400 hover:text-blue-600"><Edit2 size={18} /></button>
              <button onClick={() => handleDelete(sr.id)} className="p-2 text-gray-400 hover:text-red-500"><Trash2 size={18} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ITDashboard({ inventory, srs, onRefresh }: { inventory: MasterProduct[], srs: SR[], onRefresh: () => void }) {
  const [showAddStock, setShowAddStock] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustType, setAdjustType] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [showIssueStock, setShowIssueStock] = useState(false);
  const [editingProduct, setEditingProduct] = useState<MasterProduct | null>(null);
  const [productName, setProductName] = useState('');
  const [qty, setQty] = useState('');
  const [unitPrice, setUnitPrice] = useState('');

  const [issueData, setIssueData] = useState({
    sr_id: '',
    product_id: '',
    category: 'Others',
    barcode_start: '',
    barcode_end: ''
  });

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct ? `/api/inventory/${editingProduct.id}` : '/api/inventory';
    const method = editingProduct ? 'PUT' : 'POST';
    
    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        product_name: productName, 
        total_received: parseInt(qty),
        unit_price: parseFloat(unitPrice)
      })
    });
    setProductName(''); setQty(''); setUnitPrice(''); setShowAddStock(false); setEditingProduct(null);
    onRefresh();
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    const adjustment = adjustType === 'ADD' ? parseInt(qty) : -parseInt(qty);
    
    await fetch('/api/inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        product_name: editingProduct.product_name, 
        total_received: adjustment,
        unit_price: editingProduct.unit_price
      })
    });
    setQty(''); setShowAdjust(false); setEditingProduct(null);
    onRefresh();
  };

  const handleIssueStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = parseInt(issueData.barcode_start);
    const end = parseInt(issueData.barcode_end);
    const total_qty = end - start + 1;

    if (isNaN(total_qty) || total_qty <= 0) {
      alert("Invalid Barcode Range");
      return;
    }

    // Generate serial range text
    const serials = [];
    for (let i = start; i <= end; i++) {
      serials.push(i);
    }
    const serial_range_text = serials.join(', ');

    const res = await fetch('/api/distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sr_id: parseInt(issueData.sr_id),
        product_id: parseInt(issueData.product_id),
        category: issueData.category,
        barcode_start: issueData.barcode_start,
        barcode_end: issueData.barcode_end,
        total_qty,
        serial_range_text
      })
    });

    if (res.ok) {
      setIssueData({ sr_id: '', product_id: '', category: 'Others', barcode_start: '', barcode_end: '' });
      setShowIssueStock(false);
      onRefresh();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  const handleDeleteProduct = async (id: number) => {
    if (!confirm('Delete this product? All its distribution history will be removed.')) return;
    await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button onClick={() => setShowAddStock(true)} className={cn("flex-1 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg", PRIMARY_COLOR)}>
          <PlusCircle size={20} /> Add Master Stock
        </button>
        <button onClick={() => setShowIssueStock(true)} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg">
          <ArrowRight size={20} /> Issue to SR
        </button>
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">IT Physical Balance</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {inventory.map(item => (
            <div key={item.id} className="tally-card p-5 relative group overflow-hidden">
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <div className="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide whitespace-nowrap">
                  ৳{(item.physical_balance * item.unit_price).toLocaleString()}
                </div>
                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur-sm rounded-lg ml-1">
                  <button 
                    onClick={() => {
                      setEditingProduct(item);
                      setQty('');
                      setAdjustType('ADD');
                      setShowAdjust(true);
                    }}
                    title="Adjust Stock"
                    className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                  >
                    <Plus size={16} />
                  </button>
                  <button 
                    onClick={() => {
                      setEditingProduct(item);
                      setProductName(item.product_name);
                      setQty(item.total_received.toString());
                      setUnitPrice(item.unit_price.toString());
                      setShowAddStock(true);
                    }}
                    title="Edit Product"
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(item.id)}
                    title="Delete Product"
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-start gap-3 mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold text-base sm:text-lg leading-tight break-words pr-2">{item.product_name}</h3>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Price: <span className="text-gray-600">৳{item.unit_price.toLocaleString()}</span></p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-bold text-blue-600 leading-none tabular-nums">{item.physical_balance.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">Stock</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate tabular-nums">{item.total_received.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Received</p>
                </div>
                <div className="min-w-0 text-right">
                  <p className="text-sm font-bold truncate tabular-nums">{item.total_issued.toLocaleString()}</p>
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Issued</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAddStock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddStock} className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">{editingProduct ? 'Edit Master Product' : 'Receive Master Stock'}</h3>
              <button type="button" onClick={() => { setShowAddStock(false); setEditingProduct(null); setProductName(''); setQty(''); setUnitPrice(''); }} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Product Name</label>
                <input required value={productName} onChange={e => setProductName(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="e.g. GP 4G SIM" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">{editingProduct ? 'Total Received' : 'Qty Received'}</label>
                  <input required type="number" value={qty} onChange={e => setQty(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="0" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Unit Price (৳)</label>
                  <input required type="number" step="0.01" value={unitPrice} onChange={e => setUnitPrice(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="0.00" />
                </div>
              </div>
            </div>
            <button type="submit" className={cn("w-full text-white py-4 rounded-2xl font-bold", PRIMARY_COLOR)}>
              {editingProduct ? 'Update Master Record' : 'Save to Master'}
            </button>
          </form>
        </div>
      )}

      {showAdjust && editingProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAdjust} className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Adjust Stock</h3>
                <p className="text-xs text-gray-500 truncate max-w-[200px]">{editingProduct.product_name}</p>
              </div>
              <button type="button" onClick={() => { setShowAdjust(false); setEditingProduct(null); setQty(''); }} className="text-gray-400"><X size={24} /></button>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setAdjustType('ADD')}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", adjustType === 'ADD' ? "bg-white shadow-sm text-blue-600" : "text-gray-500")}
              >
                ADD (+)
              </button>
              <button 
                type="button"
                onClick={() => setAdjustType('DEDUCT')}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", adjustType === 'DEDUCT' ? "bg-white shadow-sm text-red-600" : "text-gray-500")}
              >
                DEDUCT (-)
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity to {adjustType === 'ADD' ? 'Add' : 'Deduct'}</label>
              <input 
                required 
                type="number" 
                autoFocus
                value={qty} 
                onChange={e => setQty(e.target.value)} 
                className="w-full bg-gray-50 border rounded-xl p-4 text-xl font-bold text-center" 
                placeholder="0" 
              />
            </div>
            <button type="submit" className={cn("w-full text-white py-4 rounded-2xl font-bold shadow-lg", adjustType === 'ADD' ? PRIMARY_COLOR : "bg-red-600")}>
              Confirm {adjustType === 'ADD' ? 'Addition' : 'Deduction'}
            </button>
          </form>
        </div>
      )}

      {showIssueStock && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={handleIssueStock} className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl my-auto">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-lg">Issue Stock to SR</h3>
              <button type="button" onClick={() => setShowIssueStock(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            <div className="space-y-3">
              <select required value={issueData.sr_id} onChange={e => setIssueData(p => ({ ...p, sr_id: e.target.value }))} className="w-full bg-gray-50 border rounded-xl p-3 text-sm">
                <option value="">Select SR...</option>
                {srs.map(sr => <option key={sr.id} value={sr.id}>{sr.name}</option>)}
              </select>
              <select required value={issueData.product_id} onChange={e => setIssueData(p => ({ ...p, product_id: e.target.value }))} className="w-full bg-gray-50 border rounded-xl p-3 text-sm">
                <option value="">Select Product...</option>
                {inventory.map(item => <option key={item.id} value={item.id}>{item.product_name} (Bal: {item.physical_balance})</option>)}
              </select>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Issue Category</label>
                <select required value={issueData.category} onChange={e => setIssueData(p => ({ ...p, category: e.target.value }))} className="w-full bg-gray-50 border rounded-xl p-3 text-sm">
                  <option value="SE">SE (Sales Executive)</option>
                  <option value="BP">BP (Brand Promoter)</option>
                  <option value="ME">ME (Market Executive)</option>
                  <option value="Others">Others</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">Start Barcode</label>
                  <input required value={issueData.barcode_start} onChange={e => setIssueData(p => ({ ...p, barcode_start: e.target.value }))} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="e.g. 1001" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-gray-400 uppercase">End Barcode</label>
                  <input required value={issueData.barcode_end} onChange={e => setIssueData(p => ({ ...p, barcode_end: e.target.value }))} className="w-full bg-gray-50 border rounded-xl p-3 text-sm" placeholder="e.g. 1050" />
                </div>
              </div>
              {issueData.barcode_start && issueData.barcode_end && (
                <div className="bg-blue-50 p-3 rounded-xl text-center">
                  <p className="text-xs font-bold text-blue-600 uppercase">Total Quantity</p>
                  <p className="text-xl font-bold text-blue-900">{parseInt(issueData.barcode_end) - parseInt(issueData.barcode_start) + 1 || 0}</p>
                </div>
              )}
            </div>
            <button type="submit" className={cn("w-full text-white py-4 rounded-2xl font-bold", PRIMARY_COLOR)}>Confirm Distribution</button>
          </form>
        </div>
      )}
    </div>
  );
}

function SRProfile({ sr, stock, onRefresh }: { sr: SR, stock: SRStock[], onRefresh: () => void }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [showAdjust, setShowAdjust] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<SRStock | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustType, setAdjustType] = useState<'ISSUE' | 'RETURN'>('ISSUE');

  const totalStockValue = stock.reduce((acc, item) => acc + (item.total_qty * item.unit_price), 0);

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const res = await fetch('/api/distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sr_id: sr.id,
        product_id: selectedProduct.product_id,
        total_qty: parseInt(adjustQty),
        type: adjustType,
        barcode_start: 'MANUAL',
        barcode_end: 'MANUAL',
        serial_range_text: `Manual ${adjustType === 'ISSUE' ? 'Addition' : 'Deduction'}`
      })
    });

    if (res.ok) {
      setShowAdjust(false);
      setAdjustQty('');
      onRefresh();
    } else {
      const err = await res.json();
      alert(err.error);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4">
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <div className={cn("w-14 h-14 rounded-3xl flex items-center justify-center text-white font-bold text-xl shadow-lg shrink-0", PRIMARY_COLOR)}>
              {sr.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-bold tracking-tight truncate">{sr.name}</h2>
              <p className="text-sm text-gray-500 flex items-center gap-1 truncate"><Phone size={14} /> {sr.phone}</p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2 whitespace-nowrap">
              ৳{totalStockValue.toLocaleString()}
            </div>
            <button 
              onClick={() => {
                if (stock.length > 0) {
                  setSelectedProduct(stock[0]);
                  setShowAdjust(true);
                } else {
                  alert("No products currently held by this SR. Issue stock from IT Master first.");
                }
              }}
              className={cn("p-3 rounded-2xl text-white shadow-md inline-block transition-transform active:scale-95", PRIMARY_COLOR)}
            >
              <PlusCircle size={24} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b pb-2">Live Stock Inventory</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {stock.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm italic col-span-full">No stock assigned to this SR yet.</p>
            ) : (
              stock.map((item, i) => (
              <div key={i} className="p-4 bg-gray-50 rounded-2xl space-y-2">
                <div className="flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 leading-tight break-words text-sm">{item.product_name}</p>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                      <p className="text-[9px] text-gray-400 font-medium uppercase">Price: <span className="text-gray-600 font-bold">৳{item.unit_price.toLocaleString()}</span></p>
                      <p className="text-[9px] text-gray-400 font-medium uppercase">Value: <span className="text-emerald-600 font-bold">৳{(item.total_qty * item.unit_price).toLocaleString()}</span></p>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedProduct(item);
                        setShowAdjust(true);
                      }}
                      className="text-[9px] font-bold text-blue-600 uppercase mt-2 flex items-center gap-1 hover:underline"
                    >
                      <Edit2 size={10} /> Quick Adjust
                    </button>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xl font-bold text-blue-600 leading-none tabular-nums">{item.total_qty.toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider mt-1">Qty Held</p>
                  </div>
                </div>
                {item.total_qty > 0 && (
                  <div className="pt-2 border-t border-gray-200">
                    <button 
                      onClick={() => setExpandedIndex(expandedIndex === i ? null : i)}
                      className="flex items-center gap-1 text-[10px] font-bold text-blue-600 uppercase hover:underline"
                    >
                      {expandedIndex === i ? 'Hide Details' : 'View Details'}
                    </button>
                    {expandedIndex === i && (
                      <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Serial Numbers</p>
                        <p className="text-[10px] text-gray-600 break-all leading-relaxed bg-white p-2 rounded-lg border border-gray-100">
                          {item.serial_details}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          </div>
        </div>
      </div>

      {showAdjust && selectedProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAdjust} className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Adjust Stock</h3>
                <p className="text-xs text-gray-500">{selectedProduct.product_name}</p>
              </div>
              <button type="button" onClick={() => setShowAdjust(false)} className="text-gray-400"><X size={24} /></button>
            </div>
            
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button 
                type="button"
                onClick={() => setAdjustType('ISSUE')}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", adjustType === 'ISSUE' ? "bg-white shadow-sm text-blue-600" : "text-gray-500")}
              >
                ADD (+)
              </button>
              <button 
                type="button"
                onClick={() => setAdjustType('RETURN')}
                className={cn("flex-1 py-2 rounded-lg text-xs font-bold transition-all", adjustType === 'RETURN' ? "bg-white shadow-sm text-red-600" : "text-gray-500")}
              >
                DEDUCT (-)
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase">Quantity to {adjustType === 'ISSUE' ? 'Add' : 'Deduct'}</label>
                <input 
                  required 
                  type="number" 
                  value={adjustQty} 
                  onChange={e => setAdjustQty(e.target.value)} 
                  className="w-full bg-gray-50 border rounded-xl p-4 text-xl font-bold text-center" 
                  placeholder="0"
                  autoFocus
                />
              </div>
            </div>

            <button type="submit" className={cn("w-full text-white py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95", adjustType === 'ISSUE' ? PRIMARY_COLOR : "bg-red-600")}>
              Confirm {adjustType === 'ISSUE' ? 'Addition' : 'Deduction'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function DistributionLogs({ logs, onRefresh }: { logs: DistributionLog[], onRefresh: () => void }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const dailyLogs = logs.filter(log => format(new Date(log.date), 'yyyy-MM-dd') === today);

  const handleDeleteLog = async (id: number) => {
    if (!confirm('Delete this distribution entry? Quantity will be restored to IT Master Stock.')) return;
    await fetch(`/api/distribution/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Today's Logs</h2>
        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{format(new Date(), 'MMMM d, yyyy')}</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {dailyLogs.length === 0 ? (
          <div className="tally-card p-8 text-center col-span-full">
            <p className="text-gray-400 text-sm italic">No distribution entries recorded for today.</p>
          </div>
        ) : (
          dailyLogs.map(log => (
            <div key={log.id} className="tally-card p-4 relative group overflow-hidden">
              <button 
                onClick={() => handleDeleteLog(log.id)}
                className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 bg-white/80 backdrop-blur-sm rounded-lg"
              >
                <Trash2 size={16} />
              </button>
              <div className="flex justify-between items-start gap-3 mb-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-sm leading-tight break-words pr-8">{log.product_name}</p>
                  <p className="text-[11px] text-gray-500 mt-1 truncate">Issued to: <span className="font-bold text-gray-700">{log.sr_name}</span></p>
                  <span className="inline-block mt-2 px-2 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-bold rounded-md uppercase tracking-wider">
                    {log.category}
                  </span>
                </div>
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider shrink-0 tabular-nums">{format(new Date(log.date), 'MMM d, hh:mm a')}</p>
              </div>
              <div className="flex items-center gap-2 mt-3 p-3 bg-gray-50 rounded-xl overflow-hidden">
                <QrCode size={14} className="text-gray-400 shrink-0" />
                <p className="text-[10px] font-mono text-gray-600 truncate">
                  Range: {log.barcode_start} - {log.barcode_end} ({log.total_qty} units)
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ReportingModule() {
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [category, setCategory] = useState('');
  const [reportLogs, setReportLogs] = useState<DistributionLog[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const url = new URL('/api/distribution', window.location.origin);
      url.searchParams.append('start_date', startDate);
      url.searchParams.append('end_date', endDate);
      if (category) url.searchParams.append('category', category);
      
      const res = await fetch(url.toString());
      setReportLogs(await res.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    if (reportLogs.length === 0) return;
    
    const headers = ['Date', 'SR Name', 'Product Name', 'Category', 'Start Barcode', 'End Barcode', 'Quantity', 'Serials'];
    const rows = reportLogs.map(log => [
      format(new Date(log.date), 'yyyy-MM-dd hh:mm a'),
      log.sr_name,
      log.product_name,
      log.category,
      log.barcode_start,
      log.barcode_end,
      log.total_qty,
      `"${log.serial_range_text}"`
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `GP_Distribution_Report_${startDate}_to_${endDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-[2rem] border border-gray-100 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Generate Report</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">Start Date</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-gray-50 border rounded-xl p-3 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase">End Date</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-gray-50 border rounded-xl p-3 text-sm"
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-gray-400 uppercase">Category Filter</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-50 border rounded-xl p-3 text-sm">
            <option value="">All Categories</option>
            <option value="SE">SE (Sales Executive)</option>
            <option value="BP">BP (Brand Promoter)</option>
            <option value="ME">ME (Market Executive)</option>
            <option value="Others">Others</option>
          </select>
        </div>
        <button 
          onClick={fetchReport}
          className={cn("w-full text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2", PRIMARY_COLOR)}
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
          Filter Data
        </button>
      </div>

      {reportLogs.length > 0 && (
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Filtered Results ({reportLogs.length})</h3>
            <button 
              onClick={downloadCSV}
              className="text-xs font-bold text-blue-600 uppercase flex items-center gap-1 hover:underline"
            >
              Download CSV
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {reportLogs.map(log => (
              <div key={log.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-sm">{log.product_name}</p>
                    <p className="text-xs text-gray-500">SR: {log.sr_name}</p>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">{format(new Date(log.date), 'MMM d, hh:mm a')}</p>
                </div>
                <p className="text-[10px] text-gray-400 mt-2">Qty: {log.total_qty} | Range: {log.barcode_start}-{log.barcode_end}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
