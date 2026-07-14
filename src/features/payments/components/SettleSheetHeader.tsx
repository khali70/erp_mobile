import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';

interface SettleSheetHeaderProps {
  /** e.g. "سداد لـ أحمد" — owned by the caller, so the sheet stays generic. */
  title: string;
  /** Optional line under it, e.g. the outstanding balance. */
  subtitle?: string;
  onClose: () => void;
}

/** Teal head of the سداد sheet: who is being paid, and a way out. */
export function SettleSheetHeader({ title, subtitle, onClose }: SettleSheetHeaderProps) {
  const { t } = useTranslation();
  return (
    <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
      <View className={`${ROW} items-center gap-2.5`}>
        <Feather name="check-circle" size={20} color={colors['primary-200']} />
        <View className="gap-0.5">
          <Text className="text-white font-bold text-base text-right">{title}</Text>
          {subtitle ? (
            <Text className="text-primary-100 text-xs text-right">{subtitle}</Text>
          ) : null}
        </View>
      </View>

      <Pressable
        className="w-8 h-8 rounded-full items-center justify-center"
        style={{ backgroundColor: HEADER_OVERLAY }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('common.cancel')}
      >
        <Feather name="x" size={16} color={colors.surface} />
      </Pressable>
    </View>
  );
}
