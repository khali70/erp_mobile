import { ScrollView, Text, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { SettleDateField } from '@/features/payments/components/SettleDateField';
import { ROW } from '@/theme/rtl';
import { ExpenseDraft, useExpenseForm } from '../hooks/useExpenseForm';
import { AddExpenseSheetHeader } from './AddExpenseSheetHeader';
import { ExpenseCategoryPicker } from './ExpenseCategoryPicker';
import { ExpenseAttachmentField } from './ExpenseAttachmentField';
import { useEffect } from 'react';

interface AddExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Fired after the expense row is committed — reload the list here. */
  onSaved: () => void;
  /**
   * Category to start on. The screen passes whatever category is being filtered:
   * a man looking at a list of إيجار who taps "add" is adding rent.
   */
  initialCategory?: ExpenseDraft['category'];
}

/**
 * تسجيل نفقة جديدة — and it PERSISTS now.
 *
 * This sheet used to push an object into a `useState` array over `DEMO_EXPENSES`:
 * the owner's rent survived exactly as long as the screen did. It now writes a
 * real row, which is what lets that rent be paid down later, and what lets it
 * count toward what he owes.
 *
 * `الجهة` is FREE TEXT (the landlord, the electricity company) — deliberately not
 * a supplier picker. A landlord in the Suppliers list is a man the owner has
 * never bought a box from, sitting in the list he buys from.
 */
export function AddExpenseSheet({
  visible,
  onClose,
  onSaved,
  initialCategory,
}: AddExpenseSheetProps) {
  const { t } = useTranslation();

  const {
    draft,
    setTitle,
    setCategory,
    setAmount,
    setPartyName,
    setNote,
    shiftDate,
    addAttachment,
    removeAttachmentAt,
    canSave,
    submit,
  } = useExpenseForm({ visible, onSaved });

  // useExpenseForm resets the draft when the sheet opens, so seed the category
  // after that reset, not before it.
  useEffect(() => {
    if (visible && initialCategory) setCategory(initialCategory);
  }, [visible, initialCategory, setCategory]);

  return (
    <BottomSheet visible={visible} onClose={onClose} className="overflow-hidden">
      <AddExpenseSheetHeader onClose={onClose} />

      <ScrollView
        className="flex-1"
        contentContainerClassName="p-5 gap-4 pb-8"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <LabeledInput
          label={t('expenses.form.statement')}
          value={draft.title}
          onChangeText={setTitle}
          placeholder={t('expenses.form.statementPlaceholder')}
        />

        <ExpenseCategoryPicker value={draft.category} onChange={setCategory} />

        <LabeledInput
          label={t('expenses.form.amount')}
          value={draft.amount}
          onChangeText={setAmount}
          placeholder="0"
          keyboardType="decimal-pad"
        />

        <LabeledInput
          label={t('expenses.form.party')}
          value={draft.partyName}
          onChangeText={setPartyName}
          placeholder={t('expenses.form.partyPlaceholder')}
        />

        <SettleDateField
          value={draft.incurredAt}
          onShift={shiftDate}
          label={t('expenses.form.date')}
        />

        <ExpenseAttachmentField
          attachments={draft.attachments}
          onAdd={addAttachment}
          onRemove={removeAttachmentAt}
        />

        <LabeledInput
          label={t('payments.note')}
          value={draft.note}
          onChangeText={setNote}
          placeholder={t('payments.notePlaceholder')}
          multiline
        />

        <View className={`${ROW} gap-3 pt-1`}>
          <Pressable
            className="flex-1 items-center py-3.5 rounded-2xl bg-background border border-border"
            onPress={onClose}
            accessibilityRole="button"
          >
            <Text className="text-ink text-sm font-bold">{t('common.cancel')}</Text>
          </Pressable>

          <Pressable
            className={`flex-1 items-center py-3.5 rounded-2xl ${canSave ? 'bg-primary' : 'bg-border'}`}
            disabled={!canSave}
            onPress={submit}
            accessibilityRole="button"
          >
            <Text className={`text-sm font-bold ${canSave ? 'text-white' : 'text-muted'}`}>
              {t('expenses.form.save')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
