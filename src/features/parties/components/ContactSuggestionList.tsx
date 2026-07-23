import { View, Text, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import { ContactSuggestionRow } from './ContactSuggestionRow';
import type { ContactSuggestion } from '../types';

/**
 * Four rows tall. The list sits INLINE under the name box and pushes the phone
 * field down rather than floating over it — an overlay that covers the next
 * field and the save button is a trap, and this form has to stay operable with
 * the list open.
 */
const MAX_HEIGHT = 176;

interface ContactSuggestionListProps {
  suggestions: ContactSuggestion[];
  /** Still reading the address book — never blocks typing. */
  loading: boolean;
  truncated: boolean;
  /** Rendered cap, for the truncation line. */
  limit: number;
  onSelect: (contact: ContactSuggestion) => void;
  onDismiss: () => void;
}

/**
 * The inline typeahead under the name field.
 *
 * A `ScrollView` and not a `FlatList` on purpose: the list is hard-capped at 8
 * rows by the matcher, so there is nothing to virtualize, and a VirtualizedList
 * nested in a scrolling modal card is a worse problem than the one it solves.
 */
export function ContactSuggestionList({
  suggestions,
  loading,
  truncated,
  limit,
  onSelect,
  onDismiss,
}: ContactSuggestionListProps) {
  const { t, i18n } = useTranslation();

  if (loading) {
    return (
      <View className={`${ROW} items-center gap-2 px-3 py-2.5 rounded-xl bg-background border border-border`}>
        <ActivityIndicator size="small" color={colors.muted} />
        <Text className="text-muted text-xs">{t('parties.contacts.loading')}</Text>
      </View>
    );
  }

  // No match is one muted line, never an empty dropdown shell.
  if (suggestions.length === 0) {
    return (
      <View className={`${ROW} items-center gap-2 px-3 py-2.5`}>
        <Feather name="search" size={13} color={colors.muted} />
        <Text className="text-muted text-xs">{t('parties.contacts.noMatch')}</Text>
      </View>
    );
  }

  return (
    <View className="rounded-xl border border-border bg-surface overflow-hidden">
      <View className={`${ROW} items-center justify-between px-3 pt-2.5 pb-1`}>
        <Text className="text-muted text-[11px] font-bold">{t('parties.contacts.listTitle')}</Text>
        <Pressable
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('parties.contacts.hide')}
          hitSlop={8}
        >
          <Feather name="x" size={14} color={colors.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={{ maxHeight: MAX_HEIGHT }}
        nestedScrollEnabled
        // Without this the keyboard dismiss eats the first tap and the owner
        // has to press every suggestion twice.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {suggestions.map((contact) => (
          <ContactSuggestionRow
            key={contact.id}
            name={contact.name}
            phone={contact.phone}
            noPhoneLabel={t('parties.noPhone')}
            onPress={() => onSelect(contact)}
          />
        ))}
      </ScrollView>

      {truncated && (
        <Text className="text-muted text-[11px] text-right px-3 py-2 border-t border-border">
          {/* `count` picks the Arabic plural form; `n` carries the SHAPED digits —
              i18next would interpolate a bare Latin "8" into an Arabic sentence. */}
          {t('parties.contacts.truncated', { count: limit, n: formatNumber(limit, i18n.language) })}
        </Text>
      )}
    </View>
  );
}
