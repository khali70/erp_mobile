import { View, Text, Pressable } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { DocumentRowViewModel } from '../document-presenters';

interface DocumentListRowProps {
  doc: DocumentRowViewModel;
  onPress?: () => void;
}

/**
 * One document in the list. Direction-tinted icon (incoming = positive/down,
 * outgoing = danger/up), doc no + date on the lead, total on the trail.
 */
export function DocumentListRow({ doc, onPress }: DocumentListRowProps) {
  const { t } = useTranslation();
  const incoming = doc.kind === 'in';
  const icon = incoming ? 'arrow-down-left' : 'arrow-up-right';
  const tint = incoming ? colors.positive : colors.danger;
  const tintBg = incoming ? 'bg-positive-light' : 'bg-danger-light';

  return (
    <Pressable
      className={`${ROW} items-center gap-3 p-3 rounded-2xl border border-border bg-surface`}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center ${tintBg}`}>
        <Feather name={icon} size={20} color={tint} />
      </View>

      <View className="flex-1">
        <Text className="text-ink text-sm font-extrabold text-right">{doc.docLabel}</Text>
        <Text className="text-muted text-[11px] text-right mt-0.5">
          {incoming ? t('documents.kind.incoming') : t('documents.kind.outgoing')} · {doc.dateLabel}
        </Text>
        {doc.noteLabel ? (
          <Text className="text-muted text-[11px] text-right mt-0.5" numberOfLines={1}>
            {doc.noteLabel}
          </Text>
        ) : null}
      </View>

      <Text className="text-ink text-sm font-extrabold">
        {doc.totalLabel} {t('common.currency')}
      </Text>
    </Pressable>
  );
}
