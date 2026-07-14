import type Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import type { ExpenseCategory } from '@/repositories/expense-repository';

/**
 * Per-category icon glyph + tint tokens (from src/theme/colors.js).
 *
 * This file is what remains of the old `data.ts`. `DEMO_EXPENSES` is GONE —
 * expenses are real rows in a real table now, and the mock list that used to
 * live here vanished the moment closing the app stopped destroying them.
 */
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

/** An expense whose category is null (or something unknown) still renders. */
export const metaFor = (category: ExpenseCategory | null) =>
  CATEGORY_META[category ?? 'other'] ?? CATEGORY_META.other;
