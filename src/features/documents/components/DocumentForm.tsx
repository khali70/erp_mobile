import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { formatNumber } from '@/utils/numerals';
import { PartyPicker } from './PartyPicker';
import { DocLineRow } from './DocLineRow';
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
const DEMO_CATALOG: Array<Omit<DocLine, 'id' | 'qty'>> = [
  { name: 'تيشرت قطني كاجوال - أسود', unitPrice: 350 },
  { name: 'فستان سهرة ناعم - أحمر', unitPrice: 950 },
  { name: 'طقم جوارب قطنية (٥ أزواج)', unitPrice: 120 },
  { name: 'جاكيت جينز - أزرق', unitPrice: 780 },
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

  const allParties = mode === 'sale' ? DEMO_CUSTOMERS : DEMO_SUPPLIERS;
  const [parties, setParties] = useState<Party[]>(allParties);
  const [party, setParty] = useState<Party | null>(null);
  const [chosen, setChosen] = useState(false); // true once picker used (party or walk-in)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [lines, setLines] = useState<DocLine[]>([]);
  const [paidCash, setPaidCash] = useState('');

  const total = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  const paid = Number.parseInt(paidCash || '0', 10) || 0;
  const remaining = Math.max(total - paid, 0);
  const isWalkIn = chosen && party === null;

  const addLine = () => {
    const pick = DEMO_CATALOG[lines.length % DEMO_CATALOG.length];
    setLines((prev) => [...prev, { ...pick, id: nextId(), qty: 1 }]);
  };
  const mutateQty = (id: string, delta: number) =>
    setLines((prev) =>
      prev.map((l) => (l.id === id ? { ...l, qty: Math.max(1, l.qty + delta) } : l)),
    );
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id));

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
          onPress: () => navigation.goBack(),
          accessibilityLabel: t('documents.save'),
        }}
      />

      <ScrollView contentContainerClassName="px-4 py-4 pb-10 gap-4" showsVerticalScrollIndicator={false}>
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

          {party && party.debt > 0 && (
            <Text className="text-warning-dark text-xs font-bold text-right">
              {t(`${ns}.prevDebt`)}: {formatNumber(party.debt, lang)} {currency}
            </Text>
          )}
        </View>

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
              <Text className="text-ink text-sm font-bold">{formatNumber(6, lang)}/{formatNumber(7, lang)}/{formatNumber(2026, lang)}</Text>
              <Feather name="calendar" size={15} color={colors.muted} />
            </View>
          </View>
        </View>

        {/* Lines header */}
        <View className={`${ROW} items-center justify-between`}>
          <View className={`${ROW} items-center gap-2`}>
            {mode === 'sale' && (
              <Pressable
                className={`${ROW} items-center gap-1.5 bg-primary px-3.5 py-2.5 rounded-xl`}
                onPress={addLine}
              >
                <MaterialCommunityIcons name="barcode-scan" size={16} color={colors.surface} />
                <Text className="text-white text-xs font-bold">{t('documents.scan')}</Text>
              </Pressable>
            )}
            <Pressable
              className={`${ROW} items-center gap-1.5 bg-primary-light px-3.5 py-2.5 rounded-xl`}
              onPress={addLine}
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
                onDelete={() => removeLine(line.id)}
                onEdit={() => {}}
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

          <View className={`${ROW} items-center justify-between`}>
            <View className={`${ROW} items-center bg-surface rounded-xl border border-border px-3 w-36`}>
              <TextInput
                className="flex-1 text-ink text-sm font-bold text-right py-2.5"
                value={paidCash}
                onChangeText={(v) => setPaidCash(v.replace(/[^0-9]/g, ''))}
                placeholder={formatNumber(0, lang)}
                placeholderTextColor={colors['slate-400']}
                keyboardType="number-pad"
              />
              <Text className="text-muted text-xs ml-1">{currency}</Text>
            </View>
            <Text className="text-ink text-sm font-semibold">{t('documents.summary.paidCash')}</Text>
          </View>

          <View className={`${ROW} items-center justify-between`}>
            <View className="bg-warning-light px-2.5 py-1 rounded-md border border-warning/30">
              <Text className="text-warning-dark text-sm font-extrabold">
                {formatNumber(remaining, lang)} {currency}
              </Text>
            </View>
            <Text className="text-ink text-sm font-semibold">{t('documents.summary.remaining')}</Text>
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
          className={`${ROW} items-center justify-center gap-2 bg-primary rounded-2xl py-4`}
          onPress={() => navigation.goBack()}
        >
          <Feather name="check" size={18} color={colors.surface} />
          <Text className="text-white text-base font-extrabold">{t('documents.save')}</Text>
        </Pressable>
      </ScrollView>

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
