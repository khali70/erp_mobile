import { Text, Pressable, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { ContactsAccess } from '../types';

interface ContactsImportButtonProps {
  access: ContactsAccess;
  onPress: () => void;
}

/**
 * The affordance next to the name label: the explicit way to trigger the
 * contacts permission, for an owner who would rather tap than discover it by
 * focusing the field. Hidden once contacts are loaded — at that point the
 * dropdown IS the affordance — and hidden when the OS has closed the door.
 */
export function ContactsImportButton({ access, onPress }: ContactsImportButtonProps) {
  const { t } = useTranslation();
  if (access === 'ready' || access === 'blocked' || access === 'unavailable') return null;

  const loading = access === 'loading';
  return (
    <Pressable
      className={`${ROW} items-center gap-1`}
      onPress={onPress}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={t('parties.contacts.import')}
      hitSlop={8}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Feather name="users" size={13} color={colors.primary} />
      )}
      <Text className="text-primary text-[11px] font-bold">{t('parties.contacts.import')}</Text>
    </Pressable>
  );
}
