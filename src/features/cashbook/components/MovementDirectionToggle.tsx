import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import type { TxDirection } from '@/repositories/transaction-repository';

interface MovementDirectionToggleProps {
  value: TxDirection;
  onChange: (direction: TxDirection) => void;
}

const OPTIONS: { key: 'in' | 'out'; direction: TxDirection }[] = [
  { key: 'in', direction: 1 },
  { key: 'out', direction: -1 },
];

/**
 * الاتجاه — in or out. Shown only for the `'other'` escape hatch, where the app
 * has no idea which way an unclassified movement went and must simply be told.
 *
 * A drawing is always out and an injection always in, so neither asks.
 */
export function MovementDirectionToggle({ value, onChange }: MovementDirectionToggleProps) {
  const { t } = useTranslation();
  return (
    <View className={`${ROW} items-center justify-between`}>
      <View className={`${ROW} gap-2`}>
        {OPTIONS.map((opt) => {
          const active = value === opt.direction;
          return (
            <Pressable
              key={opt.key}
              className={`px-3.5 py-2 rounded-xl border ${
                active ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
              onPress={() => onChange(opt.direction)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text className={`text-xs font-bold ${active ? 'text-surface' : 'text-muted'}`}>
                {t(`cashbook.form.directions.${opt.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="text-ink text-sm font-semibold">{t('cashbook.form.direction')}</Text>
    </View>
  );
}
