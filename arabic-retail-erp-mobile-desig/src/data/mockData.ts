/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Customer, Supplier, Document, StoreBranch } from '../types';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'تيشرت قطني كاجوال - أسود',
    category: 'رجالي',
    price: 350,
    quantity: 48,
    unit: 'قطعة',
    lowStockThreshold: 10,
  },
  {
    id: 'p2',
    name: 'بنطلون جينز كلاسيك - كحلي',
    category: 'رجالي',
    price: 650,
    quantity: 6,
    unit: 'قطعة',
    lowStockThreshold: 8,
  },
  {
    id: 'p3',
    name: 'جاكيت شتوي نفخ - مقاوم للماء',
    category: 'رجالي',
    price: 1200,
    quantity: 0,
    unit: 'قطعة',
    lowStockThreshold: 5,
  },
  {
    id: 'p4',
    name: 'فستان سهرة ناعم - أحمر',
    category: 'حريمي',
    price: 950,
    quantity: 15,
    unit: 'قطعة',
    lowStockThreshold: 4,
  },
  {
    id: 'p5',
    name: 'هودي شتوي مبطن - قطن ١٠٠٪',
    category: 'أطفال',
    price: 450,
    quantity: 34,
    unit: 'قطعة',
    lowStockThreshold: 10,
  },
  {
    id: 'p6',
    name: 'طقم جوارب قطنية (٥ أزواج)',
    category: 'إكسسوارات',
    price: 120,
    quantity: 9,
    unit: 'طقم',
    lowStockThreshold: 12,
  },
];

export const INITIAL_CUSTOMERS: Customer[] = [
  { id: 'c1', name: 'أحمد محمود', phone: '01001234567', debt: 3200 },
  { id: 'c2', name: 'منى سعيد', phone: '01222222222', debt: 0 },
  { id: 'c3', name: 'شركة النور للتجارة', phone: '01277777777', debt: 4900 },
  { id: 'c4', name: 'خالد إبراهيم', phone: '01199999999', debt: 1300 },
  { id: 'c5', name: 'فاطمة علي', phone: '01055555555', debt: -400 },
];

export const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 's1', name: 'مصنع النيل للملابس الجاهزة', phone: '022345678', debt: 8500 },
  { id: 's2', name: 'مجموعة الفوزان للمنسوجات والاستيراد', phone: '023456789', debt: 12400 },
  { id: 's3', name: 'الشرق للمشغولات الجلدية والشنط', phone: '024567890', debt: 0 },
];

export const INITIAL_BRANCHES: StoreBranch[] = [
  {
    id: 'b1',
    name: 'المحل الرئيسي (وسط البلد)',
    location: 'شارع قصر النيل، القاهرة',
    inventoryValue: 51330,
    monthlyProfit: 24500,
    monthlyProfitChange: '▲ ٪١٢',
    customerDebt: 3750,
    supplierDebt: 20900,
  },
  {
    id: 'b2',
    name: 'فرع المعادي الكاجوال',
    location: 'شارع ٩، المعادي',
    inventoryValue: 38400,
    monthlyProfit: 16800,
    monthlyProfitChange: '▲ ٪٥',
    customerDebt: 2800,
    supplierDebt: 9400,
  },
  {
    id: 'b3',
    name: 'مخزن الملابس المركزي',
    location: 'المنطقة الصناعية، ٦ أكتوبر',
    inventoryValue: 245000,
    monthlyProfit: 0,
    monthlyProfitChange: '▼ ٪٢',
    customerDebt: 0,
    supplierDebt: 32000,
  },
];

export const INITIAL_DOCUMENTS: Document[] = [
  {
    id: 'doc1',
    type: 'sale',
    docNumber: 'SAL-2026-001',
    customerName: 'شركة النور للتجارة',
    customerId: 'c3',
    date: '2026-07-05',
    items: [
      { productId: 'p4', productName: 'فستان سهرة ناعم - أحمر', quantity: 2, price: 950 },
      { productId: 'p6', productName: 'طقم جوارب قطنية (٥ أزواج)', quantity: 2, price: 120 },
    ],
    totalAmount: 2140,
    cashPaid: 1000,
    debtAmount: 1140,
  },
  {
    id: 'doc2',
    type: 'sale',
    docNumber: 'SAL-2026-002',
    customerName: 'أحمد محمود',
    customerId: 'c1',
    date: '2026-07-04',
    items: [
      { productId: 'p2', productName: 'بنطلون جينز كلاسيك - كحلي', quantity: 1, price: 650 },
      { productId: 'p1', productName: 'تيشرت قطني كاجوال - أسود', quantity: 2, price: 350 },
    ],
    totalAmount: 1350,
    cashPaid: 1350,
    debtAmount: 0,
  },
  {
    id: 'doc3',
    type: 'purchase',
    docNumber: 'PUR-2026-001',
    customerName: 'مصنع النيل للملابس الجاهزة',
    date: '2026-07-02',
    items: [
      { productId: 'p1', productName: 'تيشرت قطني كاجوال - أسود', quantity: 100, price: 180 },
    ],
    totalAmount: 18000,
    cashPaid: 10000,
    debtAmount: 8000,
  },
  {
    id: 'doc4',
    type: 'adjustment',
    docNumber: 'ADJ-2026-001',
    customerName: 'جرد الموظف أحمد',
    date: '2026-07-01',
    items: [
      { productId: 'p2', productName: 'بنطلون جينز كلاسيك - كحلي', quantity: -2, price: 650 },
    ],
    totalAmount: -1300,
    cashPaid: 0,
    debtAmount: 0,
  },
  {
    id: 'doc5',
    type: 'adjustment',
    docNumber: 'ADJ-2026-002',
    customerName: 'تسوية الجرد السنوي',
    date: '2026-06-30',
    items: [
      { productId: 'p5', productName: 'هودي شتوي مبطن - قطن ١٠٠٪', quantity: 5, price: 450 },
    ],
    totalAmount: 2250,
    cashPaid: 0,
    debtAmount: 0,
  },
];
