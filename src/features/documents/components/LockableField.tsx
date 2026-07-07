import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';

interface LockableFieldProps {
  label: string;
  locked: boolean;
  onToggleLock: () => void;
  children: ReactNode;
  /** Accessibility label for the lock toggle (e.g. "Keep price"). */
  lockA11yLabel?: string;
  className?: string;
}

/**
 * Wraps any field with a lock toggle. A locked field keeps its value when the
 * fast-entry row resets after an add (bulk entry of many items sharing the same
 * price/qty/category). Generic — works for text, number, chips, tags, notes.
 */
export function LockableField({
  label,
  locked,
  onToggleLock,
  children,
  lockA11yLabel,
  className,
}: LockableFieldProps) {
  return (
    <View className={`gap-1 ${className ?? ''}`}>
      <View className={`${ROW} items-center justify-between`}>
        <Text className="text-[11px] font-semibold text-muted">{label}</Text>
        <Pressable
          onPress={onToggleLock}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={lockA11yLabel ?? label}
          accessibilityState={{ selected: locked }}
        >
          <MaterialCommunityIcons
            name={locked ? 'lock' : 'lock-open-outline'}
            size={15}
            color={locked ? colors.primary : colors['slate-400']}
          />
        </Pressable>
      </View>
      {children}
    </View>
  );
}
