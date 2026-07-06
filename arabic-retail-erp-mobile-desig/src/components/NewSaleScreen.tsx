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
import { Product, Customer, Supplier, DocumentItem, Document, ActiveScreen } from '../types';

interface NewSaleScreenProps {
  products: Product[];
  customers: Customer[];
  suppliers: Supplier[];
  onAddDocument: (doc: Document) => void;
  onUpdateProductQuantity: (productId: string, quantityToDeduct: number) => void;
  onUpdateCustomerDebt: (customerId: string, debtToAdd: number) => void;
  onUpdateSupplierDebt: (supplierId: string, debtToAdd: number) => void;
  onAddCustomer: (customer: Omit<Customer, 'id'>) => void;
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onAddProduct: (product: Omit<Product, 'id'> & { id?: string }) => Product;
  onNavigate: (screen: ActiveScreen) => void;
  showToast: (message: string, type: 'success' | 'info') => void;
  onOpenScanner: () => void;
  scannedProductToAdd: Product | null;
  onClearScannedProduct: () => void;
}

export default function NewSaleScreen({
  products,
  customers,
  suppliers,
  onAddDocument,
  onUpdateProductQuantity,
  onUpdateCustomerDebt,
  onUpdateSupplierDebt,
  onAddCustomer,
  onAddSupplier,
  onAddProduct,
  onNavigate,
  showToast,
  onOpenScanner,
  scannedProductToAdd,
  onClearScannedProduct
}: NewSaleScreenProps) {
  // Mode: sale (صادر)
  const mode = 'sale';

  // Document level state
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');
  
  // Custom Partner Picker Sheet States
  const [showPartnerPickerSheet, setShowPartnerPickerSheet] = useState(false);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');
  
  // Inline Add Customer/Supplier States inside Picker Sheet
  const [showInlineAddForm, setShowInlineAddForm] = useState(false);
  const [inlineName, setInlineName] = useState('');
  const [inlinePhone, setInlinePhone] = useState('');

  // Item Editing states
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [invoiceDate, setInvoiceDate] = useState<string>('2026-07-06');
  const [invoiceItems, setInvoiceItems] = useState<DocumentItem[]>([]);
  const [cashPaidInput, setCashPaidInput] = useState<string>('1000');

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

  // Auto-switch dummy items and partner on mount
  useEffect(() => {
    setInvoiceItems([
      { productId: 'p1', productName: 'تيشرت قطني كاجوال - أسود', quantity: 2, price: 350 },
      { productId: 'p4', productName: 'فستان سهرة ناعم - أحمر', quantity: 1, price: 950 },
      { productId: 'p6', productName: 'طقم جوارب قطنية (٥ أزواج)', quantity: 3, price: 120 }
    ]);
    setCashPaidInput('1000');
    if (customers.length > 0) {
      setSelectedPartnerId(customers[0].id);
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
            price: scannedProductToAdd.price
          }
        ]);
        showToast(`تم إضافة الصنف "${scannedProductToAdd.name}" إلى الفاتورة`, 'success');
      }
      onClearScannedProduct();
    }
  }, [scannedProductToAdd, invoiceItems, onClearScannedProduct, showToast]);

  // Set default selected product and cost/price in add item modal
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
        // default price: for sale we use retail price, for purchase we default to ~60% as cost
        setNewItemPrice(mode === 'sale' ? defaultProd.price.toString() : Math.round(defaultProd.price * 0.6).toString());
      } else {
        setNewItemId('');
        setProductSearchInput('');
        setIsNewProductMode(false);
        setNewItemQty('1');
        setNewItemPrice('0');
      }
    }
  }, [products, showAddItemModal, mode, editingItemId]);

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

          // For sale, validate stock limit
          if (mode === 'sale') {
            const targetProduct = products.find(p => p.id === productId);
            if (targetProduct && delta > 0 && nextQty > targetProduct.quantity) {
              showToast(`عذرًا، الكمية المطلوبة غير متوفرة! المتبقي: ${targetProduct.quantity}`, 'info');
              return item;
            }
          }
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
        price: price,
        quantity: 0, // for sales, initial on-the-fly products are assumed to have 0 stock (will be updated or allowed as negative/service)
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

    // Check stock for sales
    if (mode === 'sale' && qty > selectedProduct.quantity) {
      showToast(`عذرًا، الكمية المتوفرة في المخزن هي: ${selectedProduct.quantity} فقط!`, 'info');
      return;
    }

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

    const currentCustomer = customers.find(c => c.id === selectedPartnerId);
    
    // If no customer selected (walk-in option)
    if (!selectedPartnerId) {
      if (debtAmount > 0) {
        showToast('لا يمكن حفظ مديونية لبيع نقدي! يرجى دفع القيمة كاملة نقدًا أو اختيار زبون لتسجيل الدين عليه.', 'info');
        return;
      }

      const newDoc: Document = {
        id: 'doc_' + Date.now(),
        type: 'sale',
        docNumber: `SAL-2026-${Math.floor(100 + Math.random() * 900)}`,
        customerName: 'بيع نقدي (بدون زبون)',
        customerId: '',
        date: invoiceDate,
        items: [...invoiceItems],
        totalAmount,
        cashPaid: totalAmount, // Paid full in cash
        debtAmount: 0
      };

      // Reduce stock
      invoiceItems.forEach(item => {
        onUpdateProductQuantity(item.productId, item.quantity);
      });

      onAddDocument(newDoc);
      showToast('تم حفظ فاتورة البيع النقدي وتحديث المخزن بنجاح!', 'success');
      onNavigate('home');
      return;
    }

    if (!currentCustomer) return;

    const newDoc: Document = {
      id: 'doc_' + Date.now(),
      type: 'sale',
      docNumber: `SAL-2026-${Math.floor(100 + Math.random() * 900)}`,
      customerName: currentCustomer.name,
      customerId: currentCustomer.id,
      date: invoiceDate,
      items: [...invoiceItems],
      totalAmount,
      cashPaid,
      debtAmount
    };

    // Reduce products stock quantity
    invoiceItems.forEach(item => {
      onUpdateProductQuantity(item.productId, item.quantity);
    });

    // Add debt to customer profile if unpaid
    if (debtAmount > 0) {
      onUpdateCustomerDebt(currentCustomer.id, debtAmount);
    }

    onAddDocument(newDoc);
    showToast('تم حفظ فاتورة البيع الصادرة وتحديث المخزن بنجاح!', 'success');
    onNavigate('home');
  };

  // Append new Customer
  const handleAddPartnerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) return;

    const newlyCreated: Customer = {
      id: 'c_' + Date.now(),
      name: newPartnerName,
      phone: newPartnerPhone || 'بدون رقم',
      debt: 0
    };
    onAddCustomer(newlyCreated);
    setSelectedPartnerId(newlyCreated.id);
    showToast(`تم إضافة الزبون "${newlyCreated.name}" واختياره`, 'success');

    setShowAddPartnerModal(false);
    setNewPartnerName('');
    setNewPartnerPhone('');
  };

  return (
    <div id="new-sale-view" className="flex-1 flex flex-col overflow-hidden font-sans bg-[#F1F5F9]" dir="rtl">
      
      {/* Top Header Bar */}
      <div className="bg-[#0E7569] text-white pt-4 pb-4 px-4 shadow-md flex items-center justify-between sticky top-0 z-30">
        
        {/* Right side: Back Arrow & Title */}
        <div className="flex items-center gap-2.5">
          <button 
            id="sale-back-btn"
            onClick={() => onNavigate('home')}
            className="w-9 h-9 bg-teal-800/30 hover:bg-teal-800/50 rounded-xl flex items-center justify-center transition-colors cursor-pointer"
          >
            <ArrowRight className="w-5 h-5 text-white" />
          </button>
          <span className="font-bold text-base">
            {mode === 'sale' ? 'صادر جديد · بيع' : 'وارد جديد · شراء'}
          </span>
        </div>

        {/* Left side: Save Document Checkmark */}
        <button 
          id="sale-header-save-btn"
          onClick={handleSaveDocument}
          className="w-9 h-9 bg-white hover:bg-teal-50 text-[#0E7569] rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
          title="حفظ المستند"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
        </button>
      </div>



      {/* Main Content Pane (Form Elements) */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4">
        
        {/* Form Field 1: Customer/Supplier Selection */}
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm space-y-2 relative">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#64748B]">
              {mode === 'sale' ? 'الزبون' : 'المورد'}
            </span>
            {/* Quick Add Partner */}
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
              <span>{mode === 'sale' ? 'زبون جديد' : 'مورد جديد'}</span>
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
              {mode === 'sale' ? (
                <User className="w-5 h-5 text-slate-400 font-bold" />
              ) : (
                <Truck className="w-5 h-5 text-slate-400 font-bold" />
              )}
              <span className={`text-xs font-black ${selectedPartnerId ? 'text-[#0E7569]' : 'text-slate-500'}`}>
                {selectedPartnerId 
                  ? (mode === 'sale' 
                      ? (customers.find(c => c.id === selectedPartnerId)?.name || 'أحمد محمود') 
                      : (suppliers.find(s => s.id === selectedPartnerId)?.name || 'مورد'))
                  : (mode === 'sale' ? 'بيع نقدي (بدون زبون)' : 'شراء نقدي (بدون مورد)')
                }
              </span>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </div>

          {/* Previous Debt Hint Below Field */}
          {selectedPartnerId && (
            <div className="text-[10px] text-slate-400 font-black px-1 flex items-center gap-1.5 mt-1">
              <span>مديونية سابقة:</span>
              <span className="text-amber-600 font-black">
                {mode === 'sale' 
                  ? `${(customers.find(c => c.id === selectedPartnerId)?.debt || 0).toLocaleString('ar-EG')} ج.م`
                  : `${(suppliers.find(s => s.id === selectedPartnerId)?.debt || 0).toLocaleString('ar-EG')} ج.م`
                }
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
            <span className="text-xs font-bold text-[#64748B] block">المحل والمستودع</span>
            <div className="relative flex items-center">
              <Store className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                readOnly
                value="المحل الرئيسي (وسط البلد)"
                className="w-full bg-slate-50 text-slate-600 pl-2 pr-8 py-2.5 rounded-xl border border-slate-100 text-xs font-bold text-right outline-none"
              />
            </div>
          </div>
        </div>

        {/* Form Section 3: Document Items List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#0F172A]">الأصناف المضافة</h3>
            <div className="flex items-center gap-2">
              {/* Scan Barcode Button */}
              <button
                id="barcode-scan-sale-btn"
                onClick={onOpenScanner}
                className="bg-[#0E7569] hover:bg-[#08483F] text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer shadow-xs active:scale-95"
                title="مسح باركود بالهاتف"
              >
                <ScanLine className="w-4.5 h-4.5 animate-bounce" />
                <span>مسح باركود</span>
              </button>

              {/* Add Item Button */}
              <button
                id="add-item-to-sale-btn"
                onClick={() => setShowAddItemModal(true)}
                className="bg-[#E6F5F3] hover:bg-teal-100 text-[#0E7569] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer animate-pulse"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صنف</span>
              </button>
            </div>
          </div>

          {/* Table / List of items inside current transaction */}
          <div id="invoice-items-list" className="space-y-2.5">
            {invoiceItems.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] text-center text-slate-400 text-xs py-10">
                لا توجد أصناف مضافة حاليًا. انقر على "إضافة صنف" لتعبئة الفاتورة.
              </div>
            ) : (
              invoiceItems.map((item) => (
                <div 
                  key={item.productId}
                  className="bg-white rounded-2xl p-3.5 border border-[#E2E8F0] shadow-xs flex flex-col gap-2.5 animate-in fade-in duration-150 text-right"
                >
                  {/* Top Row: Name and Total Cost */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex flex-col text-right">
                      <span className="text-xs font-black text-[#0F172A] leading-tight break-words">
                        {item.productName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold mt-1">
                        سعر الوحدة: {item.price.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                    
                    {/* Total Cost Badge */}
                    <div className="text-left shrink-0 flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400">الإجمالي</span>
                      <span className="text-xs font-black text-[#0E7569]">
                        {(item.price * item.quantity).toLocaleString('ar-EG')} <span className="text-[9px] font-normal text-[#64748B]">ج.م</span>
                      </span>
                    </div>
                  </div>

                  {/* Subtle Divider */}
                  <div className="border-t border-slate-100" />

                  {/* Bottom Row: Counter (Right) & Actions (Left) */}
                  <div className="flex items-center justify-between">
                    
                    {/* Interactive Counter & Qty details */}
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

                    {/* Action buttons on the left */}
                    <div className="flex items-center gap-1.5">
                      {/* Pencil Edit button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItemId(item.productId);
                          setNewItemId(item.productId);
                          setNewItemQty(item.quantity.toString());
                          setNewItemPrice(item.price.toString());
                          setShowAddItemModal(true);
                          showToast(`جاري تعديل صنف: ${item.productName}`, 'info');
                        }}
                        className="w-7 h-7 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#0E7569] flex items-center justify-center cursor-pointer transition-colors"
                        title="تعديل السعر/الكمية"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button */}
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

        {/* Calculation Summary Card: Primary-Light Background */}
        <div id="invoice-math-card" className="bg-[#E6F5F3] rounded-[24px] p-5 border border-teal-200/40 text-[#0F172A] space-y-3">
          {/* Row 1: Item Count */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>عدد الأصناف</span>
            <span className="text-[#0E7569] font-black">{invoiceItems.length} أصناف</span>
          </div>

          {/* Row 2: Paid Cash Input Field */}
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-slate-600">
              {mode === 'sale' ? 'المدفوع نقدًا' : 'المدفوع للمورد'}
            </span>
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

          {/* Row 3: Unpaid Debt balance */}
          <div className="flex justify-between items-center text-xs font-bold text-slate-600">
            <span>{mode === 'sale' ? 'المتبقّي (دَين)' : 'المتبقّي (علينا)'}</span>
            <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black ${
              debtAmount > 0 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
            }`}>
              {debtAmount === 0 ? 'خالص بالكامل' : `${debtAmount.toLocaleString('ar-EG')} ج.م`}
            </span>
          </div>

          <hr className="border-teal-200/30" />

          {/* Row 4: Large Bold Grand Total */}
          <div className="flex justify-between items-center font-black">
            <span className="text-xs text-slate-700">الإجمالي</span>
            <span className="text-base text-[#0E7569] tracking-tight">
              {totalAmount.toLocaleString('ar-EG')} <span className="text-xs font-black mr-0.5">ج.م</span>
            </span>
          </div>
        </div>

        {/* Large Action Bottom Submit Button: "حفظ المستند" */}
        <button
          id="invoice-submit-btn"
          onClick={handleSaveDocument}
          className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white font-black py-4 px-4 rounded-2xl shadow-md transition-all text-sm active:scale-98 cursor-pointer flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" strokeWidth={3} />
          <span>حفظ المستند</span>
        </button>

      </div>

      {/* MODAL 1: ADD ITEM DRAWER / MODAL */}
      {showAddItemModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-2">
                <Plus className="w-4 h-4 text-teal-200" />
                إضافة صنف إلى الفاتورة
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
              
              {/* Product list selection */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">اختر أو اكتب اسم الصنف</label>
                <div className="relative">
                  <div className="relative flex items-center">
                    <Tag className="absolute right-3 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                      type="text"
                      value={productSearchInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setProductSearchInput(val);
                        setShowProductSuggestions(true);
                        
                        // Check if it matches an existing product
                        const match = products.find(p => p.name.trim().toLowerCase() === val.trim().toLowerCase());
                        if (match) {
                          setNewItemId(match.id);
                          setIsNewProductMode(false);
                          setNewItemPrice(mode === 'sale' ? match.price.toString() : Math.round(match.price * 0.6).toString());
                        } else if (val.trim() === '') {
                          setNewItemId('');
                          setIsNewProductMode(false);
                        } else {
                          setNewItemId('new_temp');
                          setIsNewProductMode(true);
                        }
                      }}
                      onFocus={() => setShowProductSuggestions(true)}
                      placeholder="ابحث عن الصنف أو اكتب اسماً جديداً..."
                      className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl pl-16 pr-9 py-2.5 text-xs font-bold focus:outline-none focus:border-[#0E7569] text-right"
                    />
                    <ChevronDown 
                      onClick={() => setShowProductSuggestions(!showProductSuggestions)}
                      className="absolute left-3 w-4 h-4 text-slate-400 cursor-pointer" 
                    />
                    <ScanLine 
                      onClick={() => {
                        setShowAddItemModal(false);
                        onOpenScanner();
                      }}
                      className="absolute left-9 w-4 h-4 text-[#0E7569] hover:text-[#08483F] cursor-pointer"
                      title="مسح باركود بالهاتف"
                    />
                  </div>

                  {/* Suggestions Popover / List */}
                  {showProductSuggestions && (
                    <>
                      <div 
                        className="fixed inset-0 z-40 cursor-default" 
                        onClick={() => setShowProductSuggestions(false)} 
                      />
                      <div className="absolute left-0 right-0 z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                        
                        {/* Option 1: Create as new */}
                        {productSearchInput.trim() !== '' && !products.some(p => p.name.trim().toLowerCase() === productSearchInput.trim().toLowerCase()) && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewItemId('new_temp');
                              setIsNewProductMode(true);
                              setShowProductSuggestions(false);
                              showToast(`سيتم إنشاء صنف جديد باسم: "${productSearchInput.trim()}"`, 'info');
                            }}
                            className="w-full text-right p-2.5 bg-teal-50/70 hover:bg-teal-100 text-xs font-black text-[#0E7569] border-b border-slate-100 flex items-center justify-between"
                          >
                            <span>＋ إضافة كصنف جديد: «{productSearchInput}»</span>
                            <span className="text-[9px] bg-[#0E7569] text-white px-1.5 py-0.5 rounded-md font-bold">جديد</span>
                          </button>
                        )}

                        {/* Option 2: Filtered existing products */}
                        {products
                          .filter(p => p.name.toLowerCase().includes(productSearchInput.toLowerCase()))
                          .map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setNewItemId(p.id);
                                setProductSearchInput(p.name);
                                setNewItemPrice(mode === 'sale' ? p.price.toString() : Math.round(p.price * 0.6).toString());
                                setIsNewProductMode(false);
                                setShowProductSuggestions(false);
                              }}
                              className="w-full text-right p-2.5 hover:bg-slate-50 text-xs font-bold text-slate-800 border-b border-slate-100 last:border-0 block"
                            >
                              <div className="flex justify-between items-center">
                                <span className="truncate max-w-[70%]">{p.name}</span>
                                <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md shrink-0">
                                  {mode === 'sale' ? `${p.price} ج.م` : `المتوفر: ${p.quantity}`}
                                </span>
                              </div>
                            </button>
                          ))
                        }

                        {products.filter(p => p.name.toLowerCase().includes(productSearchInput.toLowerCase())).length === 0 && (
                          <div className="p-3 text-center text-slate-400 text-[10px] font-bold">
                            لا توجد بضائع تطابق هذا البحث.
                          </div>
                        )}

                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Category and Unit selection - Only visible when creating a new product on the fly */}
              {isNewProductMode && (
                <div className="bg-amber-50/50 rounded-2xl p-3.5 border border-amber-100 space-y-3.5 animate-in slide-in-from-top-2 duration-200">
                  <div className="flex items-center justify-between text-[10px] font-black text-amber-700">
                    <span>إعدادات الصنف الجديد</span>
                    <span className="bg-amber-100/80 px-2 py-0.5 rounded">صنف غير مسجل</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">الفئة</label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full bg-white text-slate-700 border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-bold text-right focus:outline-none focus:border-[#0E7569] cursor-pointer"
                      >
                        <option value="بقالة">بقالة</option>
                        <option value="مشروبات">مشروبات</option>
                        <option value="حلويات">حلويات</option>
                        <option value="عناية">عناية</option>
                        <option value="منزلية">منزلية</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">وحدة القياس</label>
                      <select
                        value={newProductUnit}
                        onChange={(e) => setNewProductUnit(e.target.value)}
                        className="w-full bg-white text-slate-700 border border-slate-200 rounded-lg px-2.5 py-2 text-[11px] font-bold text-right focus:outline-none focus:border-[#0E7569] cursor-pointer"
                      >
                        <option value="قطعة">قطعة</option>
                        <option value="علبة">علبة</option>
                        <option value="كيس">كيس</option>
                        <option value="كرتونة">كرتونة</option>
                        <option value="كيلو">كيلو</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Price / Cost field */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">
                  {mode === 'sale' ? 'سعر البيع للوحدة (ج.م)' : 'تكلفة الشراء للوحدة (ج.م)'}
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="any"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                  className="w-full bg-slate-50 text-right font-black text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#0E7569]"
                />
              </div>

              {/* Quantity input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 mb-1.5">الكمية المطلوبة</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    required
                    value={newItemQty}
                    onChange={(e) => setNewItemQty(e.target.value)}
                    className="w-full bg-slate-50 text-center font-black text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#0E7569]"
                  />
                  <span className="text-[11px] text-slate-400 font-bold min-w-16">
                    {isNewProductMode 
                      ? newProductUnit 
                      : (products.find(p => p.id === newItemId)?.unit || 'قطعة')
                    }
                  </span>
                </div>
              </div>

              {/* Total Row price display */}
              <div className="bg-slate-50 rounded-xl p-3 text-xs flex justify-between items-center text-slate-600 font-bold">
                <span>المجموع الفرعي للصنف</span>
                <span className="text-[#0E7569]">
                  {((parseFloat(newItemPrice) || 0) * (parseInt(newItemQty) || 1)).toLocaleString('ar-EG')} ج.م
                </span>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs cursor-pointer text-center"
              >
                إضافة الصنف للمستند
              </button>

            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD NEW CUSTOMER OR SUPPLIER */}
      {showAddPartnerModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl border border-slate-100 overflow-hidden animate-in zoom-in-95 duration-200">
            
            <div className="bg-[#0E7569] text-white px-5 py-4 flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-teal-200" />
                {mode === 'sale' ? 'إضافة زبون جديد للفاتورة' : 'إضافة مورد جديد للفاتورة'}
              </span>
              <button 
                onClick={() => setShowAddPartnerModal(false)}
                className="w-8 h-8 rounded-full bg-teal-800/30 hover:bg-teal-800/50 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddPartnerSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  {mode === 'sale' ? 'اسم الزبون بالكامل *' : 'اسم شركة المورد أو المصنع *'}
                </label>
                <input
                  type="text"
                  required
                  value={newPartnerName}
                  onChange={(e) => setNewPartnerName(e.target.value)}
                  placeholder={mode === 'sale' ? "مثال: مريم الأحمد" : "مثال: مصنع النيل للملابس"}
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#0E7569] text-right font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">رقم هاتف التواصل</label>
                <input
                  type="tel"
                  value={newPartnerPhone}
                  onChange={(e) => setNewPartnerPhone(e.target.value)}
                  placeholder="مثال: ٠١٠٠xxxxxxxx"
                  className="w-full bg-slate-50 text-[#0F172A] border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-[#0E7569] text-right font-semibold"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-xs cursor-pointer text-center"
              >
                حفظ الشريك الجديد واختياره
              </button>
            </form>

          </div>
        </div>
      )}

      {/* 2a. PARTNER PICKER BOTTOM SHEET */}
      {showPartnerPickerSheet && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 animate-in fade-in duration-200 text-right" dir="rtl">
          {/* Dismiss backdrop click */}
          <div className="absolute inset-0" onClick={() => setShowPartnerPickerSheet(false)} />
          
          <div className="bg-white rounded-t-[32px] w-full max-w-md shadow-2xl border-t border-slate-100 flex flex-col max-h-[85%] z-10 animate-in slide-in-from-bottom duration-300">
            {/* Sheet Header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
              <span className="font-extrabold text-xs text-slate-800 flex items-center gap-2">
                {mode === 'sale' ? <User className="w-5 h-5 text-[#0E7569]" /> : <Truck className="w-5 h-5 text-[#0E7569]" />}
                {mode === 'sale' ? 'اختر الزبون المستلم' : 'اختر المورد الموزع'}
              </span>
              <button 
                onClick={() => setShowPartnerPickerSheet(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            {/* Sheet Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              
              {/* Walk-in Cash Option Chip */}
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPartnerId('');
                    setShowPartnerPickerSheet(false);
                    showToast(mode === 'sale' ? 'تم اختيار البيع النقدي' : 'تم اختيار الشراء النقدي', 'info');
                  }}
                  className={`w-full py-2.5 px-4 rounded-xl border text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedPartnerId === ''
                      ? 'bg-[#E6F5F3] border-teal-200 text-[#0E7569]'
                      : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <Coins className="w-4 h-4" />
                  <span>{mode === 'sale' ? 'بيع نقدي (بدون زبون)' : 'شراء نقدي (بدون مورد)'}</span>
                </button>
              </div>

              {/* Inline Quick Add Form */}
              {showInlineAddForm ? (
                <div className="bg-teal-50/70 border border-teal-100 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-[#0E7569]">
                      إضافة {mode === 'sale' ? 'زبون' : 'مورد'} جديد سريع:
                    </span>
                    <button 
                      type="button"
                      onClick={() => setShowInlineAddForm(false)} 
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="الاسم بالكامل"
                      value={inlineName}
                      onChange={(e) => setInlineName(e.target.value)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-right focus:outline-none focus:border-[#0E7569]"
                    />
                    <input
                      type="tel"
                      placeholder="رقم الهاتف (اختياري)"
                      value={inlinePhone}
                      onChange={(e) => setInlinePhone(e.target.value)}
                      className="w-full bg-white text-slate-800 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-right focus:outline-none focus:border-[#0E7569]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!inlineName.trim()) {
                          showToast('يرجى إدخال اسم صحيح', 'info');
                          return;
                        }
                        if (mode === 'sale') {
                          const newCust: Customer = {
                            id: 'c_' + Date.now(),
                            name: inlineName.trim(),
                            phone: inlinePhone.trim() || 'بدون رقم',
                            debt: 0
                          };
                          onAddCustomer(newCust);
                          setSelectedPartnerId(newCust.id);
                        } else {
                          const newSup: Supplier = {
                            id: 's_' + Date.now(),
                            name: inlineName.trim(),
                            phone: inlinePhone.trim() || 'بدون رقم',
                            debt: 0
                          };
                          onAddSupplier(newSup);
                          setSelectedPartnerId(newSup.id);
                        }
                        setShowInlineAddForm(false);
                        setShowPartnerPickerSheet(false);
                        showToast(`تم إنشاء ${mode === 'sale' ? 'الزبون' : 'المورد'} واختياره بنجاح!`, 'success');
                      }}
                      className="w-full bg-[#0E7569] hover:bg-[#08483F] text-white py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1 cursor-pointer shadow-sm"
                    >
                      <Check className="w-4 h-4" strokeWidth={3} />
                      <span>تأكيد الحفظ والاختيار</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Search Bar inside sheet */}
              {!showInlineAddForm && (
                <div className="relative shrink-0">
                  <input
                    type="text"
                    value={pickerSearchQuery}
                    onChange={(e) => setPickerSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم الهاتف..."
                    className="w-full bg-slate-50 text-slate-800 pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#0E7569] text-right"
                  />
                  <Search className="absolute right-3 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}

              {/* Items List */}
              {!showInlineAddForm && (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                  {/* Quick-add row if query has no exact match */}
                  {pickerSearchQuery.trim() !== '' && (
                    <button
                      type="button"
                      onClick={() => {
                        const query = pickerSearchQuery.trim();
                        const isDigits = /^\d+$/.test(query);
                        setInlineName(isDigits ? '' : query);
                        setInlinePhone(isDigits ? query : '');
                        setShowInlineAddForm(true);
                      }}
                      className="w-full bg-slate-50 hover:bg-[#E6F5F3] border border-dashed border-slate-200 rounded-xl p-3 flex items-center gap-2.5 transition-all text-right cursor-pointer"
                    >
                      <UserPlus className="w-5 h-5 text-[#0E7569] shrink-0" />
                      <div className="flex flex-col text-right">
                        <span className="text-xs font-black text-[#0E7569]">
                          ＋ {mode === 'sale' ? 'زبون جديد:' : 'مورد جديد:'} «{pickerSearchQuery}»
                        </span>
                        <span className="text-[9px] text-slate-400 font-bold">
                          انقر لإضافة البيانات وحفظها بسرعة تلقائيًا
                        </span>
                      </div>
                    </button>
                  )}

                  {/* Filter and display existing partners */}
                  {(mode === 'sale' ? customers : suppliers)
                    .filter(item => {
                      const query = pickerSearchQuery.trim().toLowerCase();
                      if (!query) return true;
                      return item.name.toLowerCase().includes(query) || item.phone.includes(query);
                    })
                    .map(item => (
                      <div
                        key={item.id}
                        onClick={() => {
                          setSelectedPartnerId(item.id);
                          setShowPartnerPickerSheet(false);
                          showToast(`تم اختيار: ${item.name}`, 'info');
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          selectedPartnerId === item.id
                            ? 'bg-[#E6F5F3] border-teal-200'
                            : 'bg-white border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 text-right">
                          <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-bold text-xs shrink-0">
                            {item.name.charAt(0)}
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-extrabold text-slate-800">{item.name}</span>
                            <span className="text-[9px] text-slate-400 font-bold flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" />
                              <span>{item.phone}</span>
                            </span>
                          </div>
                        </div>

                        {item.debt !== 0 && (
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-600 border border-amber-100">
                            {mode === 'sale' ? 'عليه دَين:' : 'له دَين:'} {Math.abs(item.debt).toLocaleString('ar-EG')} ج.م
                          </span>
                        )}
                      </div>
                    ))
                  }
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
