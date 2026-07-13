import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { HEADER_OVERLAY } from '@/theme/rtl';
import { usePrivacyToggle } from '@/privacy/usePrivacy';

/**
 * Header eye control: one tap masks / reveals every money aggregate in the app.
 * Renders nothing while privacy mode is off, so the header is unchanged by
 * default.
 */
export function PrivacyToggleButton() {
  const { t } = useTranslation();
  const { enabled, revealed, toggle } = usePrivacyToggle();

  if (!enabled) return null;

  return (
    <Pressable
      className="w-9 h-9 rounded-xl items-center justify-center"
      style={{ backgroundColor: HEADER_OVERLAY }}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityState={{ selected: revealed }}
      accessibilityLabel={revealed ? t('privacy.a11y.hideValues') : t('privacy.a11y.showValues')}
    >
      <Feather name={revealed ? 'eye' : 'eye-off'} size={18} color={colors.surface} />
    </Pressable>
  );
}
