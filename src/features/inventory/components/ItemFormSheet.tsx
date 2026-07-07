import { useEffect, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';
import type { ItemDraft } from '../types';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { CategorySelect } from './CategorySelect';
import { TagInput } from './TagInput';

const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'tshirts',
  unit: 'piece',
  costPrice: '',
  salePrice: '',
  lowStockThreshold: '10',
  barcode: '',
  tags: [],
  notes: '',
};

interface ItemFormSheetProps {
  visible: boolean;
  /** Draft to edit; `null` opens a blank "add" form. */
  initial: ItemDraft | null;
  onClose: () => void;
  onSave: (draft: ItemDraft) => void;
}

/** Add / edit item sheet. Presentational + local form state; persistence is the
 * caller's concern (screen → repository in Step 1 wiring). */
export function ItemFormSheet({ visible, initial, onClose, onSave }: ItemFormSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ItemDraft>(EMPTY_DRAFT);

  useEffect(() => {
    if (visible) setDraft(initial ?? EMPTY_DRAFT);
  }, [visible, initial]);

  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const isEdit = initial !== null;
  const canSave = draft.name.trim() !== '' && draft.salePrice.trim() !== '';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center px-4">
        <View className="bg-surface rounded-3xl overflow-hidden max-h-[88%]">
          {/* Sheet header */}
          <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
            <View className={`${ROW} items-center gap-2`}>
              <Feather name="plus-circle" size={20} color={colors['primary-200']} />
              <Text className="text-white font-bold text-base">
                {isEdit ? t('inventory.form.editTitle') : t('inventory.form.addTitle')}
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

          <ScrollView contentContainerClassName="p-5 gap-4" showsVerticalScrollIndicator={false}>
            <LabeledInput
              label={t('inventory.form.name')}
              value={draft.name}
              onChangeText={(v) => update('name', v)}
              placeholder={t('inventory.form.namePlaceholder')}
            />
            <CategorySelect
              label={t('inventory.form.category')}
              value={draft.category}
              onChange={(v) => update('category', v)}
            />
            <TagInput
              label={t('inventory.form.tags')}
              value={draft.tags}
              onChange={(v) => update('tags', v)}
            />
            <View className={`${ROW} gap-3`}>
              <View className="flex-1">
                <LabeledInput
                  label={t('inventory.form.costPrice')}
                  value={draft.costPrice}
                  onChangeText={(v) => update('costPrice', v)}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1">
                <LabeledInput
                  label={t('inventory.form.salePrice')}
                  value={draft.salePrice}
                  onChangeText={(v) => update('salePrice', v)}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <LabeledInput
              label={t('inventory.form.lowStockThreshold')}
              value={draft.lowStockThreshold}
              onChangeText={(v) => update('lowStockThreshold', v)}
              keyboardType="numeric"
            />
            <LabeledInput
              label={t('inventory.form.barcode')}
              value={draft.barcode}
              onChangeText={(v) => update('barcode', v)}
              keyboardType="numeric"
            />
            <LabeledInput
              label={t('inventory.form.notes')}
              value={draft.notes}
              onChangeText={(v) => update('notes', v)}
              placeholder={t('inventory.form.notesPlaceholder')}
              multiline
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
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
