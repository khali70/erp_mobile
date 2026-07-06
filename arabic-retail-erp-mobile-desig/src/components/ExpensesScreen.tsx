/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Home, 
  Users, 
  Zap, 
  Truck, 
  Receipt,
  X
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface ExpensesScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
}

interface ExpenseItem {
  id: string;
  title: string;
  date: string;
  amount: number;
  category: 'rent' | 'salary' | 'electricity' | 'transport' | 'other';
  categoryLabel: string;
}

export default function ExpensesScreen({
  onNavigate,
  showToast
}: ExpensesScreenProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'rent' | 'salary' | 'electricity' | 'transport' | 'other'>('all');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [category, setCategory] = useState<'rent' | 'salary' | 'electricity' | 'transport' | 'other'>('rent');

  // Hardcoded default items from the prompt
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: '1', title: 'إيجار المحل', date: '١ يوليو', amount: 3000, category: 'rent', categoryLabel: 'إيجار' },
    { id: '2', title: 'راتب عامل', date: '١ يوليو', amount: 1500, category: 'salary', categoryLabel: 'رواتب' },
    { id: '3', title: 'فاتورة كهرباء', date: '٤ يوليو', amount: 300, category: 'electricity', categoryLabel: 'كهرباء' },
    { id: '4', title: 'بنزين توصيل', date: '٥ يوليو', amount: 220, category: 'transport', categoryLabel: 'نقل' },
    { id: '5', title: 'مصاريف نثرية', date: '٦ يوليو', amount: 100, category: 'other', categoryLabel: 'أخرى' }
  ]);

  // Calculate current total
  const totalAmount = expenses.reduce((acc, exp) => acc + exp.amount, 0);

  // Filter based on selected chip
  const filteredExpenses = expenses.filter(exp => 
    activeCategory === 'all' ? true : exp.category === activeCategory
  );

  // Map category to icon
  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case 'rent':
        return <Home className="w-4.5 h-4.5" />;
      case 'salary':
        return <Users className="w-4.5 h-4.5" />;
      case 'electricity':
        return <Zap className="w-4.5 h-4.5" />;
      case 'transport':
        return <Truck className="w-4.5 h-4.5" />;
      default:
        return <Receipt className="w-4.5 h-4.5" />;
    }
  };

  // Map category to styling color
  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'rent':
        return 'bg-blue-50 text-blue-600 border border-blue-100';
      case 'salary':
        return 'bg-purple-50 text-purple-600 border border-purple-100';
      case 'electricity':
        return 'bg-amber-50 text-amber-600 border border-amber-100';
      case 'transport':
        return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
      default:
        return 'bg-slate-100 text-slate-600 border border-slate-200';
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !amountStr) return;

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      showToast('يرجى كتابة مبلغ صحيح', 'info');
      return;
    }

    const labels: Record<string, string> = {
      rent: 'إيجار',
      salary: 'رواتب',
      electricity: 'كهرباء',
      transport: 'نقل',
      other: 'أخرى'
    };

    const newExpense: ExpenseItem = {
      id: Date.now().toString(),
      title: title.trim(),
      date: 'اليوم',
      amount: amt,
      category,
      categoryLabel: labels[category]
    };

    setExpenses(prev => [newExpense, ...prev]);
    setTitle('');
    setAmountStr('');
    setCategory('rent');
    setShowAddModal(false);

    showToast(`تم تسجيل نفقة "${newExpense.title}" بقيمة ${amt.toLocaleString('ar-EG')} ج.م بنجاح`, 'success');
  };

  return (
    <div id="expenses-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* 1. Top Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between shrink-0 sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="expenses-back-btn"
            onClick={() => onNavigate('reports')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">النفقات والمصروفات</span>
        </div>
        
        {/* Top "+" Add Chip */}
        <button 
          onClick={() => setShowAddModal(true)}
          className="w-9 h-9 bg-white text-[#0E7569] hover:bg-teal-50 rounded-xl flex items-center justify-center shadow-sm transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-20 space-y-4">
        
        {/* 2. Summary Hero Card */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/60 shadow-xs flex flex-col items-center justify-center text-center space-y-1">
          <span className="text-3xl font-black text-[#DC2626] tracking-tight">
            {totalAmount.toLocaleString('ar-EG')} ج.م
          </span>
          <span className="text-xs font-bold text-slate-500">نفقات يوليو الحالية</span>
          <span className="text-[10px] text-slate-400 font-bold mt-1 block">
            الشهر الماضي: ٤٬٦٠٠ ج.م
          </span>
        </div>

        {/* 3. Category Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin max-w-full">
          {[
            { key: 'all', label: 'الكل' },
            { key: 'rent', label: 'إيجار' },
            { key: 'salary', label: 'رواتب' },
            { key: 'electricity', label: 'كهرباء' },
            { key: 'transport', label: 'نقل' },
            { key: 'other', label: 'أخرى' }
          ].map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key as any)}
              className={`px-3.5 py-1.5 text-[11px] font-black rounded-full shrink-0 transition-all cursor-pointer ${
                activeCategory === cat.key 
                  ? 'bg-[#0E7569] text-white shadow-xs' 
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 4. Expense Rows */}
        <div className="space-y-2.5">
          {filteredExpenses.length > 0 ? (
            filteredExpenses.map((exp) => (
              <div 
                key={exp.id} 
                className="bg-white rounded-xl p-3.5 border border-slate-200/60 shadow-xs hover:shadow-sm transition-all flex items-center justify-between text-right"
              >
                {/* Right: Colored rounded category icon + Title + Date */}
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${getCategoryColor(exp.category)}`}>
                    {getCategoryIcon(exp.category)}
                  </div>
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">{exp.title}</h4>
                    <p className="text-[9px] text-slate-400 font-bold mt-0.5">{exp.date} · {exp.categoryLabel}</p>
                  </div>
                </div>

                {/* Left: Price inside danger-red */}
                <div className="text-left shrink-0">
                  <span className="text-xs font-black text-[#DC2626]">
                    {exp.amount.toLocaleString('ar-EG')} ج.م
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs font-bold">
              لا توجد نفقات مسجلة لهذه الفئة حالياً.
            </div>
          )}
        </div>

      </div>

      {/* 5. Bottom floating "+" Button (Teal, bottom-left) */}
      <button
        onClick={() => setShowAddModal(true)}
        className="absolute bottom-5 left-5 w-12 h-12 bg-[#0E7569] hover:bg-[#08483F] text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer z-45"
        title="إضافة نفقة جديدة"
      >
        <Plus className="w-6 h-6" />
      </button>

      {/* Add Expense Modal Popup */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200 text-right" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-xs shadow-2xl border border-slate-100 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
            <div className="bg-[#0E7569] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <span className="font-bold text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-teal-200" />
                تسجيل نفقة جديدة
              </span>
              <button 
                onClick={() => setShowAddModal(false)} 
                className="w-7 h-7 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-white" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="p-4 space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">بيان النفقة / المصروف</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: صيانة رفوف، شحن عداد الكهرباء..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">الفئة المصنفة</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right cursor-pointer"
                >
                  <option value="rent">إيجارات</option>
                  <option value="salary">رواتب وأجور</option>
                  <option value="electricity">كهرباء ومرافق</option>
                  <option value="transport">نقل وتوصيل</option>
                  <option value="other">مصاريف أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">قيمة المصروف (ج.م)</label>
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
                  className="flex-1 bg-[#0E7569] hover:bg-[#08483F] text-white py-2 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                >
                  حفظ النفقة
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
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
