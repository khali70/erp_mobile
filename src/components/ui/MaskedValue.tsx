import type { ReactNode } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { maskRun, MASK_DOT_COUNT } from '@/privacy/privacy';
import { usePrivacyValue } from '@/privacy/usePrivacy';

interface MaskedValueProps {
  /** Stable key for this value, e.g. `kpi:stockValue` or `party:<id>`. */
  id: string;
  /** The formatted money value. Rendered as-is when revealed. */
  children: ReactNode;
  /** Text classes for the dot-run, matched to the value's size/weight. */
  dotClassName?: string;
  /** Eye affordance size, matched to the value's line height. */
  iconSize?: number;
  /** Dots in the run — trim it for narrow surfaces like a balance pill. */
  dotCount?: number;
}

/**
 * Hides one money value behind a dot-run until it is revealed.
 *
 * Width stability: the real value is always mounted and keeps sizing the box —
 * when masked it is simply made invisible (and hidden from screen readers) and
 * the dot-run is laid over it. So the box measures the same in both states and
 * toggling can never reflow the grid. Tapping the mask reveals just this value.
 *
 * With privacy mode off the children render untouched — no wrapper, no listener.
 */
export function MaskedValue({
  id,
  children,
  dotClassName,
  iconSize = 14,
  dotCount = MASK_DOT_COUNT,
}: MaskedValueProps) {
  const { t } = useTranslation();
  const { enabled, masked, revealThis } = usePrivacyValue(id);

  if (!enabled) return <>{children}</>;

  return (
    <View>
      <View
        // Invisible, inert and unreadable by assistive tech while masked — but
        // still measured, which is what keeps the layout from jumping.
        pointerEvents={masked ? 'none' : 'auto'}
        style={masked ? { opacity: 0 } : undefined}
        accessibilityElementsHidden={masked}
        importantForAccessibility={masked ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>

      {masked && (
        <Pressable
          className={`absolute inset-0 ${ROW} items-center gap-1.5`}
          onPress={revealThis}
          accessibilityRole="button"
          accessibilityLabel={t('dashboard.kpi.hidden')}
          accessibilityHint={t('privacy.a11y.revealValue')}
        >
          <Text className={dotClassName ?? 'text-base font-extrabold text-muted'}>
            {maskRun(dotCount)}
          </Text>
          <Feather name="eye" size={iconSize} color={colors.muted} />
        </Pressable>
      )}
    </View>
  );
}
