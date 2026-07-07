import { useEffect, useState } from 'react';
import { View, Text, Pressable, ScrollView, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { CategorySelect } from '@/features/inventory/components/CategorySelect';
import { TagInput } from '@/features/inventory/components/TagInput';
import {
  validateRow,
  exportStockTemplate,
  type ImportRow,
} from '../utils/importStock';

interface CsvImportReviewSheetProps {
  visible: boolean;
  /** Rows parsed from the CSV; seeded into local editable state on open. */
  rows: ImportRow[];
  onClose: () => void;
  onConfirm: (rows: ImportRow[]) => void;
}

/**
 * Full-height review sheet for CSV-imported stock. Every row is fully editable
 * (title, category, unit, cost, qty, sale price, barcode, tags, note) before it
 * becomes a purchase line. Invalid rows (no name / qty ≤ 0 / cost ≤ 0) are
 * flagged and block the confirm action until fixed or removed.
 */
export function CsvImportReviewSheet({ visible, rows, onClose, onConfirm }: CsvImportReviewSheetProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ImportRow[]>(rows);

  // Re-seed whenever a fresh parse opens the sheet.
  useEffect(() => {
    if (visible) setDraft(rows);
  }, [visible, rows]);

  const patch = (id: string, field: keyof ImportRow, value: ImportRow[keyof ImportRow]) =>
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const remove = (id: string) => setDraft((prev) => prev.filter((r) => r.id !== id));

  const validCount = draft.filter((r) => validateRow(r).length === 0).length;
  const canConfirm = draft.length > 0 && validCount === draft.length;

  const onTemplate = async () => {
    try {
      await exportStockTemplate();
    } catch (err) {
      Alert.alert(t('documents.import.errors.title'), String((err as Error)?.message ?? err));
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} className="px-4 pt-4">
      {/* Header */}
      <View className={`${ROW} items-center justify-between mb-1`}>
        <Pressable onPress={onClose} hitSlop={8} accessibilityLabel={t('common.cancel')}>
          <Feather name="x" size={22} color={colors.muted} />
        </Pressable>
        <Text className="text-ink text-base font-extrabold">{t('documents.import.reviewTitle')}</Text>
      </View>
      <View className={`${ROW} items-center justify-between mb-3`}>
        <Pressable className={`${ROW} items-center gap-1.5`} onPress={onTemplate} accessibilityRole="button">
          <Feather name="download" size={14} color={colors.primary} />
          <Text className="text-primary text-xs font-bold">{t('documents.import.template')}</Text>
        </Pressable>
        <Text className="text-muted text-xs font-semibold">
          {t('documents.import.validCount', { valid: validCount, total: draft.length })}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-3 pb-4" showsVerticalScrollIndicator={false}>
        {draft.map((r, i) => {
          const errors = validateRow(r);
          const invalid = errors.length > 0;
          return (
            <View
              key={r.id}
              className={`bg-background rounded-2xl p-3.5 gap-3 border ${invalid ? 'border-danger' : 'border-border'}`}
            >
              <View className={`${ROW} items-center justify-between`}>
                <Pressable
                  className="w-9 h-9 rounded-xl bg-danger-light items-center justify-center"
                  onPress={() => remove(r.id)}
                  accessibilityLabel={`${t('common.delete')} — ${r.name}`}
                >
                  <Feather name="trash-2" size={15} color={colors.danger} />
                </Pressable>
                <Text className="text-muted text-xs font-bold">
                  {t('documents.import.rowLabel', { n: i + 1 })}
                </Text>
              </View>

              <LabeledInput
                label={t('inventory.form.name')}
                value={r.name}
                onChangeText={(v) => patch(r.id, 'name', v)}
                placeholder={t('inventory.form.namePlaceholder')}
              />

              <CategorySelect
                label={t('inventory.form.category')}
                value={r.category}
                onChange={(v) => patch(r.id, 'category', v)}
              />

              <View className={`${ROW} gap-3`}>
                <View className="flex-1">
                  <LabeledInput
                    label={t('documents.unitCost')}
                    value={r.cost}
                    onChangeText={(v) => patch(r.id, 'cost', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </View>
                <View className="flex-1">
                  <LabeledInput
                    label={t('documents.qty')}
                    value={r.qty}
                    onChangeText={(v) => patch(r.id, 'qty', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </View>
              </View>

              <View className={`${ROW} gap-3`}>
                <View className="flex-1">
                  <LabeledInput
                    label={t('inventory.form.salePrice')}
                    value={r.salePrice}
                    onChangeText={(v) => patch(r.id, 'salePrice', v)}
                    keyboardType="decimal-pad"
                    placeholder="0"
                  />
                </View>
                <View className="flex-1">
                  <LabeledInput
                    label={t('inventory.form.barcode')}
                    value={r.barcode}
                    onChangeText={(v) => patch(r.id, 'barcode', v)}
                  />
                </View>
              </View>

              <TagInput
                label={t('inventory.form.tags')}
                value={r.tags}
                onChange={(v) => patch(r.id, 'tags', v)}
              />

              <LabeledInput
                label={t('inventory.form.notes')}
                value={r.note}
                onChangeText={(v) => patch(r.id, 'note', v)}
                placeholder={t('inventory.form.notesPlaceholder')}
              />

              {invalid && (
                <Text className="text-danger text-xs text-right">
                  {errors.map((e) => t(e)).join(' · ')}
                </Text>
              )}
            </View>
          );
        })}

        {draft.length === 0 && (
          <View className="items-center py-10 gap-3">
            <Feather name="inbox" size={40} color={colors['slate-400']} />
            <Text className="text-muted text-sm">{t('documents.import.empty')}</Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View className="py-3 border-t border-border">
        <Pressable
          className="rounded-2xl py-4 items-center bg-primary"
          onPress={() => onConfirm(draft)}
          disabled={!canConfirm}
          style={{ opacity: canConfirm ? 1 : 0.5 }}
          accessibilityRole="button"
        >
          <Text className="text-white text-sm font-extrabold">
            {t('documents.import.addCount', { n: draft.length })}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
