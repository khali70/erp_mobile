/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Download, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Minus,
  X
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface CashBookScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
}

interface CashTransaction {
  id: string;
  description: string;
  source: string;
  amount: number; // positive for cash-in, negative for cash-out
  balanceAfter: number;
  period: 'day' | 'week' | 'month';
}

export default function CashBookScreen({
  onNavigate,
  showToast
}: CashBookScreenProps) {
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('day');
  const [showAddTransaction, setShowAddTransaction] = useState<'in' | 'out' | null>(null);
  
  // Form fields
  const [desc, setDesc] = useState('');
  const [source, setSource] = useState('');
  const [amountStr, setAmountStr] = useState('');

  // Initial cash book records
  const [ledger, setLedger] = useState<CashTransaction[]>([
    { id: '1', description: 'تحصيل من أحمد محمود', source: 'بيع #١٠٥٠ · ٢:٣٠م', amount: 420, balanceAfter: 18450, period: 'day' },
    { id: '2', description: 'سداد لمخازن الدلتا', source: 'شراء #١٠٤٨ · ١:١٠م', amount: -1100, balanceAfter: 18030, period: 'day' },
    { id: '3', description: 'مصروف: كهرباء', source: 'نفقات · ١١:٠٠ص', amount: -300, balanceAfter: 19130, period: 'day' },
    { id: '4', description: 'مبيعات نقدية', source: 'بيع #١٠٤٧ · ١٠:١٥ص', amount: 680, balanceAfter: 19430, period: 'day' },
    // Historical week items
    { id: '5', description: 'تحصيل من زبون آجل', source: 'سند قبض · الأمس', amount: 1500, balanceAfter: 18750, period: 'week' },
    { id: '6', description: 'مصاريف نقل وتوصيل', source: 'نفقات · قبل ٣ أيام', amount: -150, balanceAfter: 17250, period: 'week' },
    // Historical month items
    { id: '7', description: 'فاتورة مياه المحل', source: 'نفقات · قبل ١٠ أيام', amount: -220, balanceAfter: 17400, period: 'month' },
    { id: '8', description: 'مبيعات جملة نقدية', source: 'بيع #١٠٣٠ · قبل ٢ أسبوع', amount: 4500, balanceAfter: 17620, period: 'month' }
  ]);

  // Current current cash is the balanceAfter of the first item (newest)
  const currentCashBalance = ledger.length > 0 ? ledger[0].balanceAfter : 18450;

  // Calculate sum of Cash in & cash out for today ('day')
  const todayTransactions = ledger.filter(t => t.period === 'day');
  const todayIn = todayTransactions.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);
  const todayOut = todayTransactions.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);

  // Filter based on period
  const filteredLedger = ledger.filter(item => {
    if (period === 'day') return item.period === 'day';
    if (period === 'week') return item.period === 'day' || item.period === 'week';
    return true; // 'month' displays all
  });

  const handleExport = () => {
    showToast('جاري تحضير ملف PDF لدفتر النقدية لحسابات الخزينة...', 'success');
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desc.trim() || !amountStr) return;

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      showToast('يرجى كتابة مبلغ صحيح أكبر من الصفر', 'info');
      return;
    }

    const signedAmount = showAddTransaction === 'in' ? amt : -amt;
    const newBalance = currentCashBalance + signedAmount;

    const timeStr = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    const formattedSource = source.trim() ? `${source.trim()} · ${timeStr}` : `يدوي · ${timeStr}`;

    const newTx: CashTransaction = {
      id: Date.now().toString(),
      description: desc.trim(),
      source: formattedSource,
      amount: signedAmount,
      balanceAfter: newBalance,
      period: 'day'
    };

    setLedger(prev => [newTx, ...prev]);
    setDesc('');
    setSource('');
    setAmountStr('');
    setShowAddTransaction(null);

    showToast(
      signedAmount > 0 
        ? `تم تسجيل عملية القبض بنجاح (+${amt} ج.م)` 
        : `تم تسجيل عملية الصرف بنجاح (-${amt} ج.م)`, 
      'success'
    );
  };

  return (
    <div id="cash-book-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* 1. Top Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="cash-book-back-btn"
            onClick={() => onNavigate('reports')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">دفتر النقدية</span>
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

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        
        {/* 2. Balance Hero Card */}
        <div className="bg-[#0E7569] text-white rounded-2xl p-5 border border-teal-800 shadow-md text-right flex flex-col space-y-3.5">
          <div>
            <span className="text-[10px] text-teal-200/90 font-bold block mb-1">الرصيد النقدي الحالي في الخزينة</span>
            <span className="text-3xl font-black text-white tracking-tight">
              {currentCashBalance.toLocaleString('ar-EG')} ج.م
            </span>
          </div>

          {/* Translucent inline stats row */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
            <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between">
              <span className="text-teal-100 font-bold text-[10px]">وارد اليوم:</span>
              <span className="font-black text-emerald-300 text-[11px] flex items-center gap-0.5">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                +{todayIn.toLocaleString('ar-EG')}
              </span>
            </div>
            <div className="bg-white/10 rounded-lg p-2 flex items-center justify-between">
              <span className="text-teal-100 font-bold text-[10px]">صادر اليوم:</span>
              <span className="font-black text-red-300 text-[11px] flex items-center gap-0.5">
                <ArrowUpRight className="w-3.5 h-3.5" />
                -{todayOut.toLocaleString('ar-EG')}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Period Chips */}
        <div className="bg-white border border-slate-200/60 p-1.5 rounded-xl flex">
          {[
            { key: 'day', label: 'اليوم' },
            { key: 'week', label: 'الأسبوع' },
            { key: 'month', label: 'الشهر' }
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setPeriod(item.key as any)}
              className={`flex-1 py-1.5 text-xs font-black rounded-lg transition-all cursor-pointer text-center ${
                period === item.key 
                  ? 'bg-[#0E7569] text-white shadow-xs' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* 4. Ledger Rows */}
        <div className="space-y-2.5">
          {filteredLedger.map((tx) => {
            const isCashIn = tx.amount > 0;
            return (
              <div 
                key={tx.id} 
                className="bg-white rounded-xl p-3 border border-slate-200/60 shadow-xs hover:shadow-sm transition-all flex items-center justify-between text-right"
              >
                {/* Right Column: Colored circular icon + Description/source */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                    isCashIn ? 'bg-green-50 text-[#16A34A]' : 'bg-rose-50 text-[#DC2626]'
                  }`}>
                    {isCashIn ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{tx.description}</h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{tx.source}</p>
                  </div>
                </div>

                {/* Left Column: Signed Amount + Running Balance */}
                <div className="text-left">
                  <span className={`text-xs font-black block ${
                    isCashIn ? 'text-[#16A34A]' : 'text-[#DC2626]'
                  }`}>
                    {isCashIn ? '+' : ''}{tx.amount.toLocaleString('ar-EG')} ج.م
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold mt-0.5 block">
                    رصيد {tx.balanceAfter.toLocaleString('ar-EG')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

      </div>

      {/* 5. Footer manually record movements */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] px-4 py-2.5 flex gap-3 z-40" dir="rtl">
        {/* Receipt Button */}
        <button
          onClick={() => setShowAddTransaction('in')}
          className="flex-1 bg-green-50 hover:bg-green-100 text-[#16A34A] border border-[#16A34A]/30 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>قبض (وارد للخزينة)</span>
        </button>

        {/* Payout Button */}
        <button
          onClick={() => setShowAddTransaction('out')}
          className="flex-1 bg-rose-50 hover:bg-rose-100 text-[#DC2626] border border-[#DC2626]/30 rounded-xl font-black text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
        >
          <Minus className="w-4 h-4" />
          <span>صرف (خارج من الخزينة)</span>
        </button>
      </div>

      {/* Add Cash Transaction Modal Popup */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className={`text-white px-4 py-3 flex items-center justify-between shrink-0 ${
              showAddTransaction === 'in' ? 'bg-[#16A34A]' : 'bg-[#DC2626]'
            }`}>
              <span className="font-bold text-xs flex items-center gap-1.5">
                {showAddTransaction === 'in' ? (
                  <Plus className="w-4 h-4" />
                ) : (
                  <Minus className="w-4 h-4" />
                )}
                {showAddTransaction === 'in' ? 'تسجيل سند قبض نقدي' : 'تسجيل سند صرف نقدي'}
              </span>
              <button 
                onClick={() => setShowAddTransaction(null)} 
                className="w-7 h-7 rounded-full bg-black/20 hover:bg-black/30 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">البيان (الوصف)</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: تحصيل فاتورة، شراء علب كرتون..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المصدر / المستند المرتبط (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: بيع #١٠٥١، نفقات تسوية..."
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">المبلغ (ج.م)</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full bg-slate-50 text-slate-850 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right font-black"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className={`flex-1 text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer ${
                    showAddTransaction === 'in' ? 'bg-[#16A34A] hover:bg-[#117C37]' : 'bg-[#DC2626] hover:bg-[#B11E1E]'
                  }`}
                >
                  حفظ السند
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddTransaction(null)}
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
