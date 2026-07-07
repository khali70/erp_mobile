import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { DocLineRow } from './DocLineRow';
import type { DocLine, DocMode } from '../types';

interface DocLinesSectionProps {
  /** i18n namespace of the owning mode (documents.outgoing | documents.incoming). */
  ns: string;
  mode: DocMode;
  lines: DocLine[];
  onMutateQty: (id: string, delta: number) => void;
  onSetQty: (id: string, qty: number) => void;
  onSetPrice: (id: string, price: number) => void;
  onRemove: (id: string) => void;
  onAddLine: () => void;
  /** Sale-only: when provided, renders the barcode scan toggle. */
  scanning?: boolean;
  onToggleScan?: () => void;
}

/** Lines header (add / optional scan) plus the line list or empty state. */
export function DocLinesSection({
  ns,
  mode,
  lines,
  onMutateQty,
  onSetQty,
  onSetPrice,
  onRemove,
  onAddLine,
  scanning,
  onToggleScan,
}: DocLinesSectionProps) {
  const { t } = useTranslation();
  return (
    <>
      {/* Lines header */}
      <View className={`${ROW} items-center justify-between`}>
        <View className={`${ROW} items-center gap-2`}>
          {onToggleScan && (
            <Pressable
              className={`${ROW} items-center gap-1.5 px-3.5 py-2.5 rounded-xl ${scanning ? 'bg-primary-dark' : 'bg-primary'}`}
              onPress={onToggleScan}
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
          )}
          <Pressable
            className={`${ROW} items-center gap-1.5 bg-primary-light px-3.5 py-2.5 rounded-xl`}
            onPress={onAddLine}
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
              onInc={() => onMutateQty(line.id, 1)}
              onDec={() => onMutateQty(line.id, -1)}
              onQty={(q) => onSetQty(line.id, q)}
              onPrice={(p) => onSetPrice(line.id, p)}
              onDelete={() => onRemove(line.id)}
            />
          ))}
        </View>
      )}
    </>
  );
}
