import { View, Text, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { usePartyDraft } from '../hooks/usePartyDraft';
import { useContactSuggestions } from '../hooks/useContactSuggestions';
import { ContactsImportButton } from './ContactsImportButton';
import { ContactsPermissionNote } from './ContactsPermissionNote';
import { ContactSuggestionList } from './ContactSuggestionList';
import type { ContactSuggestion, PartyDraft } from '../types';

interface PartyFormSheetProps {
  visible: boolean;
  initial: PartyDraft | null;
  titleAdd: string;
  titleEdit: string;
  onClose: () => void;
  onSave: (draft: PartyDraft) => void;
  /** When editing, an optional delete action (caller owns the confirm). */
  onDelete?: () => void;
  deleteLabel?: string;
}

/**
 * Add / edit party sheet — ONE component, used by both the customers and the
 * suppliers screen. Customers and suppliers are separate tables with separate
 * repositories; the FORM is what they share, so the contact autofill is built
 * here once rather than forked per party type.
 *
 * Composition only: the draft (and the name/phone independence rule) lives in
 * `usePartyDraft`, contacts + permission + debounce live in
 * `useContactSuggestions`, and the dropdown is three presentational components.
 */
export function PartyFormSheet({
  visible,
  initial,
  titleAdd,
  titleEdit,
  onClose,
  onSave,
  onDelete,
  deleteLabel,
}: PartyFormSheetProps) {
  const { t } = useTranslation();
  const { draft, setName, setPhone, pickContact, canSave } = usePartyDraft(visible, initial);
  const contacts = useContactSuggestions(visible);

  const handleNameChange = (value: string) => {
    setName(value);
    // The search reads the name; it never writes it back. What the owner typed
    // stays exactly as typed until he taps a row himself.
    contacts.search(value);
  };

  const handlePick = (contact: ContactSuggestion) => {
    pickContact(contact);
    contacts.dismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center px-4">
        <View className="bg-surface rounded-3xl overflow-hidden">
          <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
            <View className={`${ROW} items-center gap-2`}>
              <Feather name="user-plus" size={20} color={colors['primary-200']} />
              <Text className="text-white font-bold text-base">
                {initial ? titleEdit : titleAdd}
              </Text>
            </View>
            <Pressable
              className="w-8 h-8 rounded-full items-center justify-center"
              style={{ backgroundColor: HEADER_OVERLAY }}
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Feather name="x" size={16} color={colors.surface} />
            </Pressable>
          </View>

          <View className="p-5 gap-4">
            <View className="gap-2">
              <LabeledInput
                label={t('parties.form.name')}
                value={draft.name}
                onChangeText={handleNameChange}
                placeholder={t('parties.form.namePlaceholder')}
                // First ENGAGEMENT asks for contacts — not mount, not launch.
                onFocus={contacts.engage}
                accessory={
                  <ContactsImportButton access={contacts.access} onPress={contacts.engage} />
                }
              />
              {contacts.open && (
                <ContactSuggestionList
                  suggestions={contacts.suggestions}
                  loading={contacts.access === 'loading'}
                  truncated={contacts.truncated}
                  limit={contacts.limit}
                  onSelect={handlePick}
                  onDismiss={contacts.dismiss}
                />
              )}
              <ContactsPermissionNote access={contacts.access} onRetry={contacts.retry} />
            </View>

            {/*
              Phone. `setPhone` is phone-only BY CONSTRUCTION (see
              utils/party-draft.ts): no contact lookup runs here, and nothing
              typed into this box can reach `draft.name`.
            */}
            <LabeledInput
              label={t('parties.form.phone')}
              value={draft.phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Pressable
              className={`mt-1 py-3.5 rounded-2xl items-center ${canSave ? 'bg-primary' : 'bg-border'}`}
              disabled={!canSave}
              onPress={() => onSave(draft)}
              accessibilityRole="button"
            >
              <Text className={`font-bold text-base ${canSave ? 'text-white' : 'text-muted'}`}>
                {t('common.save')}
              </Text>
            </Pressable>

            {/* Delete only when editing an existing party. */}
            {initial && onDelete && (
              <Pressable
                className={`${ROW} items-center justify-center gap-2 py-3 rounded-2xl border border-danger/30`}
                onPress={onDelete}
                accessibilityRole="button"
              >
                <Feather name="trash-2" size={16} color={colors.danger} />
                <Text className="text-danger font-bold text-sm">{deleteLabel ?? t('common.delete')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
