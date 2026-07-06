/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  X, 
  Coins, 
  User, 
  Phone, 
  Plus, 
  Banknote, 
  Check, 
  Camera, 
  ScanLine, 
  Search,
  CheckCircle2,
  DollarSign
} from 'lucide-react';
import { Customer, Supplier, Product } from '../types';

// ==========================================
// EXPENSES MODAL
// ==========================================
interface ExpensesModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'info') => void;
}

export function ExpensesModal({ isOpen, onClose, showToast }: ExpensesModalProps) {
  const [expenses, setExpenses] = useState([
    { id: '1', title: 'إيجار المحل لشهر يوليو', amount: 3500, date: '2026-07-01', category: 'إيجارات' },
    { id: '2', title: 'فاتورة الكهرباء والمياه', amount: 840, date: '2026-07-03', category: 'مرافق' },
    { id: '3', title: 'رواتب العمال والمساعدة', amount: 6000, date: '2026-07-05', category: 'رواتب' },
  ]);

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('مرافق');

  if (!isOpen) return null;

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amount) return;

    const newExpense = {
      id: Date.now().toString(),
      title,
      amount: parseFloat(amount),
      date: new Date().toISOString().split('T')[0],
      category
    };

    setExpenses(prev => [newExpense, ...prev]);
    setTitle('');
    setAmount('');
    showToast(`تم تسجيل نفقة "${newExpense.title}" بقيمة ${newExpense.amount} ج.م`, 'success');
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85%] animate-in zoom-in-95 duration-200">
        
        <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <Banknote className="w-5 h-5 text-teal-200" />
            النفقات والمصاريف التشغيلية
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Quick Summary Card */}
          <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100 flex justify-between items-center text-[#0F172A]">
            <span className="text-xs font-bold text-orange-800">إجمالي نفقات الشهر الجاري:</span>
            <span className="text-base font-black text-orange-950">{totalExpenses.toLocaleString('ar-EG')} ج.م</span>
          </div>

          {/* Add Expense Form */}
          <form onSubmit={handleSubmit} className="bg-slate-50 rounded-2xl p-4 border border-slate-200/50 space-y-3">
            <h4 className="text-xs font-bold text-slate-500">تسجيل نفقة جديدة</h4>
            
            <div>
              <input
                type="text"
                required
                placeholder="البيان (مثال: فاتورة الغاز، صيانة رفوف)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                required
                placeholder="المبلغ (ج.م)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
              >
                <option value="مرافق">مرافق عامة</option>
                <option value="إيجارات">إيجارات</option>
                <option value="رواتب">رواتب وأجور</option>
                <option value="صيانة">صيانة وأعطال</option>
              </select>
            </div>

            <button type="submit" className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer">
              حفظ وتنزيل المصروف
            </button>
          </form>

          {/* Expense Log List */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400">سجل المصروفات المباشر</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-0.5">
              {expenses.map((e) => (
                <div key={e.id} className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center text-xs">
                  <div>
                    <div className="font-bold text-slate-800">{e.title}</div>
                    <div className="text-[10px] text-slate-400">{e.date} · {e.category}</div>
                  </div>
                  <span className="font-extrabold text-rose-600">-{e.amount} ج.م</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}


// ==========================================
// CUSTOMERS MODAL
// ==========================================
interface CustomersModalProps {
  isOpen: boolean;
  onClose: () => void;
  customers: Customer[];
  onCollectDebt: (customerId: string, amount: number) => void;
  showToast: (msg: string, type: 'success' | 'info') => void;
}

export function CustomersModal({ isOpen, onClose, customers, onCollectDebt, showToast }: CustomersModalProps) {
  const [selectedCust, setSelectedCust] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = customers.filter(c => c.name.includes(search));

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCust || !payAmount) return;

    const amt = parseFloat(payAmount);
    if (amt > selectedCust.debt) {
      showToast('المبلغ المدفوع يتجاوز الدين المستحق على هذا الزبون!', 'info');
      return;
    }

    onCollectDebt(selectedCust.id, amt);
    setPayAmount('');
    setSelectedCust(null);
    showToast(`تم تحصيل مبلغ ${amt.toLocaleString('ar-EG')} ج.م من الزبون بنجاح وتقليص ديونه!`, 'success');
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85%] animate-in zoom-in-95 duration-200">
        
        <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <User className="w-5 h-5 text-teal-200" />
            دليل الزبائن والديون الآجلة
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن زبون بالاسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 pl-4 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#0E7569] text-right"
            />
          </div>

          {/* Pay debt sub-form inline */}
          {selectedCust && (
            <form onSubmit={handlePaySubmit} className="bg-teal-50 border border-teal-200/60 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-3 duration-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#0E7569]">تسجيل دفعة من: {selectedCust.name}</span>
                <button type="button" onClick={() => setSelectedCust(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500">الدين الإجمالي المطلوب: {selectedCust.debt.toLocaleString('ar-EG')} ج.م</div>
              
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  placeholder="المبلغ المحصل (ج.م)"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                />
                <button type="submit" className="bg-[#0E7569] hover:bg-[#08483F] text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer">
                  تحصيل
                </button>
              </div>
            </form>
          )}

          {/* Customer list */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
            {filtered.map((c) => (
              <div key={c.id} className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-800">{c.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-300" />
                    <span>{c.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    c.debt > 0 ? 'bg-amber-50 text-amber-700 border border-amber-100' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {c.debt > 0 ? `${c.debt.toLocaleString('ar-EG')} ج.م` : 'بدون ديون'}
                  </span>
                  
                  {c.debt > 0 && !selectedCust && (
                    <button
                      type="button"
                      onClick={() => setSelectedCust(c)}
                      className="text-xs text-[#0E7569] font-bold bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      تسديد
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}


// ==========================================
// SUPPLIERS MODAL
// ==========================================
interface SuppliersModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onPaySupplier: (supplierId: string, amount: number) => void;
  showToast: (msg: string, type: 'success' | 'info') => void;
}

export function SuppliersModal({ isOpen, onClose, suppliers, onPaySupplier, showToast }) {
  const [selectedSupp, setSelectedSupp] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const filtered = suppliers.filter(s => s.name.includes(search));

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupp || !payAmount) return;

    const amt = parseFloat(payAmount);
    if (amt > selectedSupp.debt) {
      showToast('المبلغ المدفوع يتجاوز الرصيد المستحق لهذا المورد!', 'info');
      return;
    }

    onPaySupplier(selectedSupp.id, amt);
    setPayAmount('');
    setSelectedSupp(null);
    showToast(`تم سداد مبلغ ${amt.toLocaleString('ar-EG')} ج.م للمورد وتقليص الالتزامات بنجاح!`, 'success');
  };

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[85%] animate-in zoom-in-95 duration-200">
        
        <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <User className="w-5 h-5 text-teal-200" />
            دليل الموردين والحسابات الدائنة
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث عن مورد بالاسم..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 pl-4 pr-9 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#0E7569] text-right"
            />
          </div>

          {/* Pay supplier form */}
          {selectedSupp && (
            <form onSubmit={handlePaySubmit} className="bg-teal-50 border border-teal-200/60 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-3 duration-200">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-[#0E7569]">تسجيل دفعة للمورد: {selectedSupp.name}</span>
                <button type="button" onClick={() => setSelectedSupp(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="text-[10px] text-slate-500">مجموع مستحقات المورد: {selectedSupp.debt.toLocaleString('ar-EG')} ج.م</div>
              
              <div className="flex gap-2">
                <input
                  type="number"
                  required
                  placeholder="المبلغ المسدد (ج.م)"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                />
                <button type="submit" className="bg-[#0E7569] hover:bg-[#08483F] text-white px-4 py-2 rounded-xl text-xs font-bold shrink-0 cursor-pointer">
                  سداد
                </button>
              </div>
            </form>
          )}

          {/* Suppliers list */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
            {filtered.map((s) => (
              <div key={s.id} className="bg-white rounded-xl p-3 border border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <div className="font-bold text-slate-800">{s.name}</div>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-slate-300" />
                    <span>{s.phone}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                    s.debt > 0 ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-slate-50 text-slate-400'
                  }`}>
                    {s.debt > 0 ? `${s.debt.toLocaleString('ar-EG')} ج.م` : 'خالص بالكامل'}
                  </span>
                  
                  {s.debt > 0 && !selectedSupp && (
                    <button
                      type="button"
                      onClick={() => setSelectedSupp(s)}
                      className="text-xs text-[#0E7569] font-bold bg-teal-50 hover:bg-teal-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                    >
                      سداد دائن
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
}


// ==========================================
// MOCK BARCODE SCANNER MODAL
// ==========================================
interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectScannedProduct: (p: Product) => void;
  showToast: (msg: string, type: 'success' | 'info') => void;
}

export function ScannerModal({ isOpen, onClose, products, onSelectScannedProduct, showToast }: ScannerModalProps) {
  const [scanComplete, setScanComplete] = useState(false);
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);

  if (!isOpen) return null;

  const handleSimulateScan = (p: Product) => {
    setScannedProduct(p);
    setScanComplete(true);
    showToast(`تم مسح الباركود بنجاح لصنف "${p.name}"`, 'success');
  };

  const handleConfirmScanResult = () => {
    if (scannedProduct) {
      onSelectScannedProduct(scannedProduct);
    }
    setScanComplete(false);
    setScannedProduct(null);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
      <div className="bg-[#0F172A] rounded-3xl w-full max-w-sm border border-slate-800 overflow-hidden flex flex-col max-h-[85%] text-slate-200 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <span className="font-bold text-sm flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-200" />
            ماسح الباركود الذكي (كاميرا الهاتف)
          </span>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Camera Viewfinder body */}
        <div className="flex-1 flex flex-col justify-between p-5 relative overflow-hidden">
          
          {scanComplete && scannedProduct ? (
            /* SCAN COMPLETE SCREEN Overlay */
            <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center p-6 text-center z-20 space-y-4 animate-in fade-in duration-200">
              <CheckCircle2 className="w-16 h-16 text-teal-400 animate-bounce" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-white">تم قراءة الباركود!</h4>
                <p className="text-xs text-slate-400">كود المنتج: UPC-{Math.floor(800000 + Math.random() * 100000)}</p>
              </div>

              {/* Scanned product stats card */}
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-4 w-full text-right space-y-2">
                <div className="font-bold text-teal-300 text-sm">{scannedProduct.name}</div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>القسم: {scannedProduct.category}</span>
                  <span className="font-extrabold text-white">{scannedProduct.price} ج.م</span>
                </div>
                <div className="text-[10px] text-slate-500">المخزون المتوفر: {scannedProduct.quantity} {scannedProduct.unit}</div>
              </div>

              <button
                type="button"
                onClick={handleConfirmScanResult}
                className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white py-3 rounded-xl text-xs font-bold shadow-md transition-colors cursor-pointer"
              >
                تطبيق الإجراء واختيار المنتج
              </button>
            </div>
          ) : (
            /* MAIN VIEWFINDER SCREEN */
            <>
              {/* Laser line simulator scanning */}
              <div className="absolute top-[35%] left-[10%] right-[10%] h-0.5 bg-red-500 shadow-md shadow-red-500 animate-pulse z-10" />

              {/* Viewfinder brackets */}
              <div className="absolute top-[20%] bottom-[40%] left-[12%] right-[12%] border-2 border-dashed border-teal-400 rounded-3xl opacity-80" />

              <div className="text-center text-xs text-slate-400 z-10 bg-slate-950/65 py-2.5 px-4 rounded-xl max-w-[80%] mx-auto mt-4 font-semibold">
                وجّه الكاميرا نحو باركود المنتج لمسحه تلقائيًا...
              </div>

              {/* Simulation triggers (list of products you can simulate scanning) */}
              <div className="mt-auto space-y-2.5 z-10 shrink-0">
                <h4 className="text-[11px] font-bold text-slate-400 bg-slate-950/40 p-1.5 rounded-lg inline-block">تحديث المحاكاة: انقر لمسح منتج من بضائعك</h4>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto bg-slate-950/40 p-2 rounded-2xl">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleSimulateScan(p)}
                      className="bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-[11px] font-bold py-2 px-2.5 rounded-xl transition-colors truncate cursor-pointer text-center"
                    >
                      مسح {p.name}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>

      </div>
    </div>
  );
}
