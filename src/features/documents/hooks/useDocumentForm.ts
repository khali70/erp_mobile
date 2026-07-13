import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { fromMinor, toMinor } from '@/utils/money';
import { parseStockCsv, parseAmount, type ImportRow } from '../utils/importStock';
import { useItems } from '@/features/inventory/hooks/useItems';
import { useSettingsStore } from '@/store/settings-store';
import { documentRepository } from '@/repositories/document-repository.client';
import {
  NegativeStockError,
  type DocumentLineInput,
  type AttachmentMeta,
} from '@/repositories/document-repository';
import { attachmentRepository } from '@/repositories/attachment-repository';
import { itemRepository } from '@/repositories/item-repository.client';
import { tagRepository } from '@/repositories/tag-repository.client';
import { pickPhoto, pickFile, ingest, removeAttachment as removeAttachmentFile } from '../utils/attachments';
import type { InventoryItem } from '@/features/inventory/types';
import { useDocDraft } from './useDocDraft';
import { useParties } from './useParties';
import type { DocLine, DocMode, Party, QuickEntryValues, QuickEntryLocks } from '../types';
import type { PartyDraft } from '@/features/parties/types';

let seq = 0;
const nextId = () => `l${seq++}`;

const EMPTY_QUICK: QuickEntryValues = {
  category: '',
  title: '',
  price: '',
  qty: '',
  tags: [],
  note: '',
};
const NO_LOCKS: QuickEntryLocks = {
  category: false,
  title: false,
  price: false,
  qty: false,
  tags: false,
  note: false,
};
const normKey = (s: string) => s.trim().toLowerCase();

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
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [lines, setLines] = useState<DocLine[]>(draft.lines);
  const [note, setNote] = useState(draft.note ?? '');
  const [attachments, setAttachments] = useState<AttachmentMeta[]>(draft.attachments ?? []);
  const [saving, setSaving] = useState(false);
  const [wasRestored] = useState(draft.lines.length > 0);
  // Fast-entry: 'list' picks from the catalog; 'quick' types title/price/qty
  // with per-field locks. Values + locks restore from the draft buffer.
  const [entryMode, setEntryMode] = useState<'list' | 'quick'>('list');
  const [quick, setQuick] = useState<QuickEntryValues>(draft.quick?.values ?? EMPTY_QUICK);
  const [locks, setLocks] = useState<QuickEntryLocks>(draft.quick?.locks ?? NO_LOCKS);
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
    persistDraft({
      lines,
      partyName: party?.name ?? null,
      note,
      attachments,
      quick: { values: quick, locks },
    });
  }, [lines, party, note, attachments, quick, locks, persistDraft]);

  // Receipt attachments: pick → compress/store bytes immediately → track metadata.
  const addPhoto = useCallback(async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    try {
      const meta = await ingest(picked);
      setAttachments((prev) => [...prev, meta]);
    } catch (err) {
      Alert.alert(t('documents.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const addFile = useCallback(async () => {
    const picked = await pickFile();
    if (!picked) return;
    try {
      const meta = await ingest(picked);
      setAttachments((prev) => [...prev, meta]);
    } catch (err) {
      Alert.alert(t('documents.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const removeAttachment = useCallback((id: string) => {
    removeAttachmentFile(id);
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const discardDraft = () => {
    Alert.alert(t('documents.draft.discardTitle'), t('documents.draft.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('documents.draft.discardConfirm'),
        style: 'destructive',
        onPress: () => {
          attachments.forEach((a) => removeAttachmentFile(a.id));
          setLines([]);
          setParty(null);
          setChosen(false);
          setNote('');
          setAttachments([]);
          setQuick(EMPTY_QUICK);
          setLocks(NO_LOCKS);
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

  const setQuickField = useCallback(
    <K extends keyof QuickEntryValues>(field: K, value: QuickEntryValues[K]) =>
      setQuick((prev) => ({ ...prev, [field]: value })),
    [],
  );
  const toggleLock = useCallback(
    (field: keyof QuickEntryValues) => setLocks((prev) => ({ ...prev, [field]: !prev[field] })),
    [],
  );

  // Existing catalog names matching the typed title (find-or-create hint).
  const titleSuggestions = useMemo(() => {
    const q = normKey(quick.title);
    if (!q) return [];
    return items
      .filter((i) => i.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((i) => i.name);
  }, [items, quick.title]);

  // Fast-entry add: an ad-hoc line (itemId resolved at save via find-or-create).
  // A repeat title+category bumps qty; then unlocked fields clear for the next.
  const addQuickLine = useCallback(() => {
    const title = quick.title.trim();
    if (!title) return;
    const price = Math.max(0, parseFloat(quick.price) || 0);
    const qty = Math.max(1, parseInt(quick.qty, 10) || 1);
    const category = quick.category || undefined;
    const tags = quick.tags.length ? quick.tags : undefined;
    const note = quick.note.trim() || undefined;

    setLines((prev) => {
      const idx = prev.findIndex(
        (l) =>
          l.itemId === null &&
          normKey(l.name) === normKey(title) &&
          (l.category ?? '') === (category ?? ''),
      );
      if (idx >= 0) return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + qty } : l));
      return [
        ...prev,
        { id: nextId(), itemId: null, name: title, unit: 'piece', unitPrice: price, qty, category, tags, note },
      ];
    });

    // Reset unlocked fields; title always clears so entry keeps flowing.
    setQuick((prev) => ({
      category: locks.category ? prev.category : '',
      title: '',
      price: locks.price ? prev.price : '',
      qty: locks.qty ? prev.qty : '',
      tags: locks.tags ? prev.tags : [],
      note: locks.note ? prev.note : '',
    }));
  }, [quick, locks]);

  // CSV import: pick a file, read + parse it, and open the review sheet. Parse
  // problems (empty / missing required columns) surface as a friendly Alert; a
  // cancelled picker is a no-op.
  const pickAndParseCsv = useCallback(async () => {
    try {
      const res = await getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets?.length) return;
      const text = await new File(res.assets[0].uri).text();
      const { rows, errorKey } = parseStockCsv(text);
      if (errorKey) {
        Alert.alert(t('documents.import.errors.title'), t(errorKey));
        return;
      }
      setImportRows(rows);
      setCsvImportOpen(true);
    } catch (err) {
      Alert.alert(t('documents.import.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  // Confirm from the review sheet: map edited rows → ad-hoc doc lines (itemId
  // null → find-or-create at save). A repeat name+category bumps qty, mirroring
  // the fast-entry path.
  const importLines = useCallback((rows: ImportRow[]) => {
    setLines((prev) => {
      const next = [...prev];
      for (const r of rows) {
        const name = r.name.trim();
        const category = r.category.trim() || undefined;
        const qty = Math.max(1, Math.round(parseAmount(r.qty) || 0));
        const cost = Math.max(0, parseAmount(r.cost) || 0);
        const salePrice = r.salePrice.trim() ? Math.max(0, parseAmount(r.salePrice) || 0) : undefined;
        const barcode = r.barcode.trim() || undefined;
        const tags = r.tags.length ? r.tags : undefined;
        const note = r.note.trim() || undefined;
        const idx = next.findIndex(
          (l) => l.itemId === null && normKey(l.name) === normKey(name) && (l.category ?? '') === (category ?? ''),
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], qty: next[idx].qty + qty };
        } else {
          next.push({
            id: nextId(),
            itemId: null,
            name,
            unit: r.unit.trim() || 'piece',
            unitPrice: cost,
            qty,
            category,
            tags,
            note,
            salePrice,
            barcode,
          });
        }
      }
      return next;
    });
    setCsvImportOpen(false);
    setImportRows([]);
  }, []);

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
      // Resolve every line to a real item id. Ad-hoc fast-entry lines (itemId
      // null) find-or-create an item by name+category, seeding its price from
      // the line, and register any tags. The typed title rides on the line.
      const resolvedLines: DocumentLineInput[] = lines.map((l) => {
        const priceMinor = toMinor(l.unitPrice);
        let itemId = l.itemId;
        let title: string | null = null;
        if (itemId === null) {
          title = l.name;
          const existing = itemRepository.findByNameAndCategory(l.name, l.category ?? null);
          // CSV-imported lines may carry a sale price / barcode / low-stock
          // threshold to seed the new catalog item; fall back to the line price.
          const importedSale = l.salePrice !== undefined ? toMinor(l.salePrice) : undefined;
          itemId =
            existing?.id ??
            itemRepository.create({
              name: l.name,
              category: l.category ?? null,
              unit: l.unit,
              barcode: l.barcode ?? null,
              salePrice: mode === 'sale' ? priceMinor : (importedSale ?? 0),
              costPrice: mode === 'purchase' ? priceMinor : 0,
              lowStockThreshold: l.lowStockThreshold,
              tags: l.tags,
              notes: l.note ?? null,
            }).id;
          if (l.tags?.length) tagRepository.upsertMany(l.tags);
        }
        return { itemId, qty: l.qty, unitPrice: priceMinor, title, note: l.note ?? null, imageUri: l.imageUri ?? null };
      });
      const docId = documentRepository.create(
        {
          kind: mode === 'sale' ? 'outgoing' : 'incoming',
          status: 'posted',
          partyId: party?.id ?? null,
          note: note.trim() || undefined,
          attachments,
          lines: resolvedLines,
        },
        { allowNegative: allowNegativeStock },
      );
      // Backfill the doc id onto the attachment bytes now that it exists.
      if (attachments.length) attachmentRepository.assignDocument(attachments.map((a) => a.id), docId);
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
    note,
    setNote,
    attachments,
    addPhoto,
    addFile,
    removeAttachment,
    saving,
    wasRestored,
    // dialog / mode state
    pickerOpen,
    setPickerOpen,
    itemPickerOpen,
    setItemPickerOpen,
    scanning,
    setScanning,
    csvImportOpen,
    setCsvImportOpen,
    importRows,
    partyFormOpen,
    setPartyFormOpen,
    partyFormInitial,
    // fast-entry
    entryMode,
    setEntryMode,
    quick,
    locks,
    setQuickField,
    toggleLock,
    addQuickLine,
    titleSuggestions,
    // csv import
    pickAndParseCsv,
    importLines,
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
