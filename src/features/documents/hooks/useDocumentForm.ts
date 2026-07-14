import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { fromMinor, lineTotal, toMajor, toMinor } from '@/utils/money';
import { normalizeDigits, toLocaleDigits } from '@/utils/numerals';
import { parseStockCsv, parseAmount, type ImportRow } from '../utils/importStock';
import { useItems } from '@/features/inventory/hooks/useItems';
import { useSettingsStore } from '@/store/settings-store';
import { documentRepository } from '@/repositories/document-repository.client';
import {
  NegativeStockError,
  type DocumentLineInput,
  type DocumentPaymentInput,
  type AttachmentMeta,
} from '@/repositories/document-repository';
import type { Account } from '@/repositories/transaction-repository';
import { WALKIN_CUSTOMER_ID, WALKIN_SUPPLIER_ID } from '@/db/sentinels';
import { attachmentRepository } from '@/repositories/attachment-repository';
import { itemRepository } from '@/repositories/item-repository.client';
import { tagRepository } from '@/repositories/tag-repository.client';
import { pickPhoto, pickFile, ingest, removeAttachment as removeAttachmentFile } from '@/utils/attachments';
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
  // PAYMENT — what the owner actually handed over.
  //
  // `paidInput` is null until he TOUCHES the field, and while it is null the
  // paid amount simply IS the total. That is the whole point: this shop rarely
  // buys on debt, debt is the exception, so the common path (paid in full) must
  // need zero extra input and paying less has to be a deliberate act. It also
  // means adding a line after typing nothing keeps paid == total automatically.
  const [paidInput, setPaidInput] = useState<string | null>(draft.paid ?? null);
  const [account, setAccount] = useState<Account>(draft.account ?? 'cash');
  // SALE SPLIT — one sale, paid partly in cash and partly by InstaPay.
  //
  // Off by default: most sales land in one pocket, and a second field the owner
  // has to zero out every time is a tax on the common case. When it is ON he
  // types only the CASH part; the rest goes to InstaPay by construction, so the
  // two can never fail to add up to the total (which for a sale they must — see
  // `payments` below).
  const [splitEnabled, setSplitEnabled] = useState(draft.split ?? false);
  const [cashPartInput, setCashPartInput] = useState<string>(draft.cashPart ?? '');
  // PROOF OF MONEY — hangs off the payment, never the document (which carries
  // proof of GOODS). Cash needs none; InstaPay IS a screenshot.
  const [paymentAttachments, setPaymentAttachments] = useState<AttachmentMeta[]>(
    draft.paymentAttachments ?? [],
  );
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
      paid: paidInput,
      account,
      paymentAttachments,
      split: splitEnabled,
      cashPart: cashPartInput,
    });
  }, [
    lines,
    party,
    note,
    attachments,
    quick,
    locks,
    paidInput,
    account,
    paymentAttachments,
    splitEnabled,
    cashPartInput,
    persistDraft,
  ]);

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

  // Payment proof: same ingest pipeline as the receipt, different home. These
  // bytes prove the MONEY moved; documents.attachments prove the GOODS arrived.
  const addPaymentProof = useCallback(async () => {
    const picked = await pickPhoto();
    if (!picked) return;
    try {
      const meta = await ingest(picked);
      setPaymentAttachments((prev) => [...prev, meta]);
    } catch (err) {
      Alert.alert(t('documents.errors.title'), String((err as Error)?.message ?? err));
    }
  }, [t]);

  const removePaymentProof = useCallback((id: string) => {
    removeAttachmentFile(id);
    setPaymentAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const discardDraft = () => {
    Alert.alert(t('documents.draft.discardTitle'), t('documents.draft.discardBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('documents.draft.discardConfirm'),
        style: 'destructive',
        onPress: () => {
          attachments.forEach((a) => removeAttachmentFile(a.id));
          paymentAttachments.forEach((a) => removeAttachmentFile(a.id));
          setLines([]);
          setParty(null);
          setChosen(false);
          setNote('');
          setAttachments([]);
          setQuick(EMPTY_QUICK);
          setLocks(NO_LOCKS);
          setPaidInput(null);
          setAccount('cash');
          setPaymentAttachments([]);
          setSplitEnabled(false);
          setCashPartInput('');
          clearDraft();
        },
      },
    ]);
  };

  const isWalkIn = chosen && party === null;

  // The document total in MINOR units, computed exactly as documentRepository
  // computes it (per-line rounding, then summed) — NOT as toMinor(total), which
  // rounds once at the end and can land a piastre away from it.
  //
  // That one piastre is the difference between a sale being saved and being
  // REJECTED: a sale's payments must equal the document total exactly, so the
  // form has to agree with the ledger to the last minor unit.
  const totalMinor = useMemo(
    () => lines.reduce((sum, l) => sum + lineTotal(l.qty, toMinor(l.unitPrice)), 0),
    [lines],
  );

  // The major-unit total is DERIVED from the integer one, never float-summed
  // alongside it. `Σ unitPrice * qty` in floats is how "25.200000000000003" got
  // into the المدفوع box, and how the form's total could disagree with the
  // ledger's by a piastre.
  const total = fromMinor(totalMinor);

  // An untouched paid field IS the total (see `paidInput` above). `paidInput` is
  // always CANONICAL (Latin digits, '.') so parseFloat can read it; the shaping
  // to ٢٥٫٢٠ happens on the way out, in `paidValue`.
  const paidCanonical = paidInput ?? toMajor(totalMinor);
  const paid = Math.max(0, parseFloat(paidCanonical) || 0);
  const paidValue = toLocaleDigits(paidCanonical, lang);
  const remaining = total - paid; // > 0 ⇒ debt; shown only when it exists

  // Everything the owner types into a money box is normalised at the boundary:
  // an Arabic-Indic keyboard must not land NaN in `paid` (which would silently
  // turn a paid-in-full purchase into a debt for the whole amount).
  const setPaid = useCallback(
    (value: string | null) => setPaidInput(value === null ? null : normalizeDigits(value)),
    [],
  );
  const setCashPart = useCallback(
    (value: string) => setCashPartInput(normalizeDigits(value)),
    [],
  );

  // HOW THE CUSTOMER PAID — cash, InstaPay, or both.
  //
  // A sale is ALWAYS settled in full: customer debt (AR) is deprecated and
  // unbuilt, so there is no book that could hold an unpaid remainder. The owner
  // therefore never types "how much" — only "which pocket", and when he splits,
  // how much of it was cash. The InstaPay part is the REMAINDER, by construction:
  // the two halves cannot fail to add up to the total, because the second one is
  // defined as what the first leaves behind.
  //
  // An EMPTY cash box means the FULL TOTAL, not zero. Zero would route the whole
  // sale to InstaPay the instant the toggle is tapped — one stray tap misfiling a
  // cash sale into the wrong pocket, silently, with nothing on screen saying so.
  // The split therefore opens as a NO-OP (all cash) and the owner types DOWN.
  //
  // Unclamped, so a cash half bigger than the sale is still TOLD to him at save
  // rather than quietly trimmed (see `save`).
  const cashPartMinor = toMinor(cashPartInput.trim() || toMajor(totalMinor));
  const saleCashMinor = splitEnabled
    ? Math.min(Math.max(0, cashPartMinor), totalMinor)
    : account === 'cash'
      ? totalMinor
      : 0;
  const saleInstapayMinor = totalMinor - saleCashMinor;
  const saleCashPart = fromMinor(saleCashMinor);
  const saleInstapayPart = fromMinor(saleInstapayMinor);
  /** True when any of the sale's money came through InstaPay — proof rides on it. */
  const saleTouchesInstapay = mode === 'sale' && saleInstapayMinor > 0;

  // Opening the split PRE-FILLS the cash half with the whole sale, so the number
  // the owner sees is the one the app would post, and he adjusts it downward.
  // Closing it hands the sale back to the الحساب toggle.
  const toggleSplit = useCallback(
    (next: boolean) => {
      setSplitEnabled(next);
      setCashPartInput(next ? toMajor(totalMinor) : '');
    },
    [totalMinor],
  );

  // Switching the pocket away from InstaPay DROPS the proof — it is proof of an
  // InstaPay transfer that no longer exists, and `payments` only ever attaches it
  // to an InstaPay payment. Leaving the metadata in state would leave its bytes
  // in attachments.db attached to nothing, forever, while the owner still sees a
  // chip on screen that will never be written.
  const selectAccount = useCallback((next: Account) => {
    setAccount(next);
    if (next === 'instapay') return;
    setPaymentAttachments((prev) => {
      prev.forEach((a) => removeAttachmentFile(a.id));
      return [];
    });
  }, []);

  // Build a fresh line from a catalog item, snapshotting the pricing context the
  // row needs to show margin while the owner haggles. Sale prefills the list
  // price; purchase starts at 0 (owner types the unit cost).
  const lineFromItem = useCallback(
    (item: InventoryItem): DocLine => ({
      id: nextId(),
      itemId: item.id,
      name: item.name,
      unit: item.unit,
      unitPrice: mode === 'sale' ? fromMinor(item.salePriceMinor) : 0,
      qty: 1,
      listPrice: fromMinor(item.salePriceMinor),
      costPrice: fromMinor(item.costPriceMinor),
      minPrice: item.minPriceMinor !== null ? fromMinor(item.minPriceMinor) : undefined,
      pricingMode: item.pricingMode,
    }),
    [mode],
  );

  const appendItem = (item: InventoryItem) => {
    setLines((prev) => [...prev, lineFromItem(item)]);
  };

  // Scan path: a repeat barcode bumps the existing line instead of stacking a
  // duplicate row. Crucially it does NOT re-read the price — re-scanning an item
  // after haggling it down must not snap the line back to the list price.
  // Returns the resulting qty so the scanner can echo it.
  const scanAppend = useCallback(
    (item: InventoryItem) => {
      const existing = lines.find((l) => l.itemId === item.id);
      const resultQty = (existing?.qty ?? 0) + 1;
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.itemId === item.id);
        if (idx >= 0) {
          return prev.map((l, i) => (i === idx ? { ...l, qty: l.qty + 1 } : l));
        }
        return [...prev, lineFromItem(item)];
      });
      return resultQty;
    },
    [lines, lineFromItem],
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

  // Sale lines priced under the item's weighted-average cost. The owner is
  // allowed to do this (clearing dead stock, a favour, a bundle) — he just has
  // to mean it. Fast-entry lines have no known cost, so they can't be judged.
  const belowCostLines = useMemo(
    () =>
      mode === 'sale'
        ? lines.filter((l) => l.costPrice !== undefined && l.costPrice > 0 && l.unitPrice < l.costPrice)
        : [],
    [lines, mode],
  );

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
    if (mode === 'purchase') {
      if (paid < 0) {
        Alert.alert(t('documents.errors.title'), t('payments.errors.negative'));
        return;
      }
      // Over-paying is a real thing, but it happens LATER, from the debts
      // screen, where it correctly becomes a credit. You cannot hand a man more
      // than the goods are worth in the same breath as receiving them.
      if (toMinor(paid) > toMinor(total)) {
        Alert.alert(t('documents.errors.title'), t('payments.errors.exceedsTotal'));
        return;
      }
      // A sentinel must never carry debt: "بدون مورد" is not a person anyone can
      // chase for the balance. A walk-in is settled in full or not recorded.
      if (isWalkIn && toMinor(paid) !== toMinor(total)) {
        Alert.alert(t('documents.errors.title'), t('payments.errors.walkInMustBePaid'));
        return;
      }
    }
    // A split whose cash half is bigger than the whole sale is a typo, and it is
    // told rather than silently trimmed: the owner's number is never quietly
    // changed under him — he wrote it, so he gets to see it was wrong.
    if (mode === 'sale' && splitEnabled && cashPartMinor > totalMinor) {
      Alert.alert(t('documents.errors.title'), t('payments.errors.splitExceedsTotal'));
      return;
    }
    // Selling at a loss is a confirm, never a block — it's his shop.
    if (belowCostLines.length > 0) {
      Alert.alert(
        t('documents.belowCost.title'),
        t('documents.belowCost.body', {
          names: belowCostLines.map((l) => l.name).join('، '),
          count: belowCostLines.length,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('documents.belowCost.confirm'), style: 'destructive', onPress: post },
        ],
      );
      return;
    }
    post();
  };

  function post() {
    if (saving) return;
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
        // Record what the line was sold AGAINST, not just what it sold FOR — the
        // gap is the discount, and it is unreconstructable once items.sale_price
        // moves. A fast-entry line has no anchor, so the typed price is its own.
        // NOTE: this never writes back to items.sale_price for an existing item.
        // The list price is the anchor; a haggled sale must not erode it.
        const listPriceMinor = mode === 'sale' ? toMinor(l.listPrice ?? l.unitPrice) : null;
        return {
          itemId,
          qty: l.qty,
          unitPrice: priceMinor,
          listPrice: listPriceMinor,
          title,
          note: l.note ?? null,
          imageUri: l.imageUri ?? null,
        };
      });
      // A walk-in resolves to the SENTINEL party, never null — so a cash payment
      // always has something to point at, and no query needs a null special case.
      const walkInId = mode === 'sale' ? WALKIN_CUSTOMER_ID : WALKIN_SUPPLIER_ID;
      const partyId = party?.id ?? walkInId;

      // Money that changed hands as part of saving this document.
      //
      // PURCHASE: whatever the owner handed over — possibly nothing (paid === 0
      // writes NO transaction row: no money moved, and the cash book must not
      // claim otherwise), possibly less than the total, which becomes debt.
      //
      // SALE: the full total, ALWAYS, across one pocket or two. A split writes
      // TWO rows against the SAME document — one sale, two pockets — which is
      // exactly why the day's cash/InstaPay figures can only be summed from the
      // transactions and never from `documents`.
      const payments: DocumentPaymentInput[] = [];
      if (mode === 'purchase') {
        const paidMinor = toMinor(paid);
        if (paidMinor > 0) {
          payments.push({
            amount: paidMinor,
            account,
            // Proof only ever accompanies InstaPay — cash was handed over and
            // both men saw it; there is nothing to screenshot.
            attachments: account === 'instapay' ? paymentAttachments : undefined,
          });
        }
      } else {
        if (saleCashMinor > 0) payments.push({ amount: saleCashMinor, account: 'cash' });
        if (saleInstapayMinor > 0) {
          payments.push({
            amount: saleInstapayMinor,
            account: 'instapay',
            attachments: paymentAttachments,
          });
        }
      }

      const docId = documentRepository.create(
        {
          kind: mode === 'sale' ? 'outgoing' : 'incoming',
          status: 'posted',
          partyId,
          note: note.trim() || undefined,
          attachments,
          lines: resolvedLines,
          payments,
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
  }

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
    // payment (purchase)
    paid,
    paidValue,
    setPaid,
    remaining,
    account,
    setAccount: selectAccount,
    paymentAttachments,
    addPaymentProof,
    removePaymentProof,
    // payment (sale) — always the full total, across one pocket or two
    splitEnabled,
    setSplitEnabled: toggleSplit,
    cashPartValue: toLocaleDigits(cashPartInput, lang),
    setCashPart,
    saleCashPart,
    saleInstapayPart,
    saleTouchesInstapay,
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
