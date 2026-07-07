import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { fromMinor, toMinor } from '@/utils/money';
import { useItems } from '@/features/inventory/hooks/useItems';
import { useSettingsStore } from '@/store/settings-store';
import { documentRepository } from '@/repositories/document-repository.client';
import { NegativeStockError } from '@/repositories/document-repository';
import type { InventoryItem } from '@/features/inventory/types';
import { useDocDraft } from './useDocDraft';
import { useParties } from './useParties';
import type { DocLine, DocMode, Party } from '../types';
import type { PartyDraft } from '@/features/parties/types';

let seq = 0;
const nextId = () => `l${seq++}`;

/**
 * All state, persistence and posting logic for a sale/purchase document, shared
 * by the outgoing (sale) and incoming (purchase) screens. The screens own their
 * own JSX — this hook owns the behaviour: draft auto-save, party resolution,
 * line mutation, scan-append and ledger posting.
 */
export function useDocumentForm(mode: DocMode) {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const ns = mode === 'sale' ? 'documents.outgoing' : 'documents.incoming';

  const { items } = useItems();
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);
  const { initial: draft, persist: persistDraft, clear: clearDraft } = useDocDraft(mode);

  const { parties, create: createParty } = useParties(mode);
  const [party, setParty] = useState<Party | null>(null);
  const [chosen, setChosen] = useState(Boolean(draft.partyName));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  // Quick-add opens the party form sheet prefilled from the picker's query,
  // rather than silently creating a bare party.
  const [partyFormInitial, setPartyFormInitial] = useState<PartyDraft | null>(null);
  const [partyFormOpen, setPartyFormOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<DocLine[]>(draft.lines);
  const [saving, setSaving] = useState(false);
  const [wasRestored] = useState(draft.lines.length > 0);
  // Document date — stamped once at mount (today), not recomputed per render.
  const [docDate] = useState(() => Date.now());

  // Re-hydrate a restored party from the crash-safe buffer (name only) once the
  // DB list has loaded; no match keeps it as a walk-in tag.
  useEffect(() => {
    if (!draft.partyName || party) return;
    const match = parties.find((p) => p.name === draft.partyName);
    if (match) setParty(match);
  }, [parties, draft.partyName, party]);

  // Mirror the working buffer to MMKV on every change so an OS kill or mistap
  // mid-entry never loses input; it re-hydrates on the next mount.
  useEffect(() => {
    persistDraft({ lines, partyName: party?.name ?? null });
  }, [lines, party, persistDraft]);

  const discardDraft = () => {
    Alert.alert(t('documents.draft.discardTitle'), t('documents.draft.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('documents.draft.discardConfirm'),
        style: 'destructive',
        onPress: () => {
          setLines([]);
          setParty(null);
          setChosen(false);
          clearDraft();
        },
      },
    ]);
  };

  const total = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  const isWalkIn = chosen && party === null;

  const appendItem = (item: InventoryItem) => {
    // Sale prefills the sale price; purchase starts at 0 (owner types unit cost).
    const unitPrice = mode === 'sale' ? fromMinor(item.salePriceMinor) : 0;
    setLines((prev) => [
      ...prev,
      { id: nextId(), itemId: item.id, name: item.name, unit: item.unit, unitPrice, qty: 1 },
    ]);
  };

  // Scan path: a repeat barcode bumps the existing line instead of stacking a
  // duplicate row. Returns the resulting qty so the scanner can echo it.
  const scanAppend = useCallback(
    (item: InventoryItem) => {
      const existing = lines.find((l) => l.itemId === item.id);
      const resultQty = (existing?.qty ?? 0) + 1;
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.itemId === item.id);
        if (idx >= 0) {
          return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
        }
        const unitPrice = mode === 'sale' ? fromMinor(item.salePriceMinor) : 0;
        return [
          ...prev,
          { id: nextId(), itemId: item.id, name: item.name, unit: item.unit, unitPrice, qty: 1 },
        ];
      });
      return resultQty;
    },
    [lines, mode],
  );

  const mutateQty = (id: string, delta: number) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l)),
    );
  const setQty = (id: string, qty: number) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: Math.max(0, qty) } : l)));
  const setPrice = (id: string, unitPrice: number) =>
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, unitPrice: Math.max(0, unitPrice) } : l)));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

  const save = () => {
    if (saving) return;
    if (lines.length === 0) {
      Alert.alert(t('documents.errors.title'), t('documents.errors.noLines'));
      return;
    }
    if (lines.some((l) => l.qty <= 0)) {
      Alert.alert(t('documents.errors.title'), t('documents.errors.zeroQty'));
      return;
    }
    // Purchase unit cost feeds weighted-average valuation — never post cost 0.
    if (mode === 'purchase' && lines.some((l) => l.unitPrice <= 0)) {
      Alert.alert(t('documents.errors.title'), t('documents.errors.zeroCost'));
      return;
    }
    setSaving(true);
    try {
      documentRepository.create(
        {
          kind: mode === 'sale' ? 'outgoing' : 'incoming',
          status: 'posted',
          note: party?.name ?? undefined,
          lines: lines.map((l) => ({
            itemId: l.itemId,
            qty: l.qty,
            unitPrice: toMinor(l.unitPrice),
          })),
        },
        { allowNegative: allowNegativeStock },
      );
      clearDraft(); // posted to the ledger — the scratch buffer is done
      Alert.alert(t('documents.saved'), t('documents.savedBody'), [
        { text: t('documents.ok'), onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg =
        err instanceof NegativeStockError
          ? t('documents.errors.negativeStock')
          : String((err as Error)?.message ?? err);
      Alert.alert(t('documents.errors.title'), msg);
    } finally {
      setSaving(false);
    }
  };

  // Open the party form prefilled from the picker's query — a numeric query
  // seeds the phone field, otherwise the name.
  const openQuickAdd = (query: string) => {
    const isPhone = /^[0-9]+$/.test(query);
    setPartyFormInitial({ name: isPhone ? '' : query, phone: isPhone ? query : '' });
    setPartyFormOpen(true);
  };

  // Persist the party the form captured, then select it for this document.
  const saveQuickAdd = (draft: PartyDraft) => {
    const created = createParty({ name: draft.name.trim(), phone: draft.phone.trim() || null });
    setParty(created);
    setChosen(true);
    setPartyFormOpen(false);
  };

  const selectParty = (p: Party | null) => {
    setParty(p);
    setChosen(true);
  };

  const partyLabel = isWalkIn ? t(`${ns}.walkIn`) : party ? party.name : t(`${ns}.pickerTitle`);

  return {
    // meta
    ns,
    lang,
    docDate,
    goBack: () => navigation.goBack(),
    // data
    items,
    parties,
    lines,
    total,
    party,
    isWalkIn,
    partyLabel,
    saving,
    wasRestored,
    // dialog / mode state
    pickerOpen,
    setPickerOpen,
    itemPickerOpen,
    setItemPickerOpen,
    scanning,
    setScanning,
    partyFormOpen,
    setPartyFormOpen,
    partyFormInitial,
    // actions
    appendItem,
    scanAppend,
    mutateQty,
    setQty,
    setPrice,
    removeLine,
    save,
    discardDraft,
    openQuickAdd,
    saveQuickAdd,
    selectParty,
  };
}
