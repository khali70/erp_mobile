import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { evaluateNumeric } from '@/utils/mathInput';
import { formatMoneyMajor, formatNumber } from '@/utils/numerals';
import type { DocLine, DocMode } from '../types';
import { editLineFields } from '../utils/editLineFields';

/** Free-typed numeric → finite number; empty / malformed → 0 (never NaN). */
const parseNum = (text: string): number => {
  const n = evaluateNumeric(text);
  return Number.isFinite(n) ? n : 0;
};

export interface EditLineDraft {
  name: string;
  qty: string;
  unitPrice: string;
  category: string;
  tags: string[];
  note: string;
}

export interface EditLineErrors {
  name?: string;
  qty?: string;
  unitPrice?: string;
}

/**
 * The Edit-Line sheet's local draft + validation. All business rules live here,
 * never in the sheet JSX: which fields exist (direction config), how a typed
 * string parses, and every guard the inline controls enforce — qty > 0, unit
 * price ≥ 0, the negotiable-sale min-price floor, and the sale over-stock ceiling.
 *
 * The draft re-seeds whenever a different line is targeted (or the sheet reopens),
 * so it always mirrors the line's CURRENT values on open and a cancelled edit
 * leaves nothing behind.
 */
export function useEditLineDraft(
  line: DocLine | null,
  mode: DocMode,
  /** Sale qty ceiling for this line; null/undefined = unbounded. */
  maxQty: number | null | undefined,
) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const fields = editLineFields(mode);

  const [draft, setDraft] = useState<EditLineDraft>(() => seed(line));

  // Re-seed on every (re)open or target change. Keyed on id so retargeting to a
  // different row refills, but typing into the open sheet does not stomp itself.
  useEffect(() => {
    setDraft(seed(line));
  }, [line?.id]);

  const setField = <K extends keyof EditLineDraft>(field: K, value: EditLineDraft[K]) =>
    setDraft((prev) => ({ ...prev, [field]: value }));

  const qty = parseNum(draft.qty);
  const unitPrice = parseNum(draft.unitPrice);
  const bounded = maxQty !== null && maxQty !== undefined;

  const errors = useMemo<EditLineErrors>(() => {
    const e: EditLineErrors = {};
    if (fields.includes('name') && draft.name.trim() === '') {
      e.name = t('documents.editLine.errors.name');
    }
    if (fields.includes('qty') && qty <= 0) {
      e.qty = t('documents.editLine.errors.qty');
    } else if (fields.includes('qty') && bounded && qty > (maxQty as number)) {
      // Same over-stock feedback the inline row shows (sales only).
      e.qty = t('documents.qtyOverStock', {
        requested: formatNumber(qty, lang),
        available: formatNumber(maxQty as number, lang),
      });
    }
    if (fields.includes('unitPrice') && unitPrice < 0) {
      e.unitPrice = t('documents.editLine.errors.unitPrice');
    } else if (
      // Negotiable sale lines carry a soft floor; the sheet enforces it exactly
      // like the inline price control's rule (line.minPrice, major units).
      mode === 'sale' &&
      fields.includes('unitPrice') &&
      line?.pricingMode === 'negotiable' &&
      line.minPrice !== undefined &&
      unitPrice < line.minPrice
    ) {
      e.unitPrice = t('documents.editLine.errors.belowMin', {
        min: formatMoneyMajor(line.minPrice, lang),
      });
    }
    return e;
  }, [fields, draft.name, qty, unitPrice, bounded, maxQty, mode, line, t, lang]);

  const isValid = Object.keys(errors).length === 0;

  /** The subset of DocLine fields this direction is allowed to change. */
  const buildPatch = (): Partial<DocLine> => {
    const patch: Partial<DocLine> = {};
    if (fields.includes('name')) patch.name = draft.name.trim();
    if (fields.includes('qty')) patch.qty = qty;
    if (fields.includes('unitPrice')) patch.unitPrice = unitPrice;
    if (fields.includes('category')) patch.category = draft.category.trim() || undefined;
    if (fields.includes('tags')) patch.tags = draft.tags.length ? draft.tags : undefined;
    if (fields.includes('note')) patch.note = draft.note.trim() || undefined;
    return patch;
  };

  return { fields, draft, setField, errors, isValid, buildPatch };
}

const seed = (line: DocLine | null): EditLineDraft => ({
  name: line?.name ?? '',
  qty: line && line.qty ? String(line.qty) : '',
  unitPrice: line && line.unitPrice ? String(line.unitPrice) : '',
  category: line?.category ?? '',
  tags: line?.tags ?? [],
  note: line?.note ?? '',
});
