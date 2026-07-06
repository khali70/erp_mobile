import type Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

export type ExpenseCategory = 'rent' | 'salaries' | 'utilities' | 'transport' | 'other';

export interface Expense {
  id: string;
  statement: string;
  category: ExpenseCategory;
  /** Whole currency units (demo). */
  amount: number;
  /** Day of month (demo); real rows carry an epoch-ms timestamp. */
  day: number;
}

/** Per-category icon glyph + tint tokens (from src/theme/colors.js). */
export const CATEGORY_META: Record<
  ExpenseCategory,
  { icon: keyof typeof Feather.glyphMap; color: string; bgClass: string }
> = {
  rent: { icon: 'home', color: colors.info, bgClass: 'bg-info-light' },
  salaries: { icon: 'users', color: colors.accent, bgClass: 'bg-accent-light' },
  utilities: { icon: 'zap', color: colors.warning, bgClass: 'bg-warning-light' },
  transport: { icon: 'truck', color: colors.positive, bgClass: 'bg-positive-light' },
  other: { icon: 'file-text', color: colors.muted, bgClass: 'bg-background' },
};

export const DEMO_EXPENSES: Expense[] = [
  { id: 'e1', statement: 'إيجار المحل', category: 'rent', amount: 3000, day: 1 },
  { id: 'e2', statement: 'راتب عامل', category: 'salaries', amount: 1500, day: 1 },
  { id: 'e3', statement: 'فاتورة كهرباء', category: 'utilities', amount: 300, day: 4 },
  { id: 'e4', statement: 'بنزين توصيل', category: 'transport', amount: 220, day: 5 },
  { id: 'e5', statement: 'مصاريف نثرية', category: 'other', amount: 100, day: 6 },
];
