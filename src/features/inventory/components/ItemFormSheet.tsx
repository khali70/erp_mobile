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
import { BarcodeScanModal } from './BarcodeScanModal';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';

const EMPTY_DRAFT: ItemDraft = {
  name: '',
  category: 'tshirts',
  unit: 'piece',
  costPrice: '',
  salePrice: '',
  pricingMode: 'fixed',
  minPrice: '',
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
  const [scanOpen, setScanOpen] = useState(false);

  useEffect(() => {
    if (visible) setDraft(initial ?? EMPTY_DRAFT);
  }, [visible, initial]);

  const update = <K extends keyof ItemDraft>(key: K, value: ItemDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const isEdit = initial !== null;
  const isDynamic = draft.pricingMode === 'negotiable';
  const canSave = draft.name.trim() !== '' && draft.salePrice.trim() !== '';

  return (
    <>
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
                    editable={false}

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

            {/* Dynamic price: the sale rate is haggled at the counter, so the sell
                screen opens a text field prefilled with the sale price above rather
                than showing it read-only. Off = one fixed price (the fast path). */}
            <Pressable
              className={`${ROW} items-start gap-3`}
              onPress={() => update('pricingMode', isDynamic ? 'fixed' : 'negotiable')}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isDynamic }}
              accessibilityLabel={t('inventory.form.dynamicPrice')}
            >
              <View
                className={`w-6 h-6 rounded-md items-center justify-center border-2 mt-0.5 ${
                  isDynamic ? 'bg-primary border-primary' : 'bg-surface border-border'
                }`}
              >
                {isDynamic && <Feather name="check" size={15} color={colors.surface} />}
              </View>
              <View className="flex-1">
                <Text className="text-ink text-sm font-bold text-right">
                  {t('inventory.form.dynamicPrice')}
                </Text>
                <Text className="text-muted text-[11px] mt-0.5 text-right">
                  {t('inventory.form.dynamicPriceHint')}
                </Text>
              </View>
            </Pressable>

            {/* Optional soft floor — only meaningful once the price can move. */}
            {isDynamic && (
              <LabeledInput
                label={t('inventory.form.minPrice')}
                value={draft.minPrice}
                onChangeText={(v) => update('minPrice', v)}
                keyboardType="numeric"
                placeholder={t('inventory.form.minPricePlaceholder')}
              />
            )}

            <LabeledInput
              label={t('inventory.form.lowStockThreshold')}
              value={draft.lowStockThreshold}
              onChangeText={(v) => update('lowStockThreshold', v)}
              keyboardType="numeric"
            />
              <View className={`${ROW} gap-2 items-end`}>
                <View className="flex-1">
                  <LabeledInput
                    label={t('inventory.form.barcode')}
                    value={draft.barcode}
                    onChangeText={(v) => update('barcode', v)}
                    keyboardType="numeric"
                  />
                </View>
                <Pressable
                  className={`${ROW} items-center gap-1.5 h-[40px] px-3 rounded-xl bg-primary border border-primary/30`}
                  onPress={() => setScanOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('inventory.form.scan')}
                >
                  <MaterialCommunityIcons
                    name={'barcode-scan'}
                    size={16}
                    color={colors.surface}
                  />
                </Pressable>
              </View>
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
      <BarcodeScanModal
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={(code) => update('barcode', code)}
      />
    </>
  );
}
