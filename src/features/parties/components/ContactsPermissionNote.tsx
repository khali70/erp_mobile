import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { ContactsAccess } from '../types';

interface ContactsPermissionNoteProps {
  access: ContactsAccess;
  /** Re-prompt. Only offered while the OS will still show the dialog. */
  onRetry: () => void;
}

/**
 * The quiet inline note for every state where contacts are NOT available.
 *
 * Deliberately not an alert and not a blocking card: contacts autofill is a
 * shortcut, and a shop owner who refused the permission (or is on a build
 * without the native module) must be able to type a name and a number and hit
 * save without ever acknowledging a dialog. Saving is never gated on this.
 */
export function ContactsPermissionNote({ access, onRetry }: ContactsPermissionNoteProps) {
  const { t } = useTranslation();
  if (access !== 'denied' && access !== 'blocked' && access !== 'unavailable') return null;

  const body =
    access === 'denied'
      ? t('parties.contacts.permBody')
      : access === 'blocked'
        ? t('parties.contacts.permDenied')
        : t('parties.contacts.unavailable');

  return (
    <View className={`${ROW} items-start gap-2 px-1`}>
      <Feather name="info" size={13} color={colors.muted} style={{ marginTop: 2 }} />
      <View className="flex-1">
        <Text className="text-muted text-[11px] text-right leading-4">{body}</Text>
        {access === 'denied' && (
          <Pressable onPress={onRetry} accessibilityRole="button" hitSlop={6}>
            <Text className="text-primary text-[11px] font-bold text-right mt-1">
              {t('parties.contacts.permGrant')}
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}
