/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  Percent, 
  ChevronLeft,
  Info,
  Printer,
  Share2,
  ReceiptText,
  Truck,
  Coins,
  ClipboardList,
  Calendar,
  DollarSign,
  Briefcase,
  PieChart
} from 'lucide-react';
import { Product, Document, ActiveScreen } from '../types';

interface ReportsScreenProps {
  products: Product[];
  documents: Document[];
  onNavigate: (screen: ActiveScreen) => void;
}

export default function ReportsScreen({
  products,
  documents,
  onNavigate
}: ReportsScreenProps) {
  // Subview toggler: 'list' (Screen 07) or 'pnl' (Screen 08)
  const [subView, setSubView] = useState<'list' | 'pnl'>('list');
  
  // Period filter for P&L: 'day' | 'week' | 'month' | 'year'
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('month');

  // Dynamic calculations based on state documents
  const salesDocs = documents.filter(d => d.type === 'sale');
  const purchaseDocs = documents.filter(d => d.type === 'purchase');
  
  // Current active transaction sums
  const activeSalesRevenue = salesDocs.reduce((acc, d) => acc + d.totalAmount, 0);
  const activePurchaseCost = purchaseDocs.reduce((acc, d) => acc + d.totalAmount, 0);

  // Simulated base historic data + live dynamic data for month/year calculations
  const getFinancialData = () => {
    let sales = 0;
    let cogs = 0;
    let expenses = 0;

    switch (period) {
      case 'day':
        sales = activeSalesRevenue > 0 ? activeSalesRevenue : 1350;
        cogs = Math.round(sales * 0.62);
        expenses = 120;
        break;
      case 'week':
        sales = 6800 + activeSalesRevenue;
        cogs = Math.round(sales * 0.63);
        expenses = 450;
        break;
      case 'month':
        // Standard high-fidelity clothing store values
        sales = 18450 + activeSalesRevenue; 
        cogs = 11200 + (activePurchaseCost > 0 ? activePurchaseCost : Math.round(activeSalesRevenue * 0.6));
        expenses = 1600; // Operating overheads for a closing retail shop
        break;
      case 'year':
        sales = 145000 + activeSalesRevenue;
        cogs = 92000 + activePurchaseCost;
        expenses = 14000;
        break;
    }

    const grossProfit = sales - cogs;
    const netProfit = grossProfit - expenses;
    const margin = sales > 0 ? Math.round((netProfit / sales) * 100) : 0;

    return { sales, cogs, expenses, grossProfit, netProfit, margin };
  };

  const { sales, cogs, expenses, grossProfit, netProfit, margin } = getFinancialData();

  // Screen 07: Reports List Render
  if (subView === 'list') {
    return (
      <div id="reports-list-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
        
        {/* Top Header Bar */}
        <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2.5">
            <button 
              id="reports-back-btn"
              onClick={() => onNavigate('home')}
              className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
            >
              <ArrowRight className="w-5 h-5 text-white" />
            </button>
            <span className="font-bold text-lg">التقارير</span>
          </div>
          <button 
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center text-teal-100 cursor-pointer"
            onClick={() => alert('نظام التقارير الذكي ERP - يساعدك على تحليل أداء التصفية وتتبع الأرباح بدقة.')}
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* List of Report Options (Screen 07 Body) */}
        <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
          
          <div className="bg-[#E6F5F3] text-[#0E7569] rounded-2xl p-4 border border-teal-200/50 text-xs font-bold leading-relaxed">
            مرحبًا بك في لوحة التقارير والمحاسبة الختامية لتصفية المحل. اختر تقريرًا من القائمة أدناه لعرض التفاصيل.
          </div>

          <h3 className="text-xs font-black text-slate-400 px-1 uppercase tracking-wider">تقارير الحسابات الختامية</h3>

          {/* List of reports items */}
          <div className="space-y-3">
            
            {/* Report 1: P&L (Clickable to go to Screen 08) */}
            <div 
              id="report-pnl-card"
              onClick={() => setSubView('pnl')}
              className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-teal-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                {/* Pastel circle icon */}
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E7569] flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-extrabold text-slate-800 group-hover:text-[#0E7569] transition-colors">تقرير الأرباح والخسائر</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تحليل الإيرادات والتكاليف والربح الصافي</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400 group-hover:text-[#0E7569] group-hover:translate-x-[-2px] transition-all" />
            </div>

             {/* Report 2: Sales movement / Cash Book */}
            <div 
              onClick={() => onNavigate('cash-book')}
              className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-teal-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-extrabold text-slate-800">دفتر النقدية والجرّ الصندوقي</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تقرير المقبوضات والمدفوعات والرصيد الحالي</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </div>

            {/* Report 3: Purchases movement / Expenses */}
            <div 
              onClick={() => onNavigate('expenses')}
              className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-teal-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-[#DC2626] flex items-center justify-center shrink-0">
                  <Coins className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-extrabold text-slate-800">تقرير النفقات والمصروفات</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تفصيل بنود المصاريف مثل الإيجار والرواتب والمرافق</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </div>

            {/* Report 4: Supplier Debts */}
            <div 
              onClick={() => onNavigate('supplier-debts')}
              className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-teal-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Truck className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-extrabold text-slate-800">الديون حسب المورد (AP)</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">كشف مديونيات الموردين والشركات وتواريخ الاستحقاق</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </div>

            {/* Report 5: Inventory Valuation & Movement */}
            <div 
              onClick={() => alert('جرد المخزن: عدد الأصناف بالمخزن هو ' + products.length + ' صنفًا بقيمة سوقية ممتازة.')}
              className="bg-white rounded-2xl p-4 border border-slate-200/60 hover:border-teal-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div className="text-right">
                  <h4 className="text-xs font-extrabold text-slate-800">جرد وحركة المخزون</h4>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">تقرير تسويات الجرد والقيمة الإجمالية للبضائع</p>
                </div>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-400" />
            </div>

          </div>

          {/* Quick Category Pie info representation */}
          <div className="bg-white rounded-2xl p-4.5 border border-slate-200/60 shadow-xs space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-[#0E7569]" />
              <span>نظرة سريعة على بضائع المتجر</span>
            </h4>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-slate-50 rounded-xl p-2.5">
                <span className="text-[9px] text-slate-400 block font-bold">إجمالي الأنواع</span>
                <span className="text-sm font-black text-slate-800">{products.length}</span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <span className="text-[9px] text-slate-400 block font-bold">إجمالي القطع</span>
                <span className="text-sm font-black text-[#0E7569]">
                  {products.reduce((acc, p) => acc + p.quantity, 0)}
                </span>
              </div>
              <div className="bg-slate-50 rounded-xl p-2.5">
                <span className="text-[9px] text-slate-400 block font-bold">مجموع القيمة</span>
                <span className="text-xs font-black text-slate-800">
                  {products.reduce((acc, p) => acc + (p.price * p.quantity), 0).toLocaleString('ar-EG')} ج.م
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // Screen 08: Profit & Loss (P&L) Report Render
  return (
    <div id="reports-pnl-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="pnl-back-btn"
            onClick={() => setSubView('list')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">الأرباح والخسائر</span>
        </div>
        
        {/* Print or Share button */}
        <button 
          onClick={() => alert('تم توليد نسخة PDF جاهزة للطباعة وحفظها بذاكرة الهاتف!')}
          className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center text-teal-100 cursor-pointer"
          title="طباعة تقرير الحسابات الختامية"
        >
          <Printer className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Segmented Period Filter */}
      <div className="bg-white border-b border-[#E2E8F0] p-2 flex shrink-0">
        {[
          { key: 'day', label: 'اليوم' },
          { key: 'week', label: 'هذا الأسبوع' },
          { key: 'month', label: 'هذا الشهر' },
          { key: 'year', label: 'هذا العام' }
        ].map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key as any)}
            className={`flex-1 py-1.5 text-[11px] font-black rounded-lg transition-all cursor-pointer text-center ${
              period === p.key 
                ? 'bg-[#0E7569] text-white shadow-xs' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Report Core Body */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        
        {/* KPI Net Profit Summary Card */}
        <div className="bg-slate-900 text-white rounded-3xl p-5 border border-slate-800 shadow-md relative overflow-hidden text-center space-y-2">
          <div className="text-[11px] font-bold text-teal-400 flex items-center justify-center gap-1">
            <Percent className="w-4 h-4" />
            <span>الربح الصافي للشركة عن الفترة المحددة</span>
          </div>
          
          <div className="text-3xl font-black text-white tracking-tight">
            {netProfit.toLocaleString('ar-EG')} <span className="text-sm font-normal text-slate-400">ج.م</span>
          </div>

          <div className="flex justify-center items-center gap-2 pt-1">
            <span className="text-[9px] font-black px-2.5 py-1 rounded-full bg-teal-500/10 text-teal-300 border border-teal-500/20">
              هامش صافي الربح: {margin}٪
            </span>
            <span className={`text-[9px] font-black px-2.5 py-1 rounded-full ${
              netProfit > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'
            }`}>
              {netProfit > 0 ? 'أداء إيجابي ممتاز' : 'مراجعة التكاليف'}
            </span>
          </div>
        </div>

        {/* Detailed Financial Breakdown Card */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs overflow-hidden">
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 flex justify-between items-center">
            <span className="text-xs font-bold text-slate-700">بيان الأرباح والخسائر المالي</span>
            <span className="text-[9px] text-slate-400 font-extrabold" dir="rtl">العملة: جنيه مصري (ج.م)</span>
          </div>

          <div className="divide-y divide-slate-100">
            
            {/* Line 1: Revenues */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 text-[#0E7569] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800 block">الإيرادات (المبيعات)</span>
                  <span className="text-[9px] text-slate-400 font-bold">مجموع الفواتير الصادرة</span>
                </div>
              </div>
              <span className="text-xs font-black text-[#0E7569]">
                {sales.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {/* Line 2: COGS */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800 block">تكلفة البضاعة المباعة (COGS)</span>
                  <span className="text-[9px] text-slate-400 font-bold">التكلفة الإجمالية لشراء الملابس</span>
                </div>
              </div>
              <span className="text-xs font-black text-orange-600">
                {cogs.toLocaleString('ar-EG')} ج.m
              </span>
            </div>

            {/* Line 3: Gross Profit */}
            <div className="p-4 bg-slate-50/50 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-100 text-[#0E7569] flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-extrabold text-[#0E7569] block">إجمالي الربح (الربح التشغيلي)</span>
                  <span className="text-[9px] text-slate-400 font-bold">الإيرادات مطروحًا منها تكلفة البضاعة</span>
                </div>
              </div>
              <span className="text-xs font-black text-[#0E7569]">
                {grossProfit.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {/* Line 4: Operating Expenses */}
            <div className="p-4 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800 block">المصاريف التشغيلية</span>
                  <span className="text-[9px] text-slate-400 font-bold">إيجار المحل، فواتير الكهرباء والعمالة</span>
                </div>
              </div>
              <span className="text-xs font-black text-slate-700">
                {expenses.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

            {/* Line 5: Net Profit (Double bottom line style) */}
            <div className="p-4 bg-[#E6F5F3]/40 border-t-2 border-double border-teal-200 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#0E7569] text-white flex items-center justify-center">
                  <Percent className="w-4 h-4" />
                </div>
                <div className="text-right">
                  <span className="text-xs font-black text-slate-800 block">صافي ربح تصفية المحل</span>
                  <span className="text-[9px] text-[#0E7569] font-bold">النتيجة النهائية الصافية</span>
                </div>
              </div>
              <span className="text-sm font-black text-[#0E7569]">
                {netProfit.toLocaleString('ar-EG')} ج.م
              </span>
            </div>

          </div>
        </div>

        {/* High-fidelity visual comparative meter bars */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/60 shadow-xs space-y-4">
          <h4 className="text-xs font-bold text-slate-800">التمثيل البصري للتدفق المالي (٪)</h4>
          
          <div className="space-y-3 pt-1">
            {/* Revenue bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>الإيرادات الكلية</span>
                <span>١٠٠٪ ({sales.toLocaleString('ar-EG')} ج.م)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-[#0E7569] rounded-full w-full" />
              </div>
            </div>

            {/* COGS bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>تكلفة شراء الملابس (COGS)</span>
                <span>{Math.round((cogs/sales)*100)}٪ ({cogs.toLocaleString('ar-EG')} ج.م)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-orange-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.round((cogs/sales)*100)}%` }}
                />
              </div>
            </div>

            {/* Operating Expenses bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>المصاريف التشغيلية</span>
                <span>{Math.round((expenses/sales)*100)}٪ ({expenses.toLocaleString('ar-EG')} ج.م)</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-500 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.round((expenses/sales)*100)}%` }}
                />
              </div>
            </div>

            {/* Net profit percentage bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>هامش الربح الصافي للشركة</span>
                <span className="text-[#0E7569] font-black">{margin}٪ ({netProfit.toLocaleString('ar-EG')} ج.م)</span>
              </div>
              <div className="w-full h-2.5 bg-[#E6F5F3] rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#0E7569] rounded-full transition-all duration-500" 
                  style={{ width: `${margin}%` }}
                />
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
