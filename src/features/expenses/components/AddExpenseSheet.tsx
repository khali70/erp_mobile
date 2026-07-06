import { useState } from 'react';
import { Modal, View, Text, Pressable, TextInput, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { CATEGORY_META, type Expense, type ExpenseCategory } from '../data';

const CATEGORIES: ExpenseCategory[] = ['rent', 'salaries', 'utilities', 'transport', 'other'];
let seq = 0;

interface AddExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  onSave: (expense: Expense) => void;
}

/**
 * "تسجيل نفقة جديدة" bottom sheet: statement, category select, amount, and a
 * file-attachment input (invoice/receipt photo) per the design annotation.
 * Attachment is a stub until expo-document-picker is wired.
 */
export function AddExpenseSheet({ visible, onClose, onSave }: AddExpenseSheetProps) {
  const { t } = useTranslation();
  const [statement, setStatement] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('rent');
  const [amount, setAmount] = useState('');
  const [attached, setAttached] = useState(false);

  const reset = () => {
    setStatement('');
    setCategory('rent');
    setAmount('');
    setAttached(false);
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = () => {
    const value = Number.parseInt(amount || '0', 10) || 0;
    onSave({ id: `n${seq++}`, statement: statement.trim(), category, amount: value, day: 7 });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable className="flex-1 bg-black/40 justify-end" onPress={close}>
        <Pressable
          className="bg-surface rounded-t-3xl overflow-hidden max-h-[88%]"
          onPress={(e) => e.stopPropagation()}
        >
          {/* teal header */}
          <View className={`${ROW} items-center justify-between bg-primary px-4 py-4`}>
            <Pressable
              className="w-9 h-9 rounded-full bg-white/20 items-center justify-center"
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Feather name="x" size={18} color={colors.surface} />
            </Pressable>
            <View className={`${ROW} items-center gap-2`}>
              <Text className="text-white text-base font-extrabold">{t('expenses.add')}</Text>
              <Feather name="plus" size={18} color={colors.surface} />
            </View>
          </View>

          <ScrollView contentContainerClassName="p-4 gap-4" showsVerticalScrollIndicator={false}>
            {/* statement */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted text-right">{t('expenses.form.statement')}</Text>
              <TextInput
                className="bg-background text-ink px-3.5 py-3 rounded-xl border border-primary/40 text-sm text-right"
                value={statement}
                onChangeText={setStatement}
                placeholder={t('expenses.form.statementPlaceholder')}
                placeholderTextColor={colors['slate-400']}
              />
            </View>

            {/* category select */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted text-right">{t('expenses.form.category')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 flex-row-reverse">
                {CATEGORIES.map((c) => {
                  const active = c === category;
                  const meta = CATEGORY_META[c];
                  return (
                    <Pressable
                      key={c}
                      className={`${ROW} items-center gap-1.5 px-3.5 py-2.5 rounded-xl border ${
                        active ? 'bg-primary border-transparent' : 'bg-background border-border'
                      }`}
                      onPress={() => setCategory(c)}
                    >
                      <Feather name={meta.icon} size={14} color={active ? colors.surface : meta.color} />
                      <Text className={`text-xs font-bold ${active ? 'text-white' : 'text-muted'}`}>
                        {t(`expenses.filters.${c}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            {/* amount */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted text-right">{t('expenses.form.amount')}</Text>
              <TextInput
                className="bg-background text-ink px-3.5 py-3 rounded-xl border border-border text-sm text-right"
                value={amount}
                onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
                placeholder="0"
                placeholderTextColor={colors['slate-400']}
                keyboardType="number-pad"
              />
            </View>

            {/* attachment (annotation: add file attachment input) */}
            <View className="gap-1.5">
              <Text className="text-xs font-semibold text-muted text-right">{t('expenses.form.attachment')}</Text>
              <Pressable
                className={`${ROW} items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed ${
                  attached ? 'border-positive bg-positive-light' : 'border-primary/40 bg-background'
                }`}
                onPress={() => setAttached((v) => !v)}
              >
                <Feather
                  name={attached ? 'check-circle' : 'paperclip'}
                  size={16}
                  color={attached ? colors.positive : colors.primary}
                />
                <Text className={`text-sm font-bold ${attached ? 'text-positive' : 'text-primary'}`}>
                  {attached ? t('expenses.form.attachmentHint') : t('expenses.form.attach')}
                </Text>
              </Pressable>
              {!attached && (
                <Text className="text-muted text-[11px] text-right">{t('expenses.form.attachmentHint')}</Text>
              )}
            </View>

            {/* actions */}
            <View className={`${ROW} gap-3 pt-1 pb-4`}>
              <Pressable className="flex-1 items-center py-3.5 rounded-xl bg-background border border-border" onPress={close}>
                <Text className="text-ink text-sm font-bold">{t('common.cancel')}</Text>
              </Pressable>
              <Pressable className="flex-1 items-center py-3.5 rounded-xl bg-primary" onPress={save}>
                <Text className="text-white text-sm font-bold">{t('expenses.form.save')}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
