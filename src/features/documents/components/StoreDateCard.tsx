import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatDate } from '@/utils/dates';

interface StoreDateCardProps {
  /** i18n namespace of the owning mode (documents.outgoing | documents.incoming). */
  ns: string;
  /** Document date as epoch-ms. */
  docDate: number;
}

/** Read-only store + date summary shown at the top of a document form. */
export function StoreDateCard({ ns, docDate }: StoreDateCardProps) {
  const { t, i18n } = useTranslation();
  return (
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
          <Text className="text-ink text-sm font-bold">{formatDate(docDate, i18n.language)}</Text>
          <Feather name="calendar" size={15} color={colors.muted} />
        </View>
      </View>
    </View>
  );
}
