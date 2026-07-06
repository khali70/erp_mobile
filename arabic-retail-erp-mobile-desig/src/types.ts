/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  unit: string; // e.g., "قطعة", "كيس", "زجاجة", "باكت"
  lowStockThreshold: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  debt: number; // money they owe us
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  debt: number; // money we owe them
}

export interface DocumentItem {
  productId: string;
  productName: string;
  quantity: number;
  price: number; // price at the time of document creation
}

export interface Document {
  id: string;
  type: 'sale' | 'purchase' | 'adjustment'; // صادر (sale), وارد (purchase), جرد (adjustment)
  docNumber: string;
  customerName: string; // Or supplier name
  customerId?: string;
  date: string;
  items: DocumentItem[];
  totalAmount: number;
  cashPaid: number;
  debtAmount: number;
}

export interface StoreBranch {
  id: string;
  name: string;
  location: string;
  inventoryValue: number;
  monthlyProfit: number;
  monthlyProfitChange: string;
  customerDebt: number;
  supplierDebt: number;
}

export type ActiveScreen = 'home' | 'products' | 'new-sale' | 'new-purchase' | 'documents' | 'reports' | 'more' | 'customers' | 'supplier-debts' | 'cash-book' | 'expenses';
