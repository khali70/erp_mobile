/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Store, 
  Settings, 
  ArrowUp, 
  ArrowDown, 
  ScanLine, 
  ChevronDown, 
  ReceiptText, 
  Package, 
  Banknote, 
  BarChart3, 
  Users, 
  Truck,
  Plus,
  Coins,
  DollarSign
} from 'lucide-react';
import { Product, Customer, Supplier, Document, StoreBranch, ActiveScreen } from '../types';

interface DashboardScreenProps {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  documents: Document[];
  branches: StoreBranch[];
  selectedBranch: StoreBranch;
  onSelectBranch: (branch: StoreBranch) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenModal: (modalType: 'expenses' | 'customers' | 'suppliers' | 'scanner') => void;
}

export default function DashboardScreen({
  products,
  customers,
  suppliers,
  documents,
  branches,
  selectedBranch,
  onSelectBranch,
  onNavigate,
  onOpenModal
}: DashboardScreenProps) {
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);

  // Dynamic calculations based on current state (only for Main Store, otherwise simulated for other branches)
  const isMainStore = selectedBranch.id === 'b1';

  // Calculate live value of stock
  const liveInventoryValue = isMainStore 
    ? products.reduce((acc, p) => acc + (p.price * p.quantity), 0)
    : selectedBranch.inventoryValue;

  // Calculate live customer debt
  const liveCustomerDebt = isMainStore
    ? customers.reduce((acc, c) => acc + c.debt, 0)
    : selectedBranch.customerDebt;

  // Calculate live supplier debt
  const liveSupplierDebt = isMainStore
    ? suppliers.reduce((acc, s) => acc + s.debt, 0)
    : selectedBranch.supplierDebt;

  // Calculate dynamic monthly profit based on sales invoices and estimated margins
  const liveMonthlyProfit = isMainStore
    ? selectedBranch.monthlyProfit + documents
        .filter(d => d.type === 'sale')
        .reduce((acc, d) => acc + (d.totalAmount * 0.35), 0) // assume 35% average net profit on sales
    : selectedBranch.monthlyProfit;

  // Count of items low in stock or out of stock
  const lowStockCount = products.filter(p => p.quantity <= p.lowStockThreshold).length;

  return (
    <div id="dashboard-view" className="flex-1 flex flex-col overflow-y-auto pb-20 font-sans" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-5 px-4 shadow-md sticky top-0 z-30 transition-colors">
        <div className="flex items-center justify-between">
          
          {/* Right: Store Selector */}
          <div className="relative">
            <button 
              id="branch-selector-btn"
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 font-bold text-base focus:outline-none bg-teal-800/40 px-3 py-1.5 rounded-xl hover:bg-teal-800/60 transition-all cursor-pointer"
            >
              <Store className="w-5 h-5 text-teal-100" />
              <span>{selectedBranch.name}</span>
              <ChevronDown className={`w-4 h-4 text-teal-200 transition-transform ${showBranchDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showBranchDropdown && (
              <div id="branch-dropdown" className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 py-2 text-slate-800 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
                {branches.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSelectBranch(b);
                      setShowBranchDropdown(false);
                    }}
                    className={`w-full text-right px-4 py-2.5 hover:bg-slate-50 flex items-center justify-between transition-colors ${
                      selectedBranch.id === b.id ? 'bg-teal-50/50 text-[#0E7569] font-semibold' : ''
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{b.name}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{b.location}</span>
                    </div>
                    {selectedBranch.id === b.id && <div className="w-2 h-2 rounded-full bg-[#0E7569]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Left: Settings */}
          <button 
            id="settings-btn"
            onClick={() => onNavigate('more')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <Settings className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Subtitle */}
        <div className="mt-2.5 text-xs text-teal-100 font-light opacity-90 pr-2">
          الجرد والمخزون ببساطة
        </div>
      </div>

      <div className="px-4 py-4 space-y-5">
        
        {/* KPI Grid (2x2 Cards) */}
        <div id="kpi-grid" className="grid grid-cols-2 gap-3.5">
          
          {/* Card 1: Value of stock */}
          <div className="bg-white rounded-[20px] p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0E7569] animate-pulse" />
              <span className="text-xs text-[#64748B] font-medium">قيمة المخزون</span>
            </div>
            <div className="text-lg font-bold text-[#0F172A] tracking-tight">
              {liveInventoryValue.toLocaleString('ar-EG')} <span className="text-xs font-normal text-[#64748B] mr-0.5">ج.م</span>
            </div>
            <div className="text-[10px] text-[#0E7569] mt-1 bg-teal-50 px-2 py-0.5 rounded-md inline-block">
              قيمة البضاعة الكلية
            </div>
          </div>

          {/* Card 2: Profits */}
          <div className="bg-white rounded-[20px] p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
              <span className="text-xs text-[#64748B] font-medium">أرباح الشهر</span>
            </div>
            <div className="text-lg font-bold text-[#0F172A] tracking-tight">
              {Math.round(liveMonthlyProfit).toLocaleString('ar-EG')} <span className="text-xs font-normal text-[#64748B] mr-0.5">ج.م</span>
            </div>
            <div className="text-[10px] text-[#16A34A] font-semibold mt-1 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-md inline-block">
              <span>{selectedBranch.monthlyProfitChange}</span>
              <span>صافي الربح التقديري</span>
            </div>
          </div>

          {/* Card 3: Receivables (Customer debts) */}
          <div className="bg-white rounded-[20px] p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('customers')}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EB8C17]" />
              <span className="text-xs text-[#64748B] font-medium">ديون لك (زبائن)</span>
            </div>
            <div className="text-lg font-bold text-[#0F172A] tracking-tight">
              {liveCustomerDebt.toLocaleString('ar-EG')} <span className="text-xs font-normal text-[#64748B] mr-0.5">ج.م</span>
            </div>
            <div className="text-[10px] text-[#EB8C17] font-semibold mt-1 bg-amber-50 px-2 py-0.5 rounded-md inline-block">
              مستحقة التحصيل
            </div>
          </div>

           {/* Card 4: Payables (Supplier debts) */}
          <div className="bg-white rounded-[20px] p-4 border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => onNavigate('supplier-debts')}>
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#DC2626]" />
              <span className="text-xs text-[#64748B] font-medium">ديون عليك (موردون)</span>
            </div>
            <div className="text-lg font-bold text-[#0F172A] tracking-tight">
              {liveSupplierDebt.toLocaleString('ar-EG')} <span className="text-xs font-normal text-[#64748B] mr-0.5">ج.م</span>
            </div>
            <div className="text-[10px] text-[#DC2626] font-semibold mt-1 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
              واجبة السداد (اضغط للتفصيل)
            </div>
          </div>

        </div>

        {/* Quick Actions Row */}
        <div id="quick-actions" className="grid grid-cols-3 gap-2.5">
          
          {/* Action 1: New Invoice (Sale) */}
          <button 
            id="action-sale-btn"
            onClick={() => onNavigate('new-sale')}
            className="bg-[#0E7569] text-white rounded-2xl py-3.5 px-2 flex flex-col items-center justify-center gap-2 hover:bg-[#08483F] shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
              <ArrowUp className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-bold">صادر جديد</span>
          </button>

          {/* Action 2: New Purchase (Incoming) */}
          <button 
            id="action-purchase-btn"
            onClick={() => onNavigate('new-purchase')}
            className="bg-white text-[#0E7569] border border-[#0E7569] rounded-2xl py-3.5 px-2 flex flex-col items-center justify-center gap-2 hover:bg-[#E6F5F3] active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#E6F5F3] flex items-center justify-center">
              <ArrowDown className="w-4 h-4 text-[#0E7569]" />
            </div>
            <span className="text-xs font-bold">وارد جديد</span>
          </button>

          {/* Action 3: Barcode Scanner */}
          <button 
            id="action-barcode-btn"
            onClick={() => onOpenModal('scanner')}
            className="bg-white text-[#0F172A] border border-[#E2E8F0] rounded-2xl py-3.5 px-2 flex flex-col items-center justify-center gap-2 hover:bg-slate-50 active:scale-95 transition-all cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <ScanLine className="w-4 h-4 text-slate-600" />
            </div>
            <span className="text-xs font-bold">باركود</span>
          </button>

        </div>

        {/* Sections Header */}
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-base font-bold text-[#0F172A]">الأقسام</h3>
          <span className="text-[11px] text-[#64748B] font-medium bg-slate-100 px-2.5 py-1 rounded-full">٦ تخصصات</span>
        </div>

        {/* Menu Grid (2 rows x 3 tiles) */}
        <div id="sections-grid" className="grid grid-cols-3 gap-3">
          
          {/* Tile 1: Documents */}
          <button 
            id="tile-docs-btn"
            onClick={() => onNavigate('documents')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            {documents.length > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-[#DC2626] text-white text-[10px] font-bold w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {documents.length}
              </span>
            )}
            <div className="w-11 h-11 rounded-xl bg-[#E6F5F3] flex items-center justify-center transition-transform group-hover:scale-110">
              <ReceiptText className="w-5.5 h-5.5 text-[#0E7569]" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">المستندات</span>
          </button>

          {/* Tile 2: Goods */}
          <button 
            id="tile-goods-btn"
            onClick={() => onNavigate('products')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            {lowStockCount > 0 && (
              <span className="absolute -top-1.5 -left-1.5 bg-[#DC2626] text-white text-[10px] font-bold w-5.5 h-5.5 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                {lowStockCount}
              </span>
            )}
            <div className="w-11 h-11 rounded-xl bg-[#E6F5F3] flex items-center justify-center transition-transform group-hover:scale-110">
              <Package className="w-5.5 h-5.5 text-[#0E7569]" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">البضائع</span>
          </button>

          {/* Tile 3: Expenses */}
          <button 
            id="tile-expenses-btn"
            onClick={() => onNavigate('expenses')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center transition-transform group-hover:scale-110">
              <Banknote className="w-5.5 h-5.5 text-orange-600" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">النفقات</span>
          </button>

          {/* Tile 4: Reports */}
          <button 
            id="tile-reports-btn"
            onClick={() => onNavigate('reports')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center transition-transform group-hover:scale-110">
              <BarChart3 className="w-5.5 h-5.5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">التقارير</span>
          </button>

          {/* Tile 5: Customers */}
          <button 
            id="tile-customers-btn"
            onClick={() => onNavigate('customers')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center transition-transform group-hover:scale-110">
              <Users className="w-5.5 h-5.5 text-indigo-600" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">الزبائن</span>
          </button>

          {/* Tile 6: Suppliers */}
          <button 
            id="tile-suppliers-btn"
            onClick={() => onOpenModal('suppliers')}
            className="bg-white rounded-2xl p-3 border border-[#E2E8F0] flex flex-col items-center gap-2 text-center hover:bg-slate-50 transition-all relative cursor-pointer group"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center transition-transform group-hover:scale-110">
              <Truck className="w-5.5 h-5.5 text-amber-600" />
            </div>
            <span className="text-xs font-semibold text-[#0F172A]">الموردون</span>
          </button>

        </div>

        {/* Interactive Stats Banner */}
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between border border-slate-800 shadow-lg relative overflow-hidden">
          <div className="space-y-1 relative z-10">
            <h4 className="text-xs font-semibold text-slate-400">إحصائية التحصيل اليومي</h4>
            <div className="text-base font-bold text-teal-300">تم تحصيل ٪٧٤ من الفواتير الآجلة</div>
            <div className="w-36 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
              <div className="w-[74%] h-full bg-teal-400 rounded-full" />
            </div>
          </div>
          <Coins className="w-14 h-14 text-slate-800 absolute left-2 bottom-[-10px] transform rotate-12 z-0 opacity-60" />
        </div>

      </div>
    </div>
  );
}
