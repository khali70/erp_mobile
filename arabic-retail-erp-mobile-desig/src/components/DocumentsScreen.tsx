/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  ReceiptText, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Search, 
  X, 
  Printer, 
  Share2, 
  Barcode,
  ArrowUp,
  ArrowDown,
  ClipboardList,
  SlidersHorizontal,
  Plus
} from 'lucide-react';
import { Document, ActiveScreen } from '../types';

interface DocumentsScreenProps {
  documents: Document[];
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
}

export default function DocumentsScreen({
  documents,
  onNavigate,
  showToast
}: DocumentsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'sale' | 'purchase' | 'adjustment'>('all');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  // Search & Filter
  const filteredDocs = documents.filter(d => {
    const matchesSearch = d.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          d.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterType === 'sale') return d.type === 'sale';
    if (filterType === 'purchase') return d.type === 'purchase';
    if (filterType === 'adjustment') return d.type === 'adjustment';
    return true;
  });

  return (
    <div id="documents-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="docs-back-btn"
            onClick={() => onNavigate('home')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-lg">المستندات</span>
        </div>
        
        {/* Left side actions: Filters and Quick Document */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              showToast('تفعيل تصفية متقدمة للمستندات السنوية والمستودع', 'success');
            }}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer text-white"
            title="تصفية المستندات"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Body Layout */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-3.5 space-y-4">
        
        {/* Search */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 right-0 pl-3 pr-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث برقم السند أو اسم الشريك..."
            className="w-full bg-white text-[#0F172A] pl-4 pr-11 py-3 rounded-2xl border border-[#E2E8F0] shadow-sm text-xs font-bold focus:outline-none focus:border-[#0E7569] text-right"
          />
        </div>

        {/* Segmented Filter Pills */}
        <div className="flex gap-1.5 pb-1 overflow-x-auto select-none no-scrollbar shrink-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'all'
                ? 'bg-[#0E7569] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0]'
            }`}
          >
            الكل ({documents.length})
          </button>
          
          <button
            onClick={() => setFilterType('sale')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'sale'
                ? 'bg-[#0E7569] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0]'
            }`}
          >
            صادر
          </button>

          <button
            onClick={() => setFilterType('purchase')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'purchase'
                ? 'bg-[#0E7569] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0]'
            }`}
          >
            وارد
          </button>

          <button
            onClick={() => setFilterType('adjustment')}
            className={`px-4 py-2 text-xs font-black rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              filterType === 'adjustment'
                ? 'bg-[#0E7569] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0]'
            }`}
          >
            جرد
          </button>
        </div>

        {/* Date Group Label */}
        <div className="flex justify-between items-center text-[10px] text-slate-400 font-extrabold px-1 tracking-wider">
          <span>سجل اليوم والأمس والمستندات النشطة</span>
          <span>ترتيب: تنازلي بحسب التاريخ</span>
        </div>

        {/* Documents Scrollable Grid */}
        <div className="flex-1 overflow-y-auto pb-24 space-y-3 pr-0.5">
          {filteredDocs.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-3">
              <ReceiptText className="w-12 h-12 text-slate-300" />
              <span>لا توجد مستندات تطابق الفلاتر.</span>
            </div>
          ) : (
            filteredDocs.map((d) => {
              const isSale = d.type === 'sale';
              const isPurchase = d.type === 'purchase';
              const isAdjustment = d.type === 'adjustment';

              return (
                <div
                  key={d.id}
                  onClick={() => setSelectedDoc(d)}
                  className="bg-white rounded-2xl p-4 border border-[#E2E8F0] hover:border-slate-300 shadow-xs hover:shadow-sm transition-all cursor-pointer flex items-center justify-between group animate-in fade-in duration-200"
                >
                  {/* Right side: Direction icon + ID/Date */}
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isSale 
                        ? 'bg-teal-50 text-[#0E7569]' 
                        : isPurchase 
                        ? 'bg-green-50 text-[#16A34A]' 
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {isSale && <ArrowUp className="w-5 h-5" />}
                      {isPurchase && <ArrowDown className="w-5 h-5" />}
                      {isAdjustment && <ClipboardList className="w-5 h-5" />}
                    </div>
                    
                    <div className="flex flex-col gap-0.5 text-right">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold text-slate-400">
                          {isSale ? 'صادر ·' : isPurchase ? 'وارد ·' : 'جرد ·'}
                        </span>
                        <span className="text-xs font-extrabold text-slate-800">{d.customerName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono font-bold">{d.docNumber} · {d.date}</span>
                    </div>
                  </div>

                  {/* Left side: Price and Debt label */}
                  <div className="flex flex-col items-end gap-1.5">
                    <span className="text-xs font-black text-slate-800 tracking-tight">
                      {d.totalAmount.toLocaleString('ar-EG')} <span className="text-[9px] font-normal text-slate-500">ج.م</span>
                    </span>
                    
                    {isAdjustment ? (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                        تسوية مخزون
                      </span>
                    ) : d.debtAmount > 0 ? (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                        دَين
                      </span>
                    ) : (
                      <span className="text-[8px] font-black px-1.5 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-100">
                        مدفوع
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Floating Plus button for fast addition */}
      <div className="absolute bottom-20 left-4 z-40">
        <button
          onClick={() => onNavigate('new-sale')}
          className="w-14 h-14 bg-[#0E7569] hover:bg-[#08483F] text-white rounded-full flex items-center justify-center shadow-lg hover:shadow-xl transition-all cursor-pointer active:scale-95"
          title="إنشاء مستند جديد"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

      {/* DETAIL RECEIPT MODAL */}
      {selectedDoc && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-[28px] w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90%] animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between shadow-sm shrink-0">
              <span className="font-bold text-sm">سند المعاملة بالتفصيل</span>
              <button 
                onClick={() => setSelectedDoc(null)}
                className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Receipt Body (Simulated Print Paper Roll) */}
            <div className="flex-1 overflow-y-auto p-5 bg-[#F8FAFC]">
              
              {/* The Paper itself */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4 font-mono text-xs text-slate-800 relative">
                
                {/* Simulated thermal jagged cuts */}
                <div className="text-center space-y-1.5 pb-2">
                  <h3 className="font-extrabold text-base text-[#0E7569]">مجموعة محلات المتجر الرئيسي</h3>
                  <p className="text-[10px] text-slate-400">سجل تجاري رقم: ٣٣٤٩٥</p>
                  <p className="text-[10px] text-slate-400">القاهرة، مصر · هاتف: ٠١٠٠٢٣٤٥٦</p>
                </div>

                <div className="border-t border-dashed border-slate-300 py-3 space-y-1 text-[10px] text-slate-500">
                  <div className="flex justify-between">
                    <span>السند:</span>
                    <span className="font-bold text-slate-800">{selectedDoc.docNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>التاريخ والوقت:</span>
                    <span className="font-bold text-slate-800">{selectedDoc.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>الجهة / العميل:</span>
                    <span className="font-bold text-slate-800">{selectedDoc.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>نوع الفاتورة:</span>
                    <span className="font-bold text-slate-800">{selectedDoc.type === 'sale' ? 'صادر مبيعات' : 'وارد مشتريات'}</span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-300 pt-3">
                  <h4 className="font-bold text-[#0F172A] mb-2">قائمة الأصناف</h4>
                  <table className="w-full text-right text-[11px] space-y-1">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 pb-1">
                        <th className="font-normal text-right">الصنف</th>
                        <th className="font-normal text-center">الكمية</th>
                        <th className="font-normal text-left">المجموع</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDoc.items.map((item, idx) => (
                        <tr key={idx} className="border-b border-slate-50 py-1.5">
                          <td className="py-1">
                            <div className="font-semibold text-slate-800">{item.productName}</div>
                            <div className="text-[9px] text-slate-400 font-normal">{item.price.toLocaleString('ar-EG')} ج.م للوحدة</div>
                          </td>
                          <td className="text-center py-1 font-bold text-slate-600">{item.quantity}</td>
                          <td className="text-left py-1 font-bold text-slate-800">{(item.price * item.quantity).toLocaleString('ar-EG')} ج.م</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Math Calculations */}
                <div className="border-t border-dashed border-slate-300 pt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">الإجمالي الجزئي:</span>
                    <span className="text-slate-800">{selectedDoc.totalAmount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">المدفوع نقدًا:</span>
                    <span className="text-green-600 font-bold">{selectedDoc.cashPaid.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                  <div className="flex justify-between font-medium">
                    <span className="text-slate-500">المتبقي (ديون آجلة):</span>
                    <span className={`font-bold ${selectedDoc.debtAmount > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
                      {selectedDoc.debtAmount.toLocaleString('ar-EG')} ج.م
                    </span>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-2 flex justify-between items-center text-sm font-black">
                    <span className="text-slate-800">إجمالي الحساب:</span>
                    <span className="text-[#0E7569]">{selectedDoc.totalAmount.toLocaleString('ar-EG')} ج.م</span>
                  </div>
                </div>

                <hr className="border-dashed border-slate-300" />

                {/* Barcode representation */}
                <div className="flex flex-col items-center justify-center pt-2 space-y-1.5">
                  <div className="flex items-center text-slate-400">
                    <Barcode className="w-40 h-10" />
                  </div>
                  <span className="text-[8px] text-slate-400 tracking-widest">{selectedDoc.id.toUpperCase()}</span>
                </div>

                {/* Footer terms */}
                <p className="text-center text-[9px] text-slate-400 pt-1">نشكركم على تعاملكم معنا ونرجو زيارتنا مجددًا</p>

              </div>
            </div>

            {/* Print action footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={() => showToast('جاري تحضير الطابعة الحرارية وتصدير المستند...', 'success')}
                className="flex-1 bg-[#0E7569] hover:bg-[#08483F] text-white py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة السند</span>
              </button>
              <button
                type="button"
                onClick={() => showToast('تم نسخ رابط الفاتورة لمشاركتها عبر الواتساب', 'success')}
                className="bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
