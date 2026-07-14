import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { openAttachment } from '@/utils/attachments';
import type { AttachmentMeta } from '@/repositories/document-repository';

interface ExpenseAttachmentFieldProps {
  attachments: AttachmentMeta[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}

/**
 * إرفاق ملف — the bill or receipt photo.
 *
 * Real bytes, ingested into the attachments DB (this used to be a toggle that
 * stored a boolean and no file). It is proof the expense EXISTS — distinct from
 * `transactions.attachments`, which is proof the money MOVED: an InstaPay
 * screenshot for the rent is evidence of the payment, not of the bill.
 */
export function ExpenseAttachmentField({
  attachments,
  onAdd,
  onRemove,
}: ExpenseAttachmentFieldProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className={`${ROW} items-center justify-between`}>
        <Pressable
          className={`${ROW} items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-primary bg-primary-light`}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('expenses.form.attach')}
        >
          <Feather name="paperclip" size={14} color={colors.primary} />
          <Text className="text-primary text-xs font-bold">{t('expenses.form.attach')}</Text>
        </Pressable>
        <Text className="text-xs font-semibold text-muted">{t('expenses.form.attachment')}</Text>
      </View>

      {attachments.length === 0 ? (
        <Text className="text-muted text-[11px] text-right">
          {t('expenses.form.attachmentHint')}
        </Text>
      ) : (
        attachments.map((a) => (
          <View
            key={a.id}
            className={`${ROW} items-center gap-2 bg-background rounded-xl px-3 py-2`}
          >
            <Feather name="image" size={14} color={colors.muted} />
            <Pressable
              className="flex-1"
              onPress={() => openAttachment(a)}
              accessibilityRole="button"
            >
              <Text className="text-ink text-xs text-right" numberOfLines={1}>
                {a.name}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onRemove(a.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
            >
              <Feather name="x" size={14} color={colors.danger} />
            </Pressable>
          </View>
        ))
      )}
    </View>
  );
}
