import { useState } from 'react';
import { View, Text, Pressable, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import type { DocLine, DocMode } from '../types';

interface DocLineRowProps {
  line: DocLine;
  mode: DocMode;
  /** Only the newest row grabs focus — otherwise every row fights for it. */
  isNewest?: boolean;
  onInc: () => void;
  onDec: () => void;
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onDelete: () => void;
}

/** Parse a free-typed numeric field; empty / malformed → 0 (never NaN). */
const parseNum = (text: string): number => {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/**
 * One line-item card.
 *
 * Purchase: the unit COST is always typed — it feeds weighted-average valuation.
 * Sale: the unit PRICE is typed when the item is negotiable, and read-only (with
 * a pencil to override) when it's fixed. A haggled price lives on the line only;
 * it never rewrites the item's list price.
 *
 * While a sale price is being typed, the margin strip shows list / cost / profit
 * live, so the owner knows whether he's still making money before he says yes.
 */
export function DocLineRow({ line, mode, isNewest, onInc, onDec, onQty, onPrice, onDelete }: DocLineRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');

  const isSale = mode === 'sale';
  const [override, setOverride] = useState(false);
  // Purchase always types a cost. A sale types a price when the item is haggled
  // — or when the owner explicitly overrides a fixed price (his shop, his call).
  const rateEditable = !isSale || line.pricingMode === 'negotiable' || override;

  const rateLabel = isSale ? t('documents.unitPrice') : t('documents.unitCost');
  const totalLabel = isSale ? t('documents.lineTotal') : t('documents.lineCost');
  const total = line.unitPrice * line.qty;

  // Margin readout: sale lines only, and only when we know what the item cost.
  // Fast-entry lines carry no catalog cost, so there is nothing honest to show.
  const hasCost = isSale && line.costPrice !== undefined && line.costPrice > 0;
  const profit = hasCost ? line.unitPrice - (line.costPrice as number) : 0;
  const belowCost = hasCost && line.unitPrice < (line.costPrice as number);
  const belowMin =
    isSale && !belowCost && line.minPrice !== undefined && line.unitPrice < line.minPrice;
  const marginColor = belowCost ? colors.danger : belowMin ? colors.warning : colors.positive;
  const marginPct =
    hasCost && line.unitPrice > 0 ? Math.round((profit / line.unitPrice) * 100) : 0;

  return (
    <View className="bg-surface rounded-2xl p-3.5 border border-border">
      <View className={`${ROW} w-full justify-between`}>
        <View className="items-start">
          <Text className="text-[11px] text-muted font-medium">{totalLabel}</Text>
          <Text className="text-primary text-base font-extrabold mt-0.5">
            {formatNumber(total, lang)} <Text className="text-[11px] font-normal text-muted">{currency}</Text>
          </Text>
        </View>
        <View className="flex-1 items-end">
          <Text className="text-ink text-sm font-extrabold text-right">{line.name}</Text>

          {rateEditable ? (
            <View className={`${ROW} items-center gap-2 mt-1`}>
              <Text className="text-muted text-xs">{currency}</Text>
              <TextInput
                className="min-w-16 bg-background text-ink text-sm font-bold text-center px-2 py-1.5 rounded-lg border border-primary/40"
                keyboardType="decimal-pad"
                value={line.unitPrice ? String(line.unitPrice) : ''}
                onChangeText={(v) => onPrice(parseNum(v))}
                placeholder="0"
                placeholderTextColor={colors['slate-400']}
                accessibilityLabel={`${rateLabel} — ${line.name}`}
                autoFocus={isNewest && line.unitPrice === 0}
                selectTextOnFocus
              />
              <Text className="text-muted text-xs">{rateLabel}</Text>
            </View>
          ) : (
            <Pressable
              className={`${ROW} items-center gap-1.5 mt-1`}
              onPress={() => setOverride(true)}
              accessibilityRole="button"
              accessibilityLabel={`${t('documents.editRate')} — ${line.name}`}
            >
              <Feather name="edit-2" size={12} color={colors.muted} />
              <Text className="text-muted text-xs text-right">
                {rateLabel}: {formatNumber(line.unitPrice, lang)} {currency}
              </Text>
            </Pressable>
          )}

          {/* Live margin while haggling: what it lists at, what it cost, what's left. */}
          {hasCost && rateEditable && (
            <View className="items-end mt-1.5 gap-0.5">
              <Text className="text-muted text-[10px]">
                {t('documents.listPrice')}: {formatNumber(line.listPrice ?? 0, lang)} ·{' '}
                {t('documents.cost')}: {formatNumber(line.costPrice as number, lang)}
              </Text>
              <Text className="text-[11px] font-bold" style={{ color: marginColor }}>
                {belowCost
                  ? t('documents.belowCost.badge')
                  : `${t('documents.margin')}: ${formatNumber(profit, lang)} (${formatNumber(marginPct, lang)}%)`}
                {belowMin ? ` · ${t('documents.belowMin')}` : ''}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View className={`${ROW} items-center justify-between mt-3 pt-3 border-t border-border`}>
        {/* qty stepper with a typable center field — plus on the leading (left) edge */}
        <View className={`${ROW} items-center bg-background rounded-xl border border-border`}>
          <Pressable
            className="w-11 h-11 items-center justify-center"
            onPress={onDec}
            accessibilityLabel={t('documents.qtyDec')}
          >
            <Feather name="minus" size={16} color={colors.muted} />
          </Pressable>
          <TextInput
            className="w-12 h-11 text-center text-ink font-extrabold"
            keyboardType="decimal-pad"
            value={line.qty ? String(line.qty) : ''}
            onChangeText={(v) => onQty(parseNum(v))}
            placeholder="0"
            placeholderTextColor={colors['slate-400']}
            accessibilityLabel={`${t('documents.qty')} — ${line.name}`}
            selectTextOnFocus
          />
          <Pressable
            className="w-11 h-11 items-center justify-center"
            onPress={onInc}
            accessibilityLabel={t('documents.qtyInc')}
          >
            <Feather name="plus" size={16} color={colors.primary} />
          </Pressable>
        </View>

        <Pressable
          className="w-11 h-11 rounded-xl bg-danger-light items-center justify-center"
          onPress={onDelete}
          accessibilityLabel={`${t('common.delete')} — ${line.name}`}
        >
          <Feather name="trash-2" size={15} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}
