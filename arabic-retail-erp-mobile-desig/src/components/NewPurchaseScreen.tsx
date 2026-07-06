/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowRight, 
  Check, 
  Plus, 
  User, 
  Calendar as CalendarIcon, 
  Trash2, 
  Minus, 
  X,
  UserPlus,
  Coins,
  ChevronDown,
  Truck,
  Store,
  ChevronLeft,
  Tag,
  Pencil,
  Search,
  Phone,
  ScanLine
} from 'lucide-react';
import { Product, Supplier, DocumentItem, Document, ActiveScreen } from '../types';

interface NewPurchaseScreenProps {
  products: Product[];
  suppliers: Supplier[];
  onAddDocument: (doc: Document) => void;
  onUpdateProductQuantity: (productId: string, quantityToDeduct: number) => void;
  onUpdateSupplierDebt: (supplierId: string, debtToAdd: number) => void;
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onAddProduct: (product: Omit<Product, 'id'> & { id?: string }) => Product;
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
  onOpenScanner: () => void;
  scannedProductToAdd: Product | null;
  onClearScannedProduct: () => void;
}

export default function NewPurchaseScreen({
  products,
  suppliers,
  onAddDocument,
  onUpdateProductQuantity,
  onUpdateSupplierDebt,
  onAddSupplier,
  onAddProduct,
  onNavigate,
  showToast,
  onOpenScanner,
  scannedProductToAdd,
  onClearScannedProduct
}: NewPurchaseScreenProps) {
  // Document level state
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  
  // Custom Partner Picker Sheet States
  const [showPartnerPickerSheet, setShowPartnerPickerSheet] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  
  // Inline Add Supplier States inside Picker Sheet
  const [showInlineAddForm, setShowInlineAddForm] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');

  // Item Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>('2026-07-06');
  const [invoiceItems, setInvoiceItems] = useState<DocumentItem[]>([]);
  const [cashPaidInput, setCashPaidInput] = useState<string>('1500');

  // Interactive UI modals
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showAddPartnerModal, setShowAddPartnerModal] = useState(false);

  // Form states inside modals
  const [newItemId, setNewItemId] = useState<string>('');
  const [newItemQty, setNewItemQty] = useState<string>('1');
  const [newItemPrice, setNewItemPrice] = useState<string>('0');
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerPhone, setNewPartnerPhone] = useState('');

  // New product on-the-fly state variables
  const [productSearchInput, setProductSearchInput] = useState('');
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);
  const [isNewProductMode, setIsNewProductMode] = useState(false);
  const [newProductUnit, setNewProductUnit] = useState('قطعة');
  const [newProductCategory, setNewProductCategory] = useState('بقالة');

  // Initialize with some mock items for purchase
  useEffect(() => {
    setInvoiceItems([
      { productId: 'p1', productName: 'تيشرت قطني كاجوال - أسود', quantity: 10, price: 180 },
      { productId: 'p4', productName: 'فستان سهرة ناعم - أحمر', quantity: 5, price: 500 }
    ]);
    setCashPaidInput('1500');
    if (suppliers.length > 0) {
      setSelectedPartnerId(suppliers[0].id);
    }
  }, []);

  // Listen to scannedProductToAdd passed from parent (App.tsx)
  useEffect(() => {
    if (scannedProductToAdd) {
      const existing = invoiceItems.find(item => item.productId === scannedProductToAdd.id);
      if (existing) {
        setInvoiceItems(prev => prev.map(item => 
          item.productId === scannedProductToAdd.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
        showToast(`تم زيادة كمية الصنف "${scannedProductToAdd.name}" بالفاتورة`, 'success');
      } else {
        setInvoiceItems(prev => [
          ...prev,
          {
            productId: scannedProductToAdd.id,
            productName: scannedProductToAdd.name,
            quantity: 1,
            price: Math.round(scannedProductToAdd.price * 0.6)
          }
        ]);
        showToast(`تم إضافة الصنف "${scannedProductToAdd.name}" إلى الفاتورة وتوريده`, 'success');
      }
      onClearScannedProduct();
    }
  }, [scannedProductToAdd, invoiceItems, onClearScannedProduct, showToast]);

  // Set default selected product and cost in add item modal
  useEffect(() => {
    if (showAddItemModal) {
      if (editingItemId) {
        const editingItem = invoiceItems.find(item => item.productId === editingItemId);
        if (editingItem) {
          setNewItemId(editingItem.productId);
          setProductSearchInput(editingItem.productName);
          setIsNewProductMode(false);
          setNewItemPrice(editingItem.price.toString());
          setNewItemQty(editingItem.quantity.toString());
        }
      } else if (products.length > 0) {
        const defaultProd = products[0];
        setNewItemId(defaultProd.id);
        setProductSearchInput(defaultProd.name);
        setIsNewProductMode(false);
        setNewItemQty('1');
        // default cost/price: for purchase we default to ~60% of retail price
        setNewItemPrice(Math.round(defaultProd.price * 0.6).toString());
      } else {
        setNewItemId('');
        setProductSearchInput('');
        setIsNewProductMode(false);
        setNewItemQty('1');
        setNewItemPrice('0');
      }
    }
  }, [products, showAddItemModal, editingItemId]);

  // Math Calculations
  const totalAmount = invoiceItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  const cashPaid = parseFloat(cashPaidInput) || 0;
  const debtAmount = Math.max(0, totalAmount - cashPaid);

  // Quick quantity change on invoice rows
  const handleQtyChange = (productId: string, delta: number) => {
    setInvoiceItems(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return item; // don't go below 1
          return { ...item, quantity: nextQty };
        }
        return item;
      });
    });
  };

  // Remove item
  const handleRemoveItem = (productId: string) => {
    setInvoiceItems(prev => prev.filter(item => item.productId !== productId));
    showToast('تم حذف الصنف من المستند', 'info');
  };

  // Add Item Submit
  const handleAddItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseInt(newItemQty) || 0;
    const price = parseFloat(newItemPrice) || 0;

    if (qty <= 0) {
      showToast('يرجى تحديد كمية صحيحة أكبر من الصفر', 'info');
      return;
    }

    if (isNewProductMode) {
      if (!productSearchInput.trim()) {
        showToast('يرجى كتابة اسم الصنف الجديد أولاً', 'info');
        return;
      }

      // Check if duplicate name exists anyway
      const preExisting = products.find(p => p.name.trim().toLowerCase() === productSearchInput.trim().toLowerCase());
      if (preExisting) {
        // If it exists, just use it instead of creating duplicate!
        const existsOnInvoice = invoiceItems.some(item => item.productId === preExisting.id);
        if (existsOnInvoice) {
          showToast('هذا الصنف مضاف بالفعل للمستند! يمكنك تعديل كميته من القائمة مباشرة.', 'info');
          setShowAddItemModal(false);
          return;
        }

        const newItem: DocumentItem = {
          productId: preExisting.id,
          productName: preExisting.name,
          quantity: qty,
          price: price
        };
        setInvoiceItems(prev => [...prev, newItem]);
        setShowAddItemModal(false);
        setNewItemQty('1');
        showToast(`تمت إضافة "${preExisting.name}" بنجاح`, 'success');
        return;
      }

      // Create new product on-the-fly!
      const newProduct = onAddProduct({
        name: productSearchInput.trim(),
        category: newProductCategory,
        // retail price is estimated by adding markup to cost price
        price: Math.round(price / 0.6) || 10,
        quantity: qty, // Purchase: transaction will increment quantity
        unit: newProductUnit,
        lowStockThreshold: 10
      });

      const newItem: DocumentItem = {
        productId: newProduct.id,
        productName: newProduct.name,
        quantity: qty,
        price: price
      };

      setInvoiceItems(prev => [...prev, newItem]);
      setShowAddItemModal(false);
      setNewItemQty('1');
      setIsNewProductMode(false);
      setProductSearchInput('');
      showToast(`تم تسجيل الصنف الجديد "${newProduct.name}" بنجاح وإضافته للفاتورة`, 'success');
      return;
    }

    if (!newItemId) {
      showToast('يرجى اختيار صنف أو إدخال صنف جديد', 'info');
      return;
    }

    const selectedProduct = products.find(p => p.id === newItemId);
    if (!selectedProduct) return;

    if (editingItemId) {
      // We are editing an existing item
      setInvoiceItems(prev => prev.map(item => item.productId === editingItemId ? {
        ...item,
        quantity: qty,
        price: price
      } : item));
      setEditingItemId(null);
      setShowAddItemModal(false);
      setNewItemQty('1');
      showToast(`تم تعديل الصنف "${selectedProduct.name}" بنجاح`, 'success');
      return;
    }

    // Check duplicate
    const exists = invoiceItems.some(item => item.productId === newItemId);
    if (exists) {
      showToast('هذا الصنف مضاف بالفعل للمستند! يمكنك تعديل كميته من القائمة مباشرة.', 'info');
      setShowAddItemModal(false);
      return;
    }

    const newItem: DocumentItem = {
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      quantity: qty,
      price: price
    };

    setInvoiceItems(prev => [...prev, newItem]);
    setShowAddItemModal(false);
    setNewItemQty('1');
    showToast(`تمت إضافة "${selectedProduct.name}" بنجاح`, 'success');
  };

  // Save Document
  const handleSaveDocument = () => {
    if (invoiceItems.length === 0) {
      showToast('يرجى إضافة صنف واحد على الأقل للمستند!', 'info');
      return;
    }

    const currentSupplier = suppliers.find(s => s.id === selectedPartnerId);
    
    // If no supplier selected (walk-in option)
    if (!selectedPartnerId) {
      if (debtAmount > 0) {
        showToast('لا يمكن تسجيل مديونية علينا لشراء نقدي بدون مورد! يرجى السداد بالكامل أو تحديد مورد لتسجيل الدين له.', 'info');
        return;
      }

      const newDoc: Document = {
        id: 'doc_' + Date.now(),
        type: 'purchase',
        docNumber: `PUR-2026-${Math.floor(100 + Math.random() * 900)}`,
        customerName: 'شراء نقدي (بدون مورد)',
        customerId: '',
        date: invoiceDate,
        items: [...invoiceItems],
        totalAmount,
        cashPaid: totalAmount,
        debtAmount: 0
      };

      // Increase products stock quantity
      invoiceItems.forEach(item => {
        onUpdateProductQuantity(item.productId, -item.quantity);
      });

      onAddDocument(newDoc);
      showToast('تم حفظ فاتورة الشراء النقدي وتوريد البضاعة بنجاح!', 'success');
      onNavigate('home');
      return;
    }

    if (!currentSupplier) return;

    const newDoc: Document = {
      id: 'doc_' + Date.now(),
      type: 'purchase',
      docNumber: `PUR-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: currentSupplier.name,
      customerId: currentSupplier.id,
      date: invoiceDate,
      items: [...invoiceItems],
      totalAmount,
      cashPaid,
      debtAmount
    };

    // Increase products stock quantity
    invoiceItems.forEach(item => {
      onUpdateProductQuantity(item.productId, -item.quantity);
    });

    // Add debt to supplier profile if unpaid (we owe supplier)
    if (debtAmount > 0) {
      onUpdateSupplierDebt(currentSupplier.id, debtAmount);
    }

    onAddDocument(newDoc);
    showToast('تم حفظ فاتورة الشراء الواردة وتزويد المستودع بالبضائع بنجاح!', 'success');
    onNavigate('home');
  };

  // Append new Supplier
  const handleAddPartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;

    const newlyCreated: Supplier = {
      id: 's_' + Date.now(),
      name: newPartnerName,
      phone: newPartnerPhone || 'بدون رقم',
      debt: 0
    };
    onAddSupplier(newlyCreated);
    setSelectedPartnerId(newlyCreated.id);
    showToast(`تم إضافة المورد "${newlyCreated.name}" واختياره`, 'success');

    setShowAddPartnerModal(false);
    setNewPartnerName('');
    setNewPartnerPhone('');
  };

  const handleInlineAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inlineName.trim()) return;

    const newlyCreated: Supplier = {
      id: 's_' + Date.now(),
      name: inlineName,
      phone: inlinePhone || 'بدون رقم',
      debt: 0
    };
    onAddSupplier(newlyCreated);
    setSelectedPartnerId(newlyCreated.id);
    showToast(`تم إضافة المورد "${newlyCreated.name}" بنجاح واختياره`, 'success');
    
    setInlineName('');
    setInlinePhone('');
    setShowInlineAddForm(false);
    setShowPartnerPickerSheet(false);
  };

  // Filtered suppliers for sheet list search
  const filteredSuppliers = suppliers.filter(s => 
    s.name.includes(pickerSearchQuery) || s.phone.includes(pickerSearchQuery)
  );

  return (
    <div id="new-purchase-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Right: Back Arrow & Title */}
        <div className="flex items-center gap-2.5">
          <button 
            id="purchase-back-btn"
            onClick={() => onNavigate('home')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">
            وارد جديد · فاتورة مشتريات
          </span>
        </div>

        {/* Left: Save Document */}
        <button 
          id="purchase-header-save-btn"
          onClick={handleSaveDocument}
          className="w-9 h-9 bg-white hover:bg-teal-50 text-[#0E7569] rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
          title="حفظ فاتورة الشراء"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
        </button>
      </div>

      {/* Main Content Form Pane */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
        
        {/* Form Field 1: Supplier Selection */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B]">المورد</span>
            
            <button
              onClick={() => {
                setInlineName('');
                setInlinePhone('');
                setShowInlineAddForm(true);
                setShowPartnerPickerSheet(true);
              }}
              className="text-[#0E7569] hover:text-[#08483F] text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>مورد جديد</span>
            </button>
          </div>
          
          <div 
            onClick={() => {
              setPickerSearchQuery('');
              setShowInlineAddForm(false);
              setShowPartnerPickerSheet(true);
            }}
            className="relative flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 cursor-pointer hover:bg-slate-100/70 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Truck className="w-5 h-5 text-slate-400 font-bold" />
              <span className={`text-xs font-black ${selectedPartnerId ? 'text-[#0E7569]' : 'text-slate-500'}`}>
                {selectedPartnerId 
                  ? (suppliers.find(s => s.id === selectedPartnerId)?.name || 'مورد')
                  : 'شراء نقدي (بدون مورد)'
                }
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>

          {/* Supplier Debt Hint */}
          {selectedPartnerId && (
            <div className="text-[10px] text-slate-400 font-black px-1 flex items-center gap-1.5 mt-1">
              <span>مديونية سابقة للمورد علينا:</span>
              <span className="text-amber-600 font-black">
                {`${(suppliers.find(s => s.id === selectedPartnerId)?.debt || 0).toLocaleString('ar-EG')} ج.م`}
              </span>
            </div>
          )}
        </div>

        {/* Form Field 2: Date Selector & Branch */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm space-y-2">
            <span className="text-xs font-bold text-[#64748B] block">التاريخ</span>
            <div className="relative flex items-center">
              <CalendarIcon className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full bg-slate-50 text-[#0F172A] pl-2 pr-8 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-[#0E7569] text-right cursor-pointer"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm space-y-2">
            <span className="text-xs font-bold text-[#64748B] block">المستودع والمخزن</span>
            <div className="relative flex items-center">
              <Store className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                readOnly
                value="المستودع الرئيسي"
                className="w-full bg-slate-50 text-slate-600 pl-2 pr-8 py-2.5 rounded-xl border border-slate-100 text-xs font-bold text-right outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Section 3: Document Items List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A]">الأصناف المشتراة</h3>
            <div className="flex items-center gap-2">
              {/* Scan Barcode Button */}
              <button
                id="barcode-scan-purchase-btn"
                onClick={onOpenScanner}
                className="bg-[#0E7569] hover:bg-[#08483F] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                title="مسح باركود بالهاتف"
              >
                <ScanLine className="w-4.5 h-4.5 animate-bounce" />
                <span>مسح باركود</span>
              </button>

              {/* Add Item Button */}
              <button
                id="add-item-to-purchase-btn"
                onClick={() => setShowAddItemModal(true)}
                className="bg-[#E6F5F3] hover:bg-teal-100 text-[#0E7569] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف</span>
              </button>
            </div>
          </div>

          <div id="invoice-items-list" className="space-y-2.5">
            {invoiceItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] text-center text-slate-400 text-xs py-10">
                لا توجد أصناف مضافة حاليًا. انقر على "إضافة صنف" لتسجيل المشتريات.
              </div>
            ) : (
              invoiceItems.map((item) => (
                <div 
                  key={item.productId}
                  className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex flex-col gap-2.5 text-right animate-in fade-in duration-150"
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-[#0F172A] leading-tight break-words">
                        {item.productName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">
                        تكلفة الوحدة: {item.price.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                    
                    <div className="text-left shrink-0 flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400">تكلفة الصنف</span>
                      <span className="text-xs font-black text-[#0E7569]">
                        {(item.price * item.quantity).toLocaleString('ar-EG')} <span className="text-[9px] font-normal text-[#64748B]">ج.م</span>
                      </span>
                    </div>
                  </div>

                  <div className="border-t border-slate-100" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.productId, -1)}
                          className="w-5.5 h-5.5 rounded bg-white flex items-center justify-center text-slate-500 hover:bg-slate-50 transition-colors cursor-pointer shadow-xs active:scale-90"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="text-[11px] font-black px-1.5 text-slate-800 min-w-5 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQtyChange(item.productId, 1)}
                          className="w-5.5 h-5.5 rounded bg-white flex items-center justify-center text-[#0E7569] hover:bg-slate-50 transition-colors cursor-pointer shadow-xs active:scale-90"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(item.productId);
                          setNewItemId(item.productId);
                          setNewItemQty(item.quantity.toString());
                          setNewItemPrice(item.price.toString());
                          setShowAddItemModal(true);
                          showToast(`جاري تعديل تكلفة صنف: ${item.productName}`, 'info');
                        }}
                        className="w-7 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0E7569] flex items-center justify-center cursor-pointer transition-colors"
                        title="تعديل السعر/الكمية"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.productId)}
                        className="w-7 h-7 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 flex items-center justify-center cursor-pointer transition-colors"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Calculation Summary Card */}
        <div id="invoice-math-card" className="bg-[#E6F5F3] rounded-[24px] p-5 border border-teal-200/40 text-[#0F172A] space-y-3">
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>عدد الأصناف المستوردة</span>
            <span className="text-[#0E7569] font-black">{invoiceItems.length} أصناف</span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">المدفوع نقداً للمورد</span>
            <div className="relative flex items-center max-w-[120px]">
              <input
                id="invoice-paid-input"
                type="text"
                value={cashPaidInput}
                onChange={(e) => setCashPaidInput(e.target.value.replace(/[^0-9.]/g, ''))}
                className="w-full bg-white text-left font-black text-slate-800 pl-3 pr-8 py-1.5 rounded-xl border border-teal-200/60 focus:outline-none focus:border-[#0E7569] text-xs leading-none"
              />
              <span className="absolute right-2.5 text-[9px] font-black text-slate-400">ج.م</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>المتبقي ذمة (للمورد)</span>
            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
              debtAmount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
            }`}>
              {debtAmount === 0 ? 'خالص بالكامل' : `${debtAmount.toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>

          <hr className="border-teal-200/30" />

          <div className="flex justify-between items-center font-black">
            <span className="text-xs text-slate-700">تكلفة المشتريات الإجمالية</span>
            <span className="text-base text-[#0E7569] tracking-tight">
              {totalAmount.toLocaleString('ar-EG')} <span className="text-xs font-black mr-0.5">ج.م</span>
            </span>
          </div>
        </div>

        {/* Large Action Bottom Submit Button */}
        <button
          id="invoice-submit-btn"
          onClick={handleSaveDocument}
          className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white font-black py-4 px-4 rounded-2xl shadow-md transition-all text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
          <span>حفظ فاتورة الشراء</span>
        </button>

      </div>

      {/* MODAL 1: ADD ITEM DRAWER */}
      {showAddItemModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-200" />
                تحديد الصنف المشتري وتكلفته
              </span>
              <button 
                onClick={() => {
                  setShowAddItemModal(false);
                  setEditingItemId(null);
                  setIsNewProductMode(false);
                  setProductSearchInput('');
                }}
                className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddItemSubmit} className="p-5 space-y-4">
              
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">اختر أو اكتب اسم الصنف</label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Tag className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="البحث عن الصنف بالاسم أو الباركود..."
                      value={productSearchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductSearchInput(val);
                        setShowProductSuggestions(true);
                        
                        const exactMatch = products.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                        if (exactMatch) {
                          setNewItemId(exactMatch.id);
                          setNewItemPrice(Math.round(exactMatch.price * 0.6).toString());
                          setIsNewProductMode(false);
                        } else {
                          setIsNewProductMode(true);
                        }
                      }}
                      onFocus={() => setShowProductSuggestions(true)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl pl-12 pr-10 py-2.5 text-xs font-bold focus:outline-none focus:border-[#0E7569] text-right"
                    />
                    <ScanLine 
                      onClick={() => {
                        setShowAddItemModal(false);
                        onOpenScanner();
                      }}
                      className="absolute left-3.5 w-4.5 h-4.5 text-[#0E7569] hover:text-[#08483F] cursor-pointer"
                      title="مسح باركود بالهاتف"
                    />
                  </div>

                  {/* Suggestions Dropdown */}
                  {showProductSuggestions && productSearchInput.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-40 overflow-y-auto z-50 py-1.5">
                      {products
                        .filter(p => p.name.includes(productSearchInput))
                        .map(p => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setNewItemId(p.id);
                              setProductSearchInput(p.name);
                              setNewItemPrice(Math.round(p.price * 0.6).toString());
                              setIsNewProductMode(false);
                              setShowProductSuggestions(false);
                            }}
                            className="w-full text-right px-4 py-2 hover:bg-slate-50 flex items-center justify-between text-xs font-bold transition-all"
                          >
                            <span className="text-slate-800">{p.name}</span>
                            <span className="text-[#0E7569] font-mono text-[10px]">
                              {p.quantity} {p.unit} متوفرة
                            </span>
                          </button>
                        ))
                      }
                      
                      {/* Let them quickly type/create new product on-the-fly */}
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewProductMode(true);
                          setShowProductSuggestions(false);
                          showToast(`وضع تسجيل صنف جديد: "${productSearchInput}"`, 'info');
                        }}
                        className="w-full text-right px-4 py-2 hover:bg-emerald-50 text-emerald-600 flex items-center gap-1 text-xs font-black border-t border-slate-100 mt-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>تسجيل صنف جديد باسم "{productSearchInput}"</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Fields if this is a new on-the-fly product being purchased */}
              {isNewProductMode && (
                <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100/50 space-y-2.5 animate-in slide-in-from-top-2 duration-150">
                  <div className="text-[10px] font-black text-emerald-700">مواصفات الصنف الجديد المضاف:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">وحدة القياس</label>
                      <select
                        value={newProductUnit}
                        onChange={(e) => setNewProductUnit(e.target.value)}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold focus:outline-none focus:border-[#0E7569] text-right cursor-pointer"
                      >
                        <option value="قطعة">قطعة</option>
                        <option value="كيس">كيس</option>
                        <option value="زجاجة">زجاجة</option>
                        <option value="باكت">باكت</option>
                        <option value="علبة">علبة</option>
                        <option value="كيلو">كيلو</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-slate-500 mb-1">فئة الصنف</label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full bg-white text-slate-800 border border-slate-200 rounded-lg px-2 py-1.5 text-[10px] font-bold focus:outline-none focus:border-[#0E7569] text-right cursor-pointer"
                      >
                        <option value="ملابس">ملابس</option>
                        <option value="أحذية">أحذية</option>
                        <option value="بقالة">بقالة</option>
                        <option value="إلكترونيات">إلكترونيات</option>
                        <option value="أخرى">أخرى</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5">الكمية المشتراة</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-right focus:outline-none focus:border-[#0E7569]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1.5">سعر التكلفة (ج.م)</label>
                  <input
                    type="number"
                    required
                    min={0.01}
                    step="any"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-black text-right focus:outline-none focus:border-[#0E7569]"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-[#0E7569] hover:bg-[#08483F] text-white py-3 rounded-xl text-xs font-black shadow-xs transition-colors cursor-pointer"
                >
                  {editingItemId ? 'تحديث الصنف' : 'إضافة للفاتورة'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddItemModal(false);
                    setEditingItemId(null);
                    setIsNewProductMode(false);
                    setProductSearchInput('');
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl text-xs font-black transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PARTNER PICKER SHEET (Bottom Drawer Style) */}
      {showPartnerPickerSheet && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 animate-in fade-in duration-200 text-right" dir="rtl">
          <div className="bg-white rounded-t-[32px] w-full max-w-sm shadow-2xl max-h-[85%] flex flex-col animate-in slide-in-from-bottom duration-250">
            
            {/* Handle Bar */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 shrink-0" />

            <div className="px-5 pb-3 flex items-center justify-between shrink-0">
              <span className="font-extrabold text-slate-800 text-sm">اختيار المورد المستهدف</span>
              <button 
                onClick={() => setShowPartnerPickerSheet(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* List Suppliers or Add Form */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 space-y-4">
              
              {showInlineAddForm ? (
                /* INLINE FORM TO QUICK ADD SUPPLIER */
                <form onSubmit={handleInlineAddSupplier} className="bg-slate-50 p-4 rounded-2xl border border-slate-200/60 space-y-3 animate-in fade-in duration-150">
                  <span className="font-extrabold text-xs text-[#0E7569] block">تسجيل حساب مورد جديد سريع:</span>
                  
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">اسم المورد / الشركة</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: مخازن الهدى لتجارة الجملة"
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1">رقم الهاتف / المحمول</label>
                    <input
                      type="text"
                      placeholder="01xxxxxxxxx"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-[#0E7569] text-right"
                    />
                  </div>

                  <div className="flex gap-2 pt-1.5">
                    <button
                      type="submit"
                      className="flex-1 bg-[#0E7569] hover:bg-[#08483F] text-white py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      حفظ واختيار
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowInlineAddForm(false)}
                      className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-600 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      تراجع
                    </button>
                  </div>
                </form>
              ) : (
                /* NORMAL LIST WITH SEARCH */
                <div className="space-y-3.5">
                  <div className="relative">
                    <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="البحث بالاسم أو رقم الهاتف..."
                      value={pickerSearchQuery}
                      onChange={(e) => setPickerSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-xs font-bold focus:outline-none focus:border-[#0E7569] text-right"
                    />
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {/* Walk-in purchase (Without Supplier) */}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPartnerId('');
                        setShowPartnerPickerSheet(false);
                      }}
                      className={`w-full text-right p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        selectedPartnerId === ''
                          ? 'border-[#0E7569] bg-teal-50/50 text-[#0E7569]'
                          : 'border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Truck className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-black">شراء نقدي مباشر (بدون مورد)</span>
                      </div>
                      {selectedPartnerId === '' && <div className="w-2.5 h-2.5 rounded-full bg-[#0E7569]" />}
                    </button>

                    {filteredSuppliers.map(sup => (
                      <button
                        key={sup.id}
                        type="button"
                        onClick={() => {
                          setSelectedPartnerId(sup.id);
                          setShowPartnerPickerSheet(false);
                        }}
                        className={`w-full text-right p-3.5 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                          selectedPartnerId === sup.id
                            ? 'border-[#0E7569] bg-teal-50/40 text-[#0E7569]'
                            : 'border-slate-150/60 bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-black text-slate-800">{sup.name}</span>
                          <span className="text-[10px] text-slate-400 font-bold mt-0.5">الهاتف: {sup.phone}</span>
                        </div>
                        {selectedPartnerId === sup.id && <div className="w-2.5 h-2.5 rounded-full bg-[#0E7569]" />}
                      </button>
                    ))}

                    {filteredSuppliers.length === 0 && (
                      <div className="text-center text-slate-400 py-6 text-xs font-bold">
                        لا توجد نتائج تطابق البحث.
                      </div>
                    )}
                  </div>

                  {/* Add supplier CTA */}
                  <button
                    type="button"
                    onClick={() => setShowInlineAddForm(true)}
                    className="w-full py-3 border border-dashed border-[#0E7569]/40 rounded-xl text-[#0E7569] bg-teal-50/30 hover:bg-teal-50 text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>مورد غير مسجل؟ سجله الآن</span>
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
