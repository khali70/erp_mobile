import { View, Text, Pressable } from 'react-native';
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
  onDelete: () => void;
  onEdit: () => void;
}

/** One line-item card: name + unit rate, running total, qty stepper, edit/delete. */
export function DocLineRow({ line, mode, onInc, onDec, onDelete, onEdit }: DocLineRowProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const currency = t('common.currency');
  const rateLabel = mode === 'sale' ? t('documents.unitPrice') : t('documents.unitCost');
  const totalLabel = mode === 'sale' ? t('documents.lineTotal') : t('documents.lineCost');
  const total = line.unitPrice * line.qty;

  return (
    <View className="bg-surface rounded-2xl p-3.5 border border-border">
      <View className={`${ROW} items-start justify-between`}>
        <View className="items-start">
          <Text className="text-[11px] text-muted font-medium">{totalLabel}</Text>
          <Text className="text-ink text-base font-extrabold mt-0.5">
            {formatNumber(total, lang)} <Text className="text-[11px] font-normal text-muted">{currency}</Text>
          </Text>
        </View>
        <View className="flex-1 items-end">
          <Text className="text-ink text-sm font-extrabold text-right">{line.name}</Text>
          <Text className="text-muted text-xs mt-0.5 text-right">
            {rateLabel}: {formatNumber(line.unitPrice, lang)} {currency}
          </Text>
        </View>
      </View>

      <View className={`${ROW} items-center justify-between mt-3 pt-3 border-t border-border`}>
        {/* qty stepper */}
        <View className={`${ROW} items-center bg-background rounded-xl border border-border`}>
          <Pressable
            className="w-9 h-9 items-center justify-center"
            onPress={onInc}
            accessibilityLabel="+"
          >
            <Feather name="plus" size={16} color={colors.primary} />
          </Pressable>
          <Text className="w-8 text-center text-ink font-extrabold">{formatNumber(line.qty, lang)}</Text>
          <Pressable
            className="w-9 h-9 items-center justify-center"
            onPress={onDec}
            accessibilityLabel="-"
          >
            <Feather name="minus" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* edit / delete */}
        <View className={`${ROW} items-center gap-2`}>
          <Pressable
            className="w-9 h-9 rounded-xl bg-primary-light items-center justify-center"
            onPress={onEdit}
            accessibilityLabel={t('common.save')}
          >
            <Feather name="edit-2" size={15} color={colors.primary} />
          </Pressable>
          <Pressable
            className="w-9 h-9 rounded-xl bg-danger-light items-center justify-center"
            onPress={onDelete}
            accessibilityLabel={t('common.delete')}
          >
            <Feather name="trash-2" size={15} color={colors.danger} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
