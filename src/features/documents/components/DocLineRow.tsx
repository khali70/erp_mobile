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
 * One line-item card. Both qty and unit rate are directly typable (decimal-pad)
 * — the hottest fields on the entry path — with +/− steppers for fine-adjust.
 * Purchase mode REQUIRES a typed unit cost (weighted-average valuation).
 */
export function DocLineRow({ line, mode, onInc, onDec, onQty, onPrice, onDelete }: DocLineRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');
  const isSale = mode === 'purchase';
  const rateLabel = isSale ? t('documents.unitPrice') : t('documents.unitCost');
  const totalLabel = isSale ? t('documents.lineTotal') : t('documents.lineCost');
  const total = line.unitPrice * line.qty;
  // Rate reads as a label by default; the pencil reveals the inline editor.
  // Purchase cost is required, so a fresh zero-cost line opens editing straight away.

  return (
    <View key={`doc-row`} className="bg-surface rounded-2xl p-3.5 border border-border">
      <View className={`${ROW} w-full justify-between`}>
        <View className="items-start">
          <Text className="text-[11px] text-muted font-medium">{totalLabel}</Text>
          <Text className="text-primary text-base font-extrabold mt-0.5">
            {formatNumber(total, lang)} <Text className="text-[11px] font-normal text-muted">{currency}</Text>
          </Text>
        </View>
        <View className="flex-1 items-end">
          <Text className="text-ink text-sm font-extrabold text-right">{line.name}</Text>
          {/* TODO: make the total editable and the unite price fixed for !isSale mode  */}
          {/* Unit rate (price for sale, cost for purchase): read-only label until
              the pencil toggles the inline editor. */}
          {isSale ? (
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
                autoFocus
                selectTextOnFocus
              />
              <Text className="text-muted text-xs">{rateLabel}</Text>
            </View>
          ) : (
            <Text className="text-muted text-xs mt-1 text-right">
              {rateLabel}: {formatNumber(line.unitPrice, lang)} {currency}
            </Text>
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

        {/* delete + edit-rate actions */}
        <View className={`${ROW} items-center gap-2`}>
          <Pressable
            className="w-11 h-11 rounded-xl bg-danger-light items-center justify-center"
            onPress={onDelete}
            accessibilityLabel={`${t('common.delete')} — ${line.name}`}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
          </Pressable>

        </View>
      </View>
    </View>
  );
}
