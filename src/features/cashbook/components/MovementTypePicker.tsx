import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { MovementType } from '../types';

interface MovementTypePickerProps {
  value: MovementType;
  onChange: (type: MovementType) => void;
}

const TYPES: { key: MovementType; icon: keyof typeof Feather.glyphMap }[] = [
  { key: 'drawing', icon: 'arrow-up-right' },
  { key: 'injection', icon: 'arrow-down-left' },
  { key: 'transfer', icon: 'repeat' },
  { key: 'other', icon: 'more-horizontal' },
];

/**
 * نوع الحركة — the four movements no other screen in the app can record.
 *
 * `other` is not filler: it is the ESCAPE HATCH. Without it, the first movement
 * of money the shop makes that fits no category is a movement the app cannot
 * hold — and from that moment the cash figure drifts from the drawer forever.
 */
export function MovementTypePicker({ value, onChange }: MovementTypePickerProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-1.5">
      <Text className="text-xs font-semibold text-muted text-right">
        {t('cashbook.form.type')}
      </Text>
      <View className={`${ROW} flex-wrap gap-2`}>
        {TYPES.map((type) => {
          const active = value === type.key;
          return (
            <Pressable
              key={type.key}
              className={`${ROW} grow basis-[45%] items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border ${
                active ? 'bg-primary border-primary' : 'bg-background border-border'
              }`}
              onPress={() => onChange(type.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Feather
                name={type.icon}
                size={14}
                color={active ? colors.surface : colors.muted}
              />
              <Text
                className={`text-xs font-bold ${active ? 'text-surface' : 'text-muted'}`}
              >
                {t(`cashbook.form.types.${type.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
