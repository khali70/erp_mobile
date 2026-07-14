// The overdraw REFUSAL, in words the owner can act on.
//
// The old message was "الكمية المطلوبة تتجاوز الرصيد المتاح." — true, useless:
// which item, how many, out of how many? A 14-line invoice gave him nothing to
// go and fix. Every violation carries `itemId / requested / available`, so the
// message names each one.
import { formatNumber } from '@/utils/numerals';
import type { NegativeStockViolation } from '@/features/inventory/posting';

/** Minimal shape of i18next's `t` — enough to interpolate, without pulling `any`. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * One consolidated message: the headline, then a line per offending item with
 * requested vs. available. Used by BOTH the client-side pre-check and the
 * repository backstop (`NegativeStockError.violations`) — same words either way.
 */
export function negativeStockMessage(
  violations: NegativeStockViolation[],
  nameOf: (itemId: string) => string,
  t: Translate,
  lang: string,
): string {
  const details = violations.map((v) =>
    t('documents.errors.negativeStockDetail', {
      name: nameOf(v.itemId),
      requested: formatNumber(v.requested, lang),
      available: formatNumber(v.available, lang),
    }),
  );
  return [t('documents.errors.negativeStock'), ...details].join('\n');
}
