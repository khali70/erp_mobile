import { View, Text, Pressable, Modal, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW, HEADER_OVERLAY } from '@/theme/rtl';
import { NumericInput } from '@/components/ui/NumericInput';
import { TagInput } from '@/features/inventory/components/TagInput';
import { useCategories } from '@/features/inventory/hooks/useCategories';
import type { DocLine, DocMode } from '../types';
import { useEditLineDraft } from '../hooks/useEditLineDraft';
import { FieldError } from './FieldError';

interface EditDocLineSheetProps {
  visible: boolean;
  /** The line being edited; null while closed (draft seeds from it on open). */
  line: DocLine | null;
  mode: DocMode;
  /** Sale qty ceiling for this line; null/undefined = unbounded. */
  maxQty?: number | null;
  onClose: () => void;
  /** Apply the validated patch; the parent wires this to useDocumentForm.updateLine. */
  onSave: (patch: Partial<DocLine>) => void;
}

/**
 * Full editor for ONE document line, opened by long-pressing / double-tapping a
 * row. A fast path to change several fields at once instead of poking the inline
 * stepper and price box one at a time.
 *
 * Field set is DIRECTION-SCOPED (utils/editLineFields): a sale edits qty / unit
 * price / note; a purchase edits the whole ad-hoc descriptor. All rules — parse,
 * qty > 0, price ≥ 0, negotiable min-price floor, sale over-stock — live in
 * useEditLineDraft, not here. This file is composition only.
 */
export function EditDocLineSheet({
  visible,
  line,
  mode,
  maxQty,
  onClose,
  onSave,
}: EditDocLineSheetProps) {
  const { t } = useTranslation();
  const { categories } = useCategories();
  const { fields, draft, setField, errors, isValid, buildPatch } = useEditLineDraft(
    line,
    mode,
    maxQty,
  );
  const currency = t('common.currency');

  const handleSave = () => {
    if (!isValid || !line) return;
    onSave(buildPatch());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-center px-4">
        <View className="bg-surface rounded-3xl overflow-hidden">
          <View className={`bg-primary px-5 py-4 ${ROW} items-center justify-between`}>
            <View className={`${ROW} items-center gap-2`}>
              <Feather name="edit-3" size={18} color={colors['primary-200']} />
              <Text className="text-white font-bold text-base">{t('documents.editLine.title')}</Text>
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

          <ScrollView
            className="max-h-[70%]"
            contentContainerClassName="p-5 gap-4"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {line ? (
              <Text className="text-ink text-sm font-extrabold text-right" numberOfLines={2}>
                {line.name}
              </Text>
            ) : null}

            {/* Title / name — purchase only */}
            {fields.includes('name') && (
              <View className="gap-1">
                <Text className="text-[11px] font-semibold text-muted text-right">
                  {t('documents.quick.title')}
                </Text>
                <TextInput
                  className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm text-right"
                  value={draft.name}
                  onChangeText={(v) => setField('name', v)}
                  placeholder={t('documents.quick.titlePlaceholder')}
                  placeholderTextColor={colors.muted}
                />
                {errors.name ? <FieldError message={errors.name} /> : null}
              </View>
            )}

            {/* Unit price / cost */}
            {fields.includes('unitPrice') && (
              <View className="gap-1">
                <Text className="text-[11px] font-semibold text-muted text-right">
                  {mode === 'sale' ? t('documents.unitPrice') : t('documents.unitCost')}
                </Text>
                <View className={`${ROW} items-center gap-2`}>
                  <Text className="text-muted text-xs">{currency}</Text>
                  <NumericInput
                    className="flex-1 bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm text-center"
                    keyboardType="decimal-pad"
                    value={draft.unitPrice}
                    onChangeText={(v) => setField('unitPrice', v)}
                    placeholder="0"
                    placeholderTextColor={colors['slate-400']}
                    selectTextOnFocus
                  />
                </View>
                {errors.unitPrice ? <FieldError message={errors.unitPrice} /> : null}
              </View>
            )}

            {/* Qty */}
            {fields.includes('qty') && (
              <View className="gap-1">
                <Text className="text-[11px] font-semibold text-muted text-right">
                  {t('documents.qty')}
                </Text>
                <NumericInput
                  className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm text-center"
                  keyboardType="decimal-pad"
                  value={draft.qty}
                  onChangeText={(v) => setField('qty', v)}
                  placeholder="0"
                  placeholderTextColor={colors['slate-400']}
                  selectTextOnFocus
                />
                {errors.qty ? <FieldError message={errors.qty} /> : null}
              </View>
            )}

            {/* Category chips — purchase only */}
            {fields.includes('category') && (
              <View className="gap-1">
                <Text className="text-[11px] font-semibold text-muted text-right">
                  {t('inventory.form.category')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerClassName={`${ROW} gap-2`}
                >
                  {categories.map((c) => {
                    const active = c.name === draft.category;
                    const label = c.i18nKey ? t(`inventory.categories.${c.i18nKey}`) : c.name;
                    return (
                      <Pressable
                        key={c.id}
                        className={`px-3.5 py-1.5 rounded-full border ${active ? 'bg-primary border-transparent' : 'bg-background border-border'}`}
                        onPress={() => setField('category', active ? '' : c.name)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Tags — purchase only */}
            {fields.includes('tags') && (
              <TagInput
                label={t('inventory.form.tags')}
                value={draft.tags}
                onChange={(v) => setField('tags', v)}
              />
            )}

            {/* Note */}
            {fields.includes('note') && (
              <View className="gap-1">
                <Text className="text-[11px] font-semibold text-muted text-right">
                  {t('documents.note')}
                </Text>
                <TextInput
                  className="bg-background text-ink px-3 py-2.5 rounded-xl border border-border text-sm text-right"
                  value={draft.note}
                  onChangeText={(v) => setField('note', v)}
                  placeholder={t('documents.notePlaceholder')}
                  placeholderTextColor={colors.muted}
                  multiline
                  style={{ textAlignVertical: 'top', minHeight: 56 }}
                />
              </View>
            )}

            <Pressable
              className={`mt-1 py-3.5 rounded-2xl items-center ${isValid ? 'bg-primary' : 'bg-border'}`}
              disabled={!isValid}
              onPress={handleSave}
              accessibilityRole="button"
              accessibilityLabel={t('documents.editLine.save')}
            >
              <Text className={`font-bold text-base ${isValid ? 'text-white' : 'text-muted'}`}>
                {t('documents.editLine.save')}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
