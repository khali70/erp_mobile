import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import type { AttachmentMeta } from '@/repositories/document-repository';
import { openAttachment } from '@/utils/attachments';

interface PaymentProofPickerProps {
  proof: AttachmentMeta[];
  onAdd: () => void;
  onRemove: (id: string) => void;
}

/**
 * إثبات الدفع — PROOF OF MONEY, rendered only for InstaPay.
 *
 * Cash needs no proof: the money was handed over and both men saw it. An
 * InstaPay transfer IS a screenshot, and that screenshot is the only evidence
 * it ever happened.
 *
 * The proof attaches to the TRANSACTION, never the document — three
 * installments are three payments with three separate proofs, and
 * `documents.attachments` (proof of GOODS: the supplier's paper invoice) could
 * never say which is which.
 */
export function PaymentProofPicker({ proof, onAdd, onRemove }: PaymentProofPickerProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-2">
      <View className={`${ROW} items-center justify-between`}>
        <Pressable
          className={`${ROW} items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-primary bg-primary-light`}
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('payments.addProof')}
        >
          <Feather name="camera" size={14} color={colors.primary} />
          <Text className="text-primary text-xs font-bold">{t('payments.addProof')}</Text>
        </Pressable>
        <Text className="text-ink text-sm font-semibold">{t('payments.proof')}</Text>
      </View>

      {proof.length === 0 ? (
        <Text className="text-muted text-[11px] text-right">{t('payments.proofHint')}</Text>
      ) : (
        proof.map((a) => (
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
