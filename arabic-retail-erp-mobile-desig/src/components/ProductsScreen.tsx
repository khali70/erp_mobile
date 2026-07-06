/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Plus, 
  Search, 
  ScanLine, 
  Package, 
  Trash2, 
  Edit,
  X,
  PlusCircle,
  Sparkles
} from 'lucide-react';
import { Product, ActiveScreen } from '../types';

interface ProductsScreenProps {
  products: Product[];
  onAddProduct: (product: Omit<Product, 'id'>) => void;
  onUpdateProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onNavigate: (screen: ActiveScreen) => void;
  onOpenScanner: () => void;
}

export default function ProductsScreen({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onNavigate,
  onOpenScanner
}: ProductsScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'low' | 'out'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New Product Form State
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('بقالة');
  const [newPrice, setNewPrice] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUnit, setNewUnit] = useState('قطعة');
  const [newThreshold, setNewThreshold] = useState('10');

  // Edit Product Form State
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editThreshold, setEditThreshold] = useState('');

  // Handle opening Edit Modal
  const handleOpenEdit = (p: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProduct(p);
    setEditName(p.name);
    setEditCategory(p.category);
    setEditPrice(p.price.toString());
    setEditQuantity(p.quantity.toString());
    setEditUnit(p.unit);
    setEditThreshold(p.lowStockThreshold.toString());
    setShowEditModal(true);
  };

  // Submit New Product
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPrice || !newQuantity) return;
    
    onAddProduct({
      name: newName,
      category: newCategory,
      price: parseFloat(newPrice),
      quantity: parseInt(newQuantity),
      unit: newUnit,
      lowStockThreshold: parseInt(newThreshold) || 10
    });

    // Reset Form
    setNewName('');
    setNewPrice('');
    setNewQuantity('');
    setNewUnit('قطعة');
    setNewThreshold('10');
    setShowAddModal(false);
  };

  // Submit Edited Product
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !editName.trim() || !editPrice || !editQuantity) return;

    onUpdateProduct({
      id: selectedProduct.id,
      name: editName,
      category: editCategory,
      price: parseFloat(editPrice),
      quantity: parseInt(editQuantity),
      unit: editUnit,
      lowStockThreshold: parseInt(editThreshold) || 10
    });

    setShowEditModal(false);
    setSelectedProduct(null);
  };

  // Category Icons Mappings (Pure Line Icons, No Emojis as requested)
  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'مشروبات': return 'bg-cyan-50 text-cyan-700 border-cyan-100';
      case 'حلويات': return 'bg-amber-50 text-amber-700 border-amber-100';
      case 'عناية': return 'bg-pink-50 text-pink-700 border-pink-100';
      case 'بقالة': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'منزلية': return 'bg-violet-50 text-violet-700 border-violet-100';
      default: return 'bg-slate-50 text-slate-700 border-slate-100';
    }
  };

  // Filter & Search Logic
  const filteredProducts = products.filter(p => {
    // Search Query (covers item name, category)
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    // Quick Filters
    if (activeFilter === 'low') {
      return p.quantity > 0 && p.quantity <= p.lowStockThreshold;
    }
    if (activeFilter === 'out') {
      return p.quantity === 0;
    }
    return true; // "all"
  });

  return (
    <div id="products-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Right side: Back Navigation and Title */}
        <div className="flex items-center gap-2.5">
          <button 
            id="back-to-home-btn"
            onClick={() => onNavigate('home')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-lg">البضائع</span>
        </div>

        {/* Left side: Add Product action */}
        <button 
          id="open-add-product-modal-btn"
          onClick={() => setShowAddModal(true)}
          className="w-9 h-9 bg-teal-800/30 hover:bg-teal-850 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <Plus className="w-5 h-5 text-white" />
        </button>
      </div>

      {/* Main Body (Scrollable Container) */}
      <div className="flex-1 flex flex-col overflow-hidden px-4 pt-3.5 space-y-4">
        
        {/* Search Input Bar */}
        <div id="search-bar-container" className="relative w-full">
          <div className="absolute inset-y-0 right-0 pl-3 pr-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-5 h-5" />
          </div>
          <input
            id="product-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الباركود"
            className="w-full bg-white text-[#0F172A] pl-11 pr-11 py-3 rounded-2xl border border-[#E2E8F0] shadow-sm text-sm focus:outline-none focus:border-[#0E7569] focus:ring-1 focus:ring-[#0E7569] transition-all text-right"
          />
          {/* Barcode Scan Icon Overlay */}
          <button 
            id="search-scan-btn"
            onClick={onOpenScanner}
            className="absolute inset-y-0 left-0 pl-3 pr-2 flex items-center text-[#0E7569] hover:text-[#08483F] transition-colors cursor-pointer"
          >
            <ScanLine className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Chips (Pills) */}
        <div id="filter-chips" className="flex gap-2 pb-1.5 select-none">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#0E7569] text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-slate-50'
            }`}
          >
            الكل
          </button>
          
          <button
            onClick={() => setActiveFilter('low')}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFilter === 'low'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-slate-50'
            }`}
          >
            منخفض المخزون
          </button>

          <button
            onClick={() => setActiveFilter('out')}
            className={`px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeFilter === 'out'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-white text-[#64748B] border border-[#E2E8F0] hover:bg-slate-50'
            }`}
          >
            نفد
          </button>
        </div>

        {/* Product Items Rows (Scrollable List) */}
        <div id="products-list-container" className="flex-1 overflow-y-auto pb-24 space-y-3 pr-0.5">
          {filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 border border-[#E2E8F0] text-center text-slate-400 text-sm flex flex-col items-center justify-center gap-3">
              <Package className="w-12 h-12 text-slate-300" />
              <span>لا توجد بضائع تطابق البحث أو التصنيف المحدد.</span>
              <button 
                onClick={() => { setSearchQuery(''); setActiveFilter('all'); }} 
                className="text-xs text-[#0E7569] font-bold underline"
              >
                إعادة ضبط التصفية
              </button>
            </div>
          ) : (
            filteredProducts.map((p) => {
              // Stock indicator states
              const isOut = p.quantity === 0;
              const isLow = !isOut && p.quantity <= p.lowStockThreshold;
              
              let badgeBg = 'bg-green-50 text-[#16A34A] border-green-100';
              let badgeText = `${p.quantity} ${p.unit}`;

              if (isOut) {
                badgeBg = 'bg-rose-50 text-[#DC2626] border-rose-100';
                badgeText = '٠ قطعة (نفد)';
              } else if (isLow) {
                badgeBg = 'bg-amber-50 text-[#EB8C17] border-amber-100';
                badgeText = `${p.quantity} ${p.unit} (منخفض)`;
              }

              return (
                <div 
                  key={p.id}
                  onClick={(e) => handleOpenEdit(p, e)}
                  className="bg-white rounded-[18px] p-3.5 border border-[#E2E8F0] hover:border-[#0E7569]/30 transition-all shadow-sm hover:shadow-md flex items-center justify-between cursor-pointer group animate-in fade-in duration-200"
                >
                  {/* Right side: Icon/Visual placeholder and product info */}
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all group-hover:scale-105 ${getCategoryColor(p.category)}`}>
                      <Package className="w-5.5 h-5.5" />
                    </div>
                    
                    <div className="flex flex-col gap-0.5 text-right">
                      <h4 className="text-sm font-semibold text-[#0F172A] group-hover:text-[#0E7569] transition-colors">{p.name}</h4>
                      <span className="text-[11px] text-[#64748B] font-medium">{p.category}</span>
                    </div>
                  </div>

                  {/* Left side: Price and stock status badge */}
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-base font-bold text-[#0F172A] tracking-tight">
                        {p.price.toLocaleString('ar-EG')} <span className="text-[10px] font-normal text-[#64748B] mr-0.5">ج.م</span>
                      </div>
                      
                      <div className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium ${badgeBg}`}>
                        {badgeText}
                      </div>
                    </div>

                    {/* Desktop Hover Quick Edit Indicator */}
                    <div className="text-[#0E7569] opacity-0 group-hover:opacity-100 transition-opacity pl-1">
                      <Edit className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: ADD NEW PRODUCT */}
      {showAddModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-base flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-teal-200" />
                إضافة بضاعة جديدة
              </span>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم الصنف البضاعة *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="مثال: بيبسي ٢ لتر، لبن كامل الدسم"
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              {/* Category & Unit in Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">القسم</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  >
                    <option value="بقالة">بقالة</option>
                    <option value="مشروبات">مشروبات</option>
                    <option value="حلويات">حلويات</option>
                    <option value="عناية">عناية</option>
                    <option value="منزلية">منزلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">وحدة القياس</label>
                  <select
                    value={newUnit}
                    onChange={(e) => setNewUnit(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="كيس">كيس</option>
                    <option value="زجاجة">زجاجة</option>
                    <option value="باكت">باكت</option>
                    <option value="كرتونة">كرتونة</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>
              </div>

              {/* Price & Quantity in Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">سعر البيع (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الكمية المتوفرة *</label>
                  <input
                    type="number"
                    required
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="0"
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  />
                </div>
              </div>

              {/* Low stock threshold */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">حد إنذار نقص المخزون</label>
                <input
                  type="number"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  placeholder="10"
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">يرسل النظام إشعارًا عندما تنخفض كمية البضاعة عن هذا الحد.</span>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm active:scale-98 cursor-pointer"
                >
                  حفظ الصنف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT / VIEW PRODUCT */}
      {showEditModal && selectedProduct && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-base flex items-center gap-2">
                <Edit className="w-5 h-5 text-teal-200" />
                تعديل الصنف: {selectedProduct.name}
              </span>
              <button 
                onClick={() => { setShowEditModal(false); setSelectedProduct(null); }}
                className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {/* Product Name */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">اسم الصنف البضاعة *</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              {/* Category & Unit in Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">القسم</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  >
                    <option value="بقالة">بقالة</option>
                    <option value="مشروبات">مشروبات</option>
                    <option value="حلويات">حلويات</option>
                    <option value="عناية">عناية</option>
                    <option value="منزلية">منزلية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">وحدة القياس</label>
                  <select
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  >
                    <option value="قطعة">قطعة</option>
                    <option value="كيس">كيس</option>
                    <option value="زجاجة">زجاجة</option>
                    <option value="باكت">باكت</option>
                    <option value="كرتونة">كرتونة</option>
                    <option value="كيلو">كيلو</option>
                  </select>
                </div>
              </div>

              {/* Price & Quantity in Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">سعر البيع (ج.م) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={editPrice}
                    onChange={(e) => setEditPrice(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">الكمية المتوفرة *</label>
                  <input
                    type="number"
                    required
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                  />
                </div>
              </div>

              {/* Low stock threshold */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">حد إنذار نقص المخزون</label>
                <input
                  type="number"
                  value={editThreshold}
                  onChange={(e) => setEditThreshold(e.target.value)}
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#0E7569] text-right"
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onDeleteProduct(selectedProduct.id);
                    setShowEditModal(false);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 bg-rose-50 text-[#DC2626] border border-rose-200 hover:bg-rose-100 font-bold py-3 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-1.5 active:scale-98 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف الصنف
                </button>
                <button
                  type="submit"
                  className="flex-2 bg-[#0E7569] hover:bg-[#08483F] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm active:scale-98 cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
