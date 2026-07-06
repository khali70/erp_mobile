/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Download, 
  Truck, 
  Banknote,
  Search,
  Check,
  X
} from 'lucide-react';
import { Supplier, ActiveScreen } from '../types';

interface SupplierDebtsScreenProps {
  suppliers: Supplier[];
  onPaySupplier: (supplierId: string, amount: number) => void;
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
}

export default function SupplierDebtsScreen({
  suppliers,
  onPaySupplier,
  onNavigate,
  showToast
}: SupplierDebtsScreenProps) {
  const [filter, setFilter] = useState<'largest' | 'newest' | 'all'>('largest');
  const [searchTerm, setSearchTerm] = useState('');
  const [payingSupplier, setPayingSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // Default initial/hardcoded suppliers + dynamic suppliers from the state if they have debt
  const staticSuppliers = [
    { id: 'sd_1', name: 'شركة النور للتجارة', phone: '01012345678', debt: 760, lastSupply: '٦ يوليو', age: 'منذ ٠ يوم', dateVal: 0 },
    { id: 'sd_2', name: 'مخازن الدلتا', phone: '01123456789', debt: 2600, lastSupply: '٢٨ يونيو', age: 'منذ ٨ أيام', dateVal: 8 },
    { id: 'sd_3', name: 'موزّع ملابس رجالي', phone: '01234567890', debt: 1760, lastSupply: '٢ يوليو', age: 'منذ ٤ أيام', dateVal: 4 },
  ];

  // Merge dynamic state suppliers to keep it alive
  const allSuppliersMap = new Map<string, { id: string; name: string; phone: string; debt: number; lastSupply: string; age: string; dateVal: number }>();
  
  staticSuppliers.forEach(s => {
    allSuppliersMap.set(s.name, s);
  });

  suppliers.forEach(s => {
    if (s.debt > 0) {
      if (allSuppliersMap.has(s.name)) {
        // update debt with dynamic one
        const existing = allSuppliersMap.get(s.name)!;
        existing.debt = s.debt;
        allSuppliersMap.set(s.name, existing);
      } else {
        allSuppliersMap.set(s.name, {
          id: s.id,
          name: s.name,
          phone: s.phone,
          debt: s.debt,
          lastSupply: 'مؤخراً',
          age: 'منذ يومين',
          dateVal: 2
        });
      }
    }
  });

  const mergedSuppliers = Array.from(allSuppliersMap.values()).filter(s => s.debt > 0);

  // Filter based on search
  const searchedSuppliers = mergedSuppliers.filter(s => 
    s.name.includes(searchTerm) || s.phone.includes(searchTerm)
  );

  // Sort based on chips
  const sortedSuppliers = [...searchedSuppliers].sort((a, b) => {
    if (filter === 'largest') {
      return b.debt - a.debt;
    } else if (filter === 'newest') {
      return a.dateVal - b.dateVal; // smaller age means newer
    }
    return 0; // 'all' (keep default order)
  });

  const totalOwed = mergedSuppliers.reduce((acc, s) => acc + s.debt, 0);

  const handleExport = () => {
    showToast('جاري تصدير تقرير الديون للموردين كملف Excel...', 'success');
  };

  const handleOpenPayModal = (sup: any) => {
    setPayingSupplier({
      id: sup.id,
      name: sup.name,
      phone: sup.phone,
      debt: sup.debt
    });
    setPayAmount(sup.debt.toString());
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingSupplier || !payAmount) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'info');
      return;
    }

    if (amt > payingSupplier.debt) {
      showToast('المبلغ المدفوع يتجاوز الدين المستحق للمورد!', 'info');
      return;
    }

    // Call onPaySupplier to update the state in parent if it's a state supplier,
    // otherwise we can just simulate it on our static supplier or let onPaySupplier handle it.
    onPaySupplier(payingSupplier.id, amt);

    // Also update our map/local memory for demo/simulation purposes if it's local static supplier
    const localSupp = mergedSuppliers.find(s => s.id === payingSupplier.id);
    if (localSupp) {
      localSupp.debt = Math.max(0, localSupp.debt - amt);
    }

    setPayingSupplier(null);
    setPayAmount('');
    showToast(`تم سداد مبلغ ${amt.toLocaleString('ar-EG')} ج.م بنجاح إلى "${payingSupplier.name}"`, 'success');
  };

  return (
    <div id="supplier-debts-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* 1. Top Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="supplier-debts-back-btn"
            onClick={() => onNavigate('reports')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">الديون حسب المورد</span>
        </div>
        
        {/* Export Chip */}
        <button 
          onClick={handleExport}
          className="bg-white/10 hover:bg-white/20 text-white rounded-xl px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>تصدير</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 space-y-4">
        
        {/* 2. Summary Hero Card */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/60 shadow-xs flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-[11px] font-bold text-slate-500">إجمالي مستحق عليك للموردين</span>
          <span className="text-3xl font-black text-[#DC2626] tracking-tight">
            {totalOwed.toLocaleString('ar-EG')} ج.م
          </span>
          <span className="text-[10px] text-slate-400 font-bold">
            مدفوع للموردين هذا الشهر: ٣٬٠٠٠ ج.م
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute right-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="البحث عن مورد..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-xs font-semibold focus:outline-none focus:border-[#0E7569] text-right"
          />
        </div>

        {/* 3. Sort chips */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter('largest')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-full transition-all cursor-pointer ${
              filter === 'largest' 
                ? 'bg-[#0E7569] text-white shadow-xs' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            الأكبر ديناً
          </button>
          <button
            onClick={() => setFilter('newest')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-full transition-all cursor-pointer ${
              filter === 'newest' 
                ? 'bg-[#0E7569] text-white shadow-xs' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            الأحدث
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3.5 py-1.5 text-xs font-black rounded-full transition-all cursor-pointer ${
              filter === 'all' 
                ? 'bg-[#0E7569] text-white shadow-xs' 
                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            الكل
          </button>
        </div>

        {/* 4. Supplier Debt Rows */}
        <div className="space-y-2.5">
          {sortedSuppliers.length > 0 ? (
            sortedSuppliers.map((sup) => (
              <div 
                key={sup.id} 
                className="bg-white rounded-2xl p-3.5 border border-slate-200/60 shadow-xs hover:shadow-sm transition-all flex items-center justify-between text-right"
              >
                {/* Right Column: Avatar + Name & Sub info */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#E6F5F3] text-[#0E7569] flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{sup.name}</h4>
                    <p className="text-[10px] text-slate-400 font-bold mt-0.5">آخر توريد: {sup.lastSupply}</p>
                  </div>
                </div>

                {/* Left Column: Debt Amount, Age & Pay button */}
                <div className="flex items-center gap-3">
                  <div className="text-left flex flex-col items-end">
                    <span className="text-xs font-black text-[#DC2626]">
                      {sup.debt.toLocaleString('ar-EG')} ج.م
                    </span>
                    <span className="text-[9px] text-slate-400 font-bold mt-0.5">
                      {sup.age}
                    </span>
                  </div>

                  {/* 5. Payment Button */}
                  <button
                    onClick={() => handleOpenPayModal(sup)}
                    className="w-8 h-8 rounded-xl bg-[#E6F5F3] hover:bg-teal-100 text-[#0E7569] flex items-center justify-center transition-all cursor-pointer"
                    title="تسجيل سداد دين"
                  >
                    <Banknote className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              لا توجد ديون مستحقة للموردين تطابق البحث.
            </div>
          )}
        </div>

      </div>

      {/* Payment Form Modal */}
      {payingSupplier && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#0E7569] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Banknote className="w-4 h-4 text-teal-200" />
                سداد دفعة للمورد
              </span>
              <button 
                onClick={() => setPayingSupplier(null)} 
                className="w-7 h-7 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayment} className="p-4 space-y-3">
              <div className="text-xs">
                <span className="font-bold text-slate-800 block">سداد حساب: {payingSupplier.name}</span>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  إجمالي الدين المطلوب: {payingSupplier.debt.toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المبلغ المدفوع (ج.م)</label>
                <input
                  type="number"
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right font-black"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-[#0E7569] hover:bg-[#08483F] text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  تأكيد السداد
                </button>
                <button
                  type="button"
                  onClick={() => setPayingSupplier(null)}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
