import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatNumber } from '@/utils/numerals';
import { formatDate } from '@/utils/dates';
import { fromMinor, toMinor } from '@/utils/money';
import { useItems } from '@/features/inventory/hooks/useItems';
import { useSettingsStore } from '@/store/settings-store';
import { documentRepository } from '@/repositories/document-repository.client';
import { NegativeStockError } from '@/repositories/document-repository';
import type { InventoryItem } from '@/features/inventory/types';
import { PartyPicker } from './PartyPicker';
import { LineItemPicker } from './LineItemPicker';
import { DocLineRow } from './DocLineRow';
import { ScanPane } from './ScanPane';
import { useDocDraft } from '../hooks/useDocDraft';
import type { DocLine, DocMode, Party } from '../types';

// Demo data — swap for repository queries when the document repo lands.
const DEMO_CUSTOMERS: Party[] = [
  { id: 'c1', name: 'أحمد محمود', phone: '01001234567', debt: 3200 },
  { id: 'c2', name: 'منى سعيد', phone: '01222222222', debt: 0 },
  { id: 'c3', name: 'شركة النور للتجارة', phone: '01277777777', debt: 4900 },
  { id: 'c4', name: 'خالد إبراهيم', phone: '01199999999', debt: 1300 },
  { id: 'c5', name: 'فاطمة علي', phone: '01055555555', debt: 400 },
];
const DEMO_SUPPLIERS: Party[] = [
  { id: 's1', name: 'مصنع النيل للملابس الجاهزة', phone: '022345678', debt: 8500 },
  { id: 's2', name: 'مجموعة الفوزان للمنسوجات والاستيراد', phone: '023456789', debt: 0 },
  { id: 's3', name: 'الشرق للمشغولات الجلدية والشنط', phone: '024567890', debt: 0 },
];
let seq = 0;
const nextId = () => `l${seq++}`;

interface DocumentFormProps {
  mode: DocMode;
}

/**
 * Shared sale/purchase document form. `mode` swaps party (customer/supplier),
 * copy, the rate label (price vs cost) and barcode availability (sale only).
 * NativeWind only; all copy via i18n; money handled as whole units for the demo.
 */
export function DocumentForm({ mode }: DocumentFormProps) {
  const navigation = useNavigation();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');
  const ns = mode === 'sale' ? 'documents.outgoing' : 'documents.incoming';

  const { items } = useItems();
  const allowNegativeStock = useSettingsStore((s) => s.allowNegativeStock);
  const { initial: draft, persist: persistDraft, clear: clearDraft } = useDocDraft(mode);

  const allParties = mode === 'sale' ? DEMO_CUSTOMERS : DEMO_SUPPLIERS;
  const [parties, setParties] = useState<Party[]>(allParties);
  // Restore a party from the crash-safe buffer (name only; matched against the
  // demo list, else kept as a walk-in tag).
  const [party, setParty] = useState<Party | null>(
    draft.partyName ? (allParties.find((p) => p.name === draft.partyName) ?? null) : null,
  );
  const [chosen, setChosen] = useState(Boolean(draft.partyName));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [lines, setLines] = useState<DocLine[]>(draft.lines);
  const [saving, setSaving] = useState(false);
  const [wasRestored] = useState(draft.lines.length > 0);
  // Document date — stamped once at mount (today), not recomputed per render.
  const [docDate] = useState(() => Date.now());

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

  const handleQuickAdd = (query: string) => {
    const isPhone = /^[0-9]+$/.test(query);
    const created: Party = {
      id: nextId(),
      name: isPhone ? query : query,
      phone: isPhone ? query : '',
      debt: 0,
    };
    setParties((prev) => [created, ...prev]);
    setParty(created);
    setChosen(true);
  };

  const partyLabel = isWalkIn ? t(`${ns}.walkIn`) : party ? party.name : t(`${ns}.pickerTitle`);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t(`${ns}.title`)}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
        action={{
          icon: 'check',
          onPress: save,
          accessibilityLabel: t('documents.save'),
        }}
      />

      <ScrollView contentContainerClassName="px-4 py-4 pb-10 gap-4" showsVerticalScrollIndicator={false}>


        {/* Toggling the scanner swaps the store/date + party block for a live
            camera in place — the camera only mounts while scanning, so there is
            no idle battery or permission cost. */}
        {scanning ? (
          <ScanPane
            items={items}
            onScanItem={scanAppend}
            onClose={() => setScanning(false)}
            onManualAdd={() => {
              setScanning(false);
              setItemPickerOpen(true);
            }}
          />
        ) : (
          <>
            {/* Store + date */}
            <View className={`${ROW} gap-3`}>
              <View className="flex-1 bg-surface rounded-2xl p-3.5 border border-border gap-2">
                <Text className="text-muted text-xs font-semibold text-center">{t(`${ns}.store`)}</Text>
                <View className={`${ROW} items-center justify-center gap-2 bg-background rounded-xl py-2.5`}>
                  <Text className="text-ink text-sm font-bold" numberOfLines={1}>{t(`${ns}.defaultStore`)}</Text>
                  <MaterialCommunityIcons name="store-outline" size={16} color={colors.muted} />
                </View>
              </View>
              <View className="flex-1 bg-surface rounded-2xl p-3.5 border border-border gap-2">
                <Text className="text-muted text-xs font-semibold text-center">{t('documents.date')}</Text>
                <View className={`${ROW} items-center justify-center gap-2 bg-background rounded-xl py-2.5`}>
                  <Text className="text-ink text-sm font-bold">{formatDate(docDate, lang)}</Text>
                  <Feather name="calendar" size={15} color={colors.muted} />
                </View>
              </View>
            </View>
            {/* Party card */}
            <View className="bg-surface rounded-2xl p-4 border border-border gap-3">
              <View className={`${ROW} items-center justify-between`}>
                <Pressable
                  className={`${ROW} items-center gap-1.5`}
                  onPress={() => setPickerOpen(true)}
                >
                  <Feather name="user-plus" size={16} color={colors.primary} />
                  <Text className="text-primary text-sm font-extrabold">{t(`${ns}.addParty`)}</Text>
                </Pressable>
                <Text className="text-muted text-sm font-semibold">{t(`${ns}.party`)}</Text>
              </View>

              <Pressable
                className={`${ROW} items-center justify-between bg-background rounded-xl px-3.5 py-3 border border-border`}
                onPress={() => setPickerOpen(true)}
              >
                <Feather name="chevron-down" size={18} color={colors.muted} />
                <View className={`${ROW} items-center gap-2`}>
                  <Text className={`text-sm font-extrabold ${party || isWalkIn ? 'text-primary' : 'text-muted'}`}>
                    {partyLabel}
                  </Text>
                  <Feather name="user" size={18} color={colors.muted} />
                </View>
              </Pressable>

              {/* Supplier debt (AP) is informational only; customers carry no balance
                  (sales are cash, paid in full — no AR by design). */}
              {mode === 'purchase' && party && party.debt > 0 && (
                <Text className="text-warning-dark text-xs font-bold text-right">
                  {t(`${ns}.prevDebt`)}: {formatNumber(party.debt, lang)} {currency}
                </Text>
              )}
            </View>
          </>
        )}
        {/* Restored-draft notice (never-lose-data): input survived a relaunch. */}
        {wasRestored && lines.length > 0 && (
          <View className={`${ROW} items-center justify-between bg-primary-light rounded-2xl px-3.5 py-2.5 border border-primary/20`}>
            <Pressable onPress={discardDraft} accessibilityRole="button">
              <Text className="text-danger text-xs font-bold">{t('documents.draft.discard')}</Text>
            </Pressable>
            <View className={`${ROW} items-center gap-1.5 flex-1`}>
              <Text className="text-primary text-xs font-bold text-right flex-1">{t('documents.draft.restored')}</Text>
              <Feather name="rotate-ccw" size={14} color={colors.primary} />
            </View>
          </View>
        )}

        {/* Lines header */}
        <View className={`${ROW} items-center justify-between`}>
          <View className={`${ROW} items-center gap-2`}>
            <Pressable
              className={`${ROW} items-center gap-1.5 px-3.5 py-2.5 rounded-xl ${scanning ? 'bg-primary-dark' : 'bg-primary'}`}
              onPress={() => setScanning((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ selected: scanning }}
            >
              <MaterialCommunityIcons
                name={scanning ? 'close' : 'barcode-scan'}
                size={16}
                color={colors.surface}
              />
              <Text className="text-white text-xs font-bold">{t('documents.scan')}</Text>
            </Pressable>
            <Pressable
              className={`${ROW} items-center gap-1.5 bg-primary-light px-3.5 py-2.5 rounded-xl`}
              onPress={() => setItemPickerOpen(true)}
            >
              <Feather name="plus" size={16} color={colors.primary} />
              <Text className="text-primary text-xs font-bold">{t('documents.addLine')}</Text>
            </Pressable>
          </View>
          <Text className="text-ink text-sm font-extrabold flex-1 text-right">{t(`${ns}.linesTitle`)}</Text>
        </View>

        {/* Lines */}
        {lines.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3">
            <Feather name="inbox" size={40} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">{t('documents.emptyLines')}</Text>
          </View>
        ) : (
          <View className="gap-3">
            {lines.map((line) => (
              <DocLineRow
                key={line.id}
                line={line}
                mode={mode}
                onInc={() => mutateQty(line.id, 1)}
                onDec={() => mutateQty(line.id, -1)}
                onQty={(q) => setQty(line.id, q)}
                onPrice={(p) => setPrice(line.id, p)}
                onDelete={() => removeLine(line.id)}
              />
            ))}
          </View>
        )}

        {/* Summary card */}
        <View className="bg-primary-light rounded-2xl p-4 border border-primary/20 gap-3">
          <View className={`${ROW} items-center justify-between`}>
            <View className="bg-surface px-3 py-1 rounded-lg border border-primary/20">
              <Text className="text-primary text-sm font-extrabold">
                {t('documents.summary.countValue', { n: formatNumber(lines.length, lang) })}
              </Text>
            </View>
            <Text className="text-ink text-sm font-semibold">{t('documents.summary.count')}</Text>
          </View>

          <View className={`${ROW} items-center justify-between pt-3 border-t border-primary/20`}>
            <Text className="text-primary text-lg font-extrabold">
              {formatNumber(total, lang)} <Text className="text-xs font-normal">{currency}</Text>
            </Text>
            <Text className="text-ink text-base font-extrabold">{t('documents.summary.total')}</Text>
          </View>
        </View>

        {/* Save */}
        <Pressable
          className={`${ROW} items-center justify-center gap-2 bg-primary rounded-2xl py-4 ${saving ? 'opacity-60' : ''}`}
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
        >
          <Feather name="check" size={18} color={colors.surface} />
          <Text className="text-white text-base font-extrabold">{t('documents.save')}</Text>
        </Pressable>
      </ScrollView>

      <LineItemPicker
        visible={itemPickerOpen}
        items={items}
        onClose={() => setItemPickerOpen(false)}
        onSelect={appendItem}
      />

      <PartyPicker
        visible={pickerOpen}
        mode={mode}
        parties={parties}
        onClose={() => setPickerOpen(false)}
        onSelect={(p) => {
          setParty(p);
          setChosen(true);
        }}
        onQuickAdd={handleQuickAdd}
      />
    </View>
  );
}
