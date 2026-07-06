/** Shared shapes for the document (sale/purchase) forms. Demo-level until repos. */

export type DocMode = 'sale' | 'purchase';

export interface DocLine {
  id: string;
  name: string;
  /** Whole currency units for now (demo). Sale = unit price, purchase = unit cost. */
  unitPrice: number;
  qty: number;
}

export interface Party {
  id: string;
  name: string;
  phone: string;
  /** Outstanding debt in whole currency units; 0 = settled. */
  debt: number;
}
