import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';
import { LabeledInput } from '@/components/ui/LabeledInput';
import type { PartyDraft } from '../types';

const EMPTY_DRAFT: PartyDraft = { name: '', phone: '' };

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

/** Add / edit party sheet. Presentational + local form state. */
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
  const [draft, setDraft] = useState<PartyDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (visible) setDraft(initial ?? EMPTY_DRAFT);
  }, [visible, initial]);

  const update = <K extends keyof PartyDraft>(key: K, value: PartyDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const canSave = draft.name.trim() !== '';

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
            <LabeledInput
              label={t('parties.form.name')}
              value={draft.name}
              onChangeText={(v) => update('name', v)}
              placeholder={t('parties.form.namePlaceholder')}
            />
            <LabeledInput
              label={t('parties.form.phone')}
              value={draft.phone}
              onChangeText={(v) => update('phone', v)}
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
