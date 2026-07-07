import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { DocMode } from '../types';

interface DocLinesHeaderProps {
  /** i18n namespace of the owning mode (documents.outgoing | documents.incoming). */
  ns: string;
  mode: DocMode;
  onAddLine: () => void;
  entryMode: 'list' | 'quick';
  onSetEntryMode: (m: 'list' | 'quick') => void;
  /** Sale-only: when provided, renders the barcode scan toggle instead of the entry-mode segment. */
  scanning?: boolean;
  onToggleScan?: () => void;
}

/**
 * Lines header: the section title plus a controls cluster. Sale mode shows
 * [barcode scan] + [add line]; purchase mode shows the [list | quick] entry
 * segment + [add line].
 */
export function DocLinesHeader({
  ns,
  mode,
  onAddLine,
  entryMode,
  onSetEntryMode,
  scanning,
  onToggleScan,
}: DocLinesHeaderProps) {
  const { t } = useTranslation();
  const isSale = mode === 'sale';

  const addLineBtn = (
    <Pressable
      className={`${ROW} items-center gap-1.5 bg-primary-light px-3.5 py-2.5 rounded-xl`}
      onPress={onAddLine}
      accessibilityRole="button"
      accessibilityLabel={t('documents.addLine')}
    >
      <Feather name="plus" size={16} color={colors.primary} />
      <Text className="text-primary text-xs font-bold">{t('documents.addLine')}</Text>
    </Pressable>
  );

  const scanBtn = onToggleScan && (
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
  );

  const quickToggle = (() => {
    const active = entryMode === 'quick';
    return (
      <Pressable
        className={`${ROW} items-center gap-1.5 px-3.5 py-2.5 rounded-xl border ${active ? 'bg-primary border-transparent' : 'bg-surface border-border'}`}
        onPress={() => onSetEntryMode(active ? 'list' : 'quick')}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
      >
        <Feather name="zap" size={16} color={active ? colors.surface : colors.muted} />
        <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
          {t('documents.entryMode.quick')}
        </Text>
      </Pressable>
    );
  })();

  return (
    <View className={`${ROW} items-center justify-between`}>
      <View className={`${ROW} items-center gap-2`}>
        {isSale ? scanBtn : quickToggle}
        {addLineBtn}
      </View>
      <Text className="text-ink text-sm font-extrabold flex-1 text-right">
        {t(`${ns}.linesTitle`)}
      </Text>
    </View>
  );
}
