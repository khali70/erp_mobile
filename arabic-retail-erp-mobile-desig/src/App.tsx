/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  Home, 
  Package, 
  ReceiptText, 
  BarChart3, 
  MoreHorizontal
} from 'lucide-react';

import { Product, Customer, Supplier, Document, StoreBranch, ActiveScreen } from './types';
import { 
  INITIAL_PRODUCTS, 
  INITIAL_CUSTOMERS, 
  INITIAL_SUPPLIERS, 
  INITIAL_BRANCHES, 
  INITIAL_DOCUMENTS 
} from './data/mockData';

import PhoneSimulator from './components/PhoneSimulator';
import DashboardScreen from './components/DashboardScreen';
import ProductsScreen from './components/ProductsScreen';
import NewSaleScreen from './components/NewSaleScreen';
import NewPurchaseScreen from './components/NewPurchaseScreen';
import DocumentsScreen from './components/DocumentsScreen';
import ReportsScreen from './components/ReportsScreen';
import MoreScreen from './components/MoreScreen';
import CustomersScreen from './components/CustomersScreen';
import SupplierDebtsScreen from './components/SupplierDebtsScreen';
import CashBookScreen from './components/CashBookScreen';
import ExpensesScreen from './components/ExpensesScreen';

import { 
  ExpensesModal, 
  CustomersModal, 
  SuppliersModal, 
  ScannerModal 
} from './components/DirectoryModals';

export default function App() {
  // Database States
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [customers, setCustomers] = useState<Customer[]>(INITIAL_CUSTOMERS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [documents, setDocuments] = useState<Document[]>(INITIAL_DOCUMENTS);
  const [branches, setBranches] = useState<StoreBranch[]>(INITIAL_BRANCHES);
  const [selectedBranch, setSelectedBranch] = useState<StoreBranch>(INITIAL_BRANCHES[0]);

  // View States
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>('home');
  const [presentationMode, setPresentationMode] = useState<'interactive' | 'side-by-side'>('interactive');

  // Modal States
  const [openModal, setOpenModal] = useState<'expenses' | 'customers' | 'suppliers' | 'scanner' | null>(null);

  // Barcode integration state
  const [scannedProductToAdd, setScannedProductToAdd] = useState<Product | null>(null);

  // Custom Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Trigger brief floating notifications
  const showToast = (message: string, type: 'success' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Reset demo databases back to seeds
  const handleResetData = () => {
    setProducts(INITIAL_PRODUCTS);
    setCustomers(INITIAL_CUSTOMERS);
    setSuppliers(INITIAL_SUPPLIERS);
    setDocuments(INITIAL_DOCUMENTS);
    setBranches(INITIAL_BRANCHES);
    setSelectedBranch(INITIAL_BRANCHES[0]);
    setActiveScreen('home');
    showToast('تم إعادة تهيئة قاعدة البيانات للمخزون والمعاملات الافتراضية!', 'success');
  };

  // Update product quantity (sales reduce stock)
  const handleUpdateProductQuantity = (productId: string, quantityToDeduct: number) => {
    setProducts(prev => prev.map(p => {
      if (p.id === productId) {
        return { ...p, quantity: Math.max(0, p.quantity - quantityToDeduct) };
      }
      return p;
    }));
  };

  // Update customer debt (sales with remaining unpaid balances)
  const handleUpdateCustomerDebt = (customerId: string, debtToAdd: number) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return { ...c, debt: c.debt + debtToAdd };
      }
      return c;
    }));
  };

  // Register cash collections from clients
  const handleCollectCustomerDebt = (customerId: string, amountToDeduct: number) => {
    setCustomers(prev => prev.map(c => {
      if (c.id === customerId) {
        return { ...c, debt: Math.max(0, c.debt - amountToDeduct) };
      }
      return c;
    }));
  };

  // Register payouts to wholesale suppliers
  const handlePaySupplierDebt = (supplierId: string, amountToDeduct: number) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === supplierId) {
        return { ...s, debt: Math.max(0, s.debt - amountToDeduct) };
      }
      return s;
    }));
  };

  // Register increase in debt owed to wholesale suppliers (purchase on credit)
  const handleUpdateSupplierDebt = (supplierId: string, debtToAdd: number) => {
    setSuppliers(prev => prev.map(s => {
      if (s.id === supplierId) {
        return { ...s, debt: s.debt + debtToAdd };
      }
      return s;
    }));
  };

  // Insert newly registered custom supplier
  const handleAddSupplier = (newSup: Omit<Supplier, 'id'>) => {
    const formatted: Supplier = {
      ...newSup,
      id: 's_' + Date.now(),
    };
    setSuppliers(prev => [...prev, formatted]);
  };

  // Insert newly registered custom product
  const handleAddProduct = (newProd: Omit<Product, 'id'> & { id?: string }) => {
    const formatted: Product = {
      ...newProd,
      id: newProd.id || 'p_' + Date.now(),
    };
    setProducts(prev => [formatted, ...prev]);
    showToast(`تم تسجيل البضاعة "${newProd.name}" بنجاح!`, 'success');
    return formatted;
  };

  // Modify existing product price/stock
  const handleUpdateProduct = (updated: Product) => {
    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
    showToast(`تم تعديل بيانات صنف البضائع "${updated.name}"`, 'success');
  };

  // Remove product
  const handleDeleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    showToast('تم حذف صنف البضاعة من المستودع بنجاح', 'info');
  };

  // Save new documents
  const handleAddDocument = (newDoc: Document) => {
    setDocuments(prev => [newDoc, ...prev]);
  };

  // Insert newly registered customer
  const handleAddCustomer = (newCust: Omit<Customer, 'id'>) => {
    const formatted: Customer = {
      ...newCust,
      id: 'c_' + Date.now(),
    };
    setCustomers(prev => [...prev, formatted]);
  };

  // Trigger scan product
  const handleScannedProductResult = (p: Product) => {
    if (activeScreen === 'products') {
      // In products screen, let's auto-filter query with scanned item
      showToast(`تم العثور على المنتج "${p.name}" في البضائع`, 'success');
    } else if (activeScreen === 'new-sale' || activeScreen === 'new-purchase') {
      // In sale/purchase document screen, let's open prompt to add it
      setScannedProductToAdd(p);
      showToast(`تم توجيه المنتج "${p.name}" للفاتورة النشطة`, 'success');
    }
  };

  // Render Active phone screen inside simulated frame
  const renderPhoneScreen = () => {
    switch (activeScreen) {
      case 'home':
        return (
          <DashboardScreen
            products={products}
            customers={customers}
            suppliers={suppliers}
            documents={documents}
            branches={branches}
            selectedBranch={selectedBranch}
            onSelectBranch={setSelectedBranch}
            onNavigate={setActiveScreen}
            onOpenModal={(type) => setOpenModal(type)}
          />
        );
      case 'products':
        return (
          <ProductsScreen
            products={products}
            onAddProduct={handleAddProduct}
            onUpdateProduct={handleUpdateProduct}
            onDeleteProduct={handleDeleteProduct}
            onNavigate={setActiveScreen}
            onOpenScanner={() => setOpenModal('scanner')}
          />
        );
      case 'new-sale':
        return (
          <NewSaleScreen
            products={products}
            customers={customers}
            suppliers={suppliers}
            onAddDocument={handleAddDocument}
            onUpdateProductQuantity={handleUpdateProductQuantity}
            onUpdateCustomerDebt={handleUpdateCustomerDebt}
            onUpdateSupplierDebt={handleUpdateSupplierDebt}
            onAddCustomer={handleAddCustomer}
            onAddSupplier={handleAddSupplier}
            onAddProduct={handleAddProduct}
            onNavigate={setActiveScreen}
            showToast={showToast}
            onOpenScanner={() => setOpenModal('scanner')}
            scannedProductToAdd={scannedProductToAdd}
            onClearScannedProduct={() => setScannedProductToAdd(null)}
          />
        );
      case 'new-purchase':
        return (
          <NewPurchaseScreen
            products={products}
            suppliers={suppliers}
            onAddDocument={handleAddDocument}
            onUpdateProductQuantity={handleUpdateProductQuantity}
            onUpdateSupplierDebt={handleUpdateSupplierDebt}
            onAddSupplier={handleAddSupplier}
            onAddProduct={handleAddProduct}
            onNavigate={setActiveScreen}
            showToast={showToast}
            onOpenScanner={() => setOpenModal('scanner')}
            scannedProductToAdd={scannedProductToAdd}
            onClearScannedProduct={() => setScannedProductToAdd(null)}
          />
        );
      case 'documents':
        return (
          <DocumentsScreen
            documents={documents}
            onNavigate={setActiveScreen}
            showToast={showToast}
          />
        );
      case 'reports':
        return (
          <ReportsScreen
            products={products}
            documents={documents}
            onNavigate={setActiveScreen}
          />
        );
      case 'more':
        return (
          <MoreScreen
            onNavigate={setActiveScreen}
            onResetData={handleResetData}
            showToast={showToast}
          />
        );
      case 'customers':
        return (
          <CustomersScreen
            customers={customers}
            onAddCustomer={handleAddCustomer}
            onCollectDebt={handleCollectCustomerDebt}
            onNavigate={setActiveScreen}
            showToast={showToast}
          />
        );
      case 'supplier-debts':
        return (
          <SupplierDebtsScreen
            suppliers={suppliers}
            onPaySupplier={handlePaySupplierDebt}
            onNavigate={setActiveScreen}
            showToast={showToast}
          />
        );
      case 'cash-book':
        return (
          <CashBookScreen
            onNavigate={setActiveScreen}
            showToast={showToast}
          />
        );
      case 'expenses':
        return (
          <ExpensesScreen
            onNavigate={setActiveScreen}
            showToast={showToast}
          />
        );
      default:
        return <DashboardScreen {...(null as any)} />;
    }
  };

  // Dynamic Metrics for Presentation side-panel
  const totalStockValue = products.reduce((acc, p) => acc + (p.price * p.quantity), 0);
  const totalCustomerReceivables = customers.reduce((acc, c) => acc + c.debt, 0);
  const activeInvoicesCount = documents.length;

  return (
    <div id="app-workspace" className="min-h-screen bg-slate-900 text-slate-100 font-sans flex items-center justify-center p-4 md:p-8 relative">
      
      {/* ==========================================
          MAIN INTERACTIVE PHONE VIEW
         ========================================== */}
      <div id="mockups-workspace" className="flex items-center justify-center py-6">
        <PhoneSimulator>
          {renderPhoneScreen()}

          {/* Fixed Bottom tab navigation inside phone frame (only shown on relevant screens) */}
          {activeScreen !== 'new-sale' && activeScreen !== 'cash-book' && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-white border-t border-[#E2E8F0] px-3 pb-2 flex items-center justify-between z-40" dir="rtl">
              {/* Tab 1: الرئيسية (Home) */}
              <button
                onClick={() => setActiveScreen('home')}
                className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
                  activeScreen === 'home' ? 'text-[#0E7569]' : 'text-[#64748B] hover:text-slate-600'
                }`}
              >
                <Home className="w-5 h-5 mb-0.5" strokeWidth={activeScreen === 'home' ? 2.5 : 1.75} />
                <span className={`text-[10px] font-bold ${activeScreen === 'home' ? 'text-[#0E7569]' : 'text-[#64748B]'}`}>الرئيسية</span>
              </button>

              {/* Tab 2: المستندات (Documents) */}
              <button
                onClick={() => setActiveScreen('documents')}
                className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all relative ${
                  activeScreen === 'documents' ? 'text-[#0E7569]' : 'text-[#64748B] hover:text-slate-600'
                }`}
              >
                {documents.length > 0 && (
                  <span className="absolute top-1 right-5 bg-red-500 text-white text-[8px] w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white font-extrabold leading-none">
                    {documents.length}
                  </span>
                )}
                <ReceiptText className="w-5 h-5 mb-0.5" strokeWidth={activeScreen === 'documents' ? 2.5 : 1.75} />
                <span className="text-[10px] font-bold">المستندات</span>
              </button>

              {/* Tab 3: البضائع (Products) */}
              <button
                onClick={() => setActiveScreen('products')}
                className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
                  activeScreen === 'products' ? 'text-[#0E7569]' : 'text-[#64748B] hover:text-slate-600'
                }`}
              >
                <Package className="w-5 h-5 mb-0.5" strokeWidth={activeScreen === 'products' ? 2.5 : 1.75} />
                <span className="text-[10px] font-bold">البضائع</span>
              </button>

              {/* Tab 4: التقارير (Reports) */}
              <button
                onClick={() => setActiveScreen('reports')}
                className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
                  (activeScreen === 'reports' || activeScreen === 'supplier-debts') ? 'text-[#0E7569]' : 'text-[#64748B] hover:text-slate-600'
                }`}
              >
                <BarChart3 className="w-5 h-5 mb-0.5" strokeWidth={(activeScreen === 'reports' || activeScreen === 'supplier-debts') ? 2.5 : 1.75} />
                <span className={`text-[10px] font-bold ${(activeScreen === 'reports' || activeScreen === 'supplier-debts') ? 'text-[#0E7569]' : 'text-[#64748B]'}`}>التقارير</span>
              </button>

              {/* Tab 5: المزيد (More) */}
              <button
                onClick={() => setActiveScreen('more')}
                className={`flex flex-col items-center justify-center flex-1 cursor-pointer transition-all ${
                  (activeScreen === 'more' || activeScreen === 'expenses') ? 'text-[#0E7569]' : 'text-[#64748B] hover:text-slate-600'
                }`}
              >
                <MoreHorizontal className="w-5 h-5 mb-0.5" strokeWidth={(activeScreen === 'more' || activeScreen === 'expenses') ? 2.5 : 1.75} />
                <span className={`text-[10px] font-bold ${(activeScreen === 'more' || activeScreen === 'expenses') ? 'text-[#0E7569]' : 'text-[#64748B]'}`}>المزيد</span>
              </button>
            </div>
          )}
        </PhoneSimulator>
      </div>

      {/* ==========================================
          GLOBAL FLOATING NOTIFICATIONS (TOASTS)
         ========================================== */}
      {toast && (
        <div id="toast-notification" className="fixed bottom-5 right-5 z-999 bg-slate-900 border border-slate-800 text-white rounded-2xl px-5 py-4 shadow-2xl flex items-center gap-3 max-w-sm animate-in slide-in-from-bottom-5 duration-300" dir="rtl">
          <div className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-ping shrink-0" />
          <span className="text-xs font-bold leading-relaxed">{toast.message}</span>
        </div>
      )}

      {/* ==========================================
          MODALS INTEGRATIONS LISTS
         ========================================== */}
      <ExpensesModal
        isOpen={openModal === 'expenses'}
        onClose={() => setOpenModal(null)}
        showToast={showToast}
      />

      <CustomersModal
        isOpen={openModal === 'customers'}
        onClose={() => setOpenModal(null)}
        customers={customers}
        onCollectDebt={handleCollectCustomerDebt}
        showToast={showToast}
      />

      <SuppliersModal
        isOpen={openModal === 'suppliers'}
        onClose={() => setOpenModal(null)}
        suppliers={suppliers}
        onPaySupplier={handlePaySupplierDebt}
        showToast={showToast}
      />

      <ScannerModal
        isOpen={openModal === 'scanner'}
        onClose={() => setOpenModal(null)}
        products={products}
        onSelectScannedProduct={handleScannedProductResult}
        showToast={showToast}
      />

    </div>
  );
}
