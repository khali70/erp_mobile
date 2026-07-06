import { View, Text, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { toArabicDigits } from '@/utils/numerals';
import { useItemMovement } from '../hooks/useItemMovement';
import { presentMovement } from '../movement-presenters';
import { MovementRow } from '../components/MovementRow';

/**
 * حركة الصنف — chronological posted movement for one item with a header showing
 * current on-hand and a list carrying a cumulative running balance. Tap a row to
 * open its source document. Composition-only; data from useItemMovement.
 */
export function ItemMovementScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { params } = useRoute<RouteProp<RootStackParamList, 'ItemMovement'>>();
  const { entries, onHand } = useItemMovement(params.itemId);
  const unitLabel = t(`inventory.units.${params.unit}`);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={params.itemName}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <View className="bg-surface rounded-2xl p-4 border border-border flex-row items-center justify-between">
          <Text className="text-sm text-muted">{t('inventory.movement.onHand')}</Text>
          <Text className="text-2xl font-extrabold text-foreground">
            {toArabicDigits(onHand)} {unitLabel}
          </Text>
        </View>

        {entries.length === 0 ? (
          <View className="bg-surface rounded-2xl p-8 border border-border items-center gap-3 mt-2">
            <Feather name="activity" size={44} color={colors['slate-400']} />
            <Text className="text-muted text-sm text-center">
              {t('inventory.movement.empty')}
            </Text>
          </View>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 pb-24"
            showsVerticalScrollIndicator={false}
          >
            {entries.map((entry, i) => (
              <MovementRow
                key={`${entry.documentId}-${i}`}
                row={presentMovement(entry, unitLabel, t, i18n.language)}
                balanceLabel={t('inventory.movement.balance')}
                onPress={() => navigation.navigate('Documents')}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}
