/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ArrowRight, 
  HelpCircle, 
  Store, 
  RefreshCw, 
  Coins, 
  PhoneCall, 
  Sliders, 
  ShieldCheck 
} from 'lucide-react';
import { ActiveScreen } from '../types';

interface MoreScreenProps {
  onNavigate: (screen: ActiveScreen) => void;
  onResetData: () => void;
  showToast: (message: string, type: 'success' | 'info') => void;
}

export default function MoreScreen({
  onNavigate,
  onResetData,
  showToast
}: MoreScreenProps) {
  return (
    <div id="more-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2.5">
          <button 
            id="more-back-btn"
            onClick={() => onNavigate('home')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-lg">المزيد والإعدادات</span>
        </div>
      </div>

      {/* Settings Options (Body) */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-24 space-y-4">
        
        {/* Shop Metadata Card */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/60 shadow-xs flex items-center gap-3">
          <div className="w-12 h-12 bg-teal-50 text-[#0E7569] rounded-xl flex items-center justify-center border border-teal-100">
            <Store className="w-6 h-6" />
          </div>
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold text-slate-800">تطبيق الجرد والمخزون ببساطة</span>
            <span className="text-[10px] text-slate-400">الإصدار v3.1.2 · ترخيص تجاري فردي</span>
          </div>
        </div>

        {/* Configuration List */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-xs divide-y divide-slate-100 overflow-hidden">
          
          {/* Option 1 */}
          <div className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <Sliders className="w-4.5 h-4.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">الحد الأدنى لإنذار المخزون</span>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">١٠ قطع</span>
          </div>

          {/* Option 2 */}
          <div className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <Coins className="w-4.5 h-4.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">العملة الأساسية للنظام</span>
            </div>
            <span className="text-xs font-bold text-[#0E7569]">الجنيه المصري (ج.م)</span>
          </div>

          {/* Option 3 */}
          <div className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4.5 h-4.5 text-slate-500" />
              <span className="text-xs font-semibold text-slate-700">النسخ الاحتياطي السحابي</span>
            </div>
            <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-bold">نشط وتلقائي</span>
          </div>

        </div>

        {/* Support Section */}
        <div className="bg-white rounded-2xl p-4.5 border border-slate-200/60 shadow-xs space-y-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">الدعم والمساعدة</h3>
          
          <div className="flex flex-col gap-2">
            <button
              onClick={() => showToast('جاري فتح دليل المساعدة السريعة للمستخدم...', 'info')}
              className="w-full bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors cursor-pointer text-right"
            >
              <HelpCircle className="w-4 h-4 text-[#0E7569]" />
              <span>دليل الاستخدام والتعليمات</span>
            </button>
            
            <button
              onClick={() => showToast('جاري الاتصال بخدمة العملاء الفنية...', 'info')}
              className="w-full bg-slate-50 hover:bg-slate-100 p-2.5 rounded-xl text-xs font-bold text-slate-700 flex items-center gap-2 transition-colors cursor-pointer text-right"
            >
              <PhoneCall className="w-4 h-4 text-emerald-600" />
              <span>اتصل بالدعم الفني (واتساب)</span>
            </button>
          </div>
        </div>

        {/* Database reset section */}
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4.5 space-y-3">
          <h4 className="text-xs font-bold text-rose-700">منطقة الصيانة وإعادة التهيئة</h4>
          <p className="text-[10px] text-rose-600 leading-relaxed">
            إذا أردت مسح كافة الفواتير والصادرات والواردات المحدثة وإعادة تحميل البيانات الأولية النموذجية (بيبسي، شوكولاتة جالاكسي، إلخ)، يمكنك النقر على الزر أدناه.
          </p>
          <button
            type="button"
            onClick={() => {
              onResetData();
              showToast('تم إعادة تهيئة البيانات الأولية الافتراضية للجرد والمستندات بنجاح!', 'success');
              onNavigate('home');
            }}
            className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
            <span>إعادة تهيئة قاعدة البيانات</span>
          </button>
        </div>

      </div>
    </div>
  );
}
