import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';

type HeaderAction = {
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
};

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  backLabel?: string;
  action?: HeaderAction;
  children?: ReactNode;
}

/** Teal top bar with optional back button (right in RTL) and a leading action. */
export function ScreenHeader({ title, onBack, backLabel, action, children }: ScreenHeaderProps) {
  return (
    <SafeAreaView edges={['top']} className="bg-primary px-4 pb-4">
      <View className={`${ROW} items-center justify-between mt-2`}>
        <View className={`${ROW} items-center gap-2.5`}>
          {onBack && (
            <Pressable
              className="w-9 h-9 rounded-xl items-center justify-center"
              style={{ backgroundColor: HEADER_OVERLAY }}
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel={backLabel}
            >
              <Feather name="arrow-right" size={20} color={colors.surface} />
            </Pressable>
          )}
          <Text className="text-white font-bold text-lg">{title}</Text>
        </View>

        {action && (
          <Pressable
            className="w-9 h-9 rounded-xl items-center justify-center"
            style={{ backgroundColor: HEADER_OVERLAY }}
            onPress={action.onPress}
            accessibilityRole="button"
            accessibilityLabel={action.accessibilityLabel}
          >
            <Feather name={action.icon} size={20} color={colors.surface} />
          </Pressable>
        )}
      </View>
      {children}
    </SafeAreaView>
  );
}
