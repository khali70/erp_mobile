import { View, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface OverStockBannerProps {
  /** Names of the lines asking for more than the shop has. */
  names: string[];
}

/**
 * Lines that outgrew their stock — typically a draft restored from a previous
 * session, whose quantities were fine when he typed them and are not any more
 * (someone else sold the goods in between).
 *
 * It NAMES them and leaves them alone. Silently rewriting a man's draft to fit
 * the current on-hand would change the invoice he thinks he is looking at.
 */
export function OverStockBanner({ names }: OverStockBannerProps) {
  const { t } = useTranslation();
  if (names.length === 0) return null;
  return (
    <View
      className={`${ROW} items-center gap-2 bg-danger-light rounded-2xl px-3.5 py-2.5 border border-danger/20`}
    >
      <Feather name="alert-triangle" size={15} color={colors.danger} />
      <Text className="text-danger text-xs font-bold text-right flex-1">
        {t('documents.overStock', { names: names.join('، '), count: names.length })}
      </Text>
    </View>
  );
}
