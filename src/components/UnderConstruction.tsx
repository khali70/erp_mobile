import { View, Text, Pressable, I18nManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';

/**
 * Shared presentational primitive for skeleton screens. NOT a route itself —
 * each real screen file renders this with its own title until the screen is
 * built out. Teal RTL header + "under construction" body. NativeWind only.
 */
export function UnderConstruction({ title }: { title: string }) {
  const navigation = useNavigation();
  const rowDir = I18nManager.isRTL ? 'flex-row-reverse' : 'flex-row';

  return (
    <View className="flex-1 bg-background">
      <SafeAreaView edges={['top']} className="bg-primary">
        <View className={`${rowDir} items-center justify-between px-4 h-14`}>
          <Text className="text-surface text-lg font-bold">{title}</Text>
          <Pressable
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
            className="w-10 h-10 items-center justify-center"
          >
            <Feather
              name={I18nManager.isRTL ? 'arrow-right' : 'arrow-left'}
              size={22}
              color={colors.surface}
            />
          </Pressable>
        </View>
      </SafeAreaView>

      <View className="flex-1 items-center justify-center gap-3 px-8">
        <View className="w-16 h-16 rounded-full bg-primary-light items-center justify-center">
          <Feather name="tool" size={28} color={colors.primary} />
        </View>
        <Text className="text-ink text-base font-bold text-center">قيد الإنشاء</Text>
        <Text className="text-muted text-sm text-center">{title} — هذه الشاشة قيد التطوير</Text>
      </View>
    </View>
  );
}
