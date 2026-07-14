import { View, Text, Pressable, I18nManager } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { ReportLink } from '../report-links';

interface ReportRowProps {
  link: ReportLink;
  onPress: () => void;
}

// The chevron points the way the row OPENS — forward along the writing
// direction. A hardcoded chevron-left points back the way he came under LTR.
const CHEVRON = I18nManager.isRTL ? 'chevron-left' : 'chevron-right';

/**
 * ONE REPORT, AND WHAT IT ANSWERS.
 *
 * The subtitle is not decoration: "التقارير" is a word, and a list of five more
 * words is a menu the owner has to guess his way through. One line saying what
 * the report actually tells him is the difference between a hub and a directory.
 *
 * A NOT-READY report renders muted, unpressable and marked "قريبًا" — it is
 * still listed, because the app should say what it will do, but it must never
 * pretend a stub is a screen.
 */
export function ReportRow({ link, onPress }: ReportRowProps) {
  const { t } = useTranslation();

  return (
    <Pressable
      className={`${ROW} items-center gap-3 bg-surface rounded-2xl p-3.5 border border-border ${
        link.ready ? '' : 'opacity-60'
      }`}
      onPress={onPress}
      disabled={!link.ready}
      accessibilityRole="button"
      accessibilityState={{ disabled: !link.ready }}
      accessibilityLabel={t(`reports.items.${link.key}.title`)}
    >
      <View
        className={`w-11 h-11 rounded-xl items-center justify-center ${link.iconBgClass}`}
      >
        <Feather name={link.icon} size={20} color={link.iconColor} />
      </View>

      <View className="flex-1 gap-0.5">
        <Text className="text-sm font-bold text-ink">
          {t(`reports.items.${link.key}.title`)}
        </Text>
        <Text className="text-[11px] text-muted" numberOfLines={1}>
          {t(`reports.items.${link.key}.subtitle`)}
        </Text>
      </View>

      {link.ready ? (
        <Feather name={CHEVRON} size={18} color={colors.muted} />
      ) : (
        <View className="px-2.5 py-1 rounded-full bg-background border border-border">
          <Text className="text-[11px] font-semibold text-muted">{t('reports.soon')}</Text>
        </View>
      )}
    </Pressable>
  );
}
