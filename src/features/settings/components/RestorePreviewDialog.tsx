import { useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { Dialog } from '@/components/ui/Dialog';
import { LabeledInput } from '@/components/ui/LabeledInput';
import { formatDay, formatNumber, toLocaleDigits } from '@/utils/numerals';
import type { RestorePreview } from '../restore';
import { toMegabytes } from '../utils/file-size';
import { restoreContentsKey } from '../utils/restore-messages';
import { RestoreDetailRow } from './RestoreDetailRow';

interface RestorePreviewDialogProps {
  preview: RestorePreview;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The confirm step, and the last moment anything can be called off.
 *
 * It has to make the trade unmissable in both directions: what is about to be
 * DESTROYED (everything on the phone) and what it is being replaced WITH (this
 * file, this many documents/items/parties). A row count is the only thing an
 * owner can actually check a backup against — "412 documents" reads as right or
 * obviously wrong to the person who wrote them.
 *
 * The gesture is a TYPED confirmation, not an OK button: the one action in the
 * app with no undo does not get to be a reflex tap.
 */
export function RestorePreviewDialog({ preview, onConfirm, onCancel }: RestorePreviewDialogProps) {
  const { t, i18n } = useTranslation();
  const [typed, setTyped] = useState('');

  const word = t('settings.restore.preview.confirmWord');
  const armed = typed.trim().toLocaleLowerCase() === word.toLocaleLowerCase();
  const lang = i18n.language;

  return (
    <Dialog visible onClose={onCancel} className="max-h-[88%]">
      <View className={`${ROW} items-center gap-2`}>
        <Feather name="alert-triangle" size={20} color={colors.danger} />
        <Text className="text-base font-bold text-ink">{t('settings.restore.preview.title')}</Text>
      </View>

      <ScrollView className="max-h-[62%]" contentContainerClassName="gap-3">
        <View className="gap-2 rounded-2xl border border-border bg-background p-3.5">
          <RestoreDetailRow label={t('settings.restore.preview.file')} value={preview.fileName} />
          <RestoreDetailRow
            label={t('settings.restore.preview.size')}
            value={t('settings.restore.preview.sizeValue', {
              value: toLocaleDigits(toMegabytes(preview.fileSize), lang),
            })}
          />
          <RestoreDetailRow
            label={t('settings.restore.preview.version')}
            value={formatNumber(preview.userVersion, lang)}
          />
          {preview.createdAt !== null && (
            <RestoreDetailRow
              label={t('settings.restore.preview.createdAt')}
              value={formatDay(preview.createdAt, lang)}
            />
          )}
          {/* What the file ACTUALLY holds — a full backup, a legacy ledger, or a
              legacy receipts file are three different promises. */}
          <RestoreDetailRow
            label={t('settings.restore.preview.contains')}
            value={t(restoreContentsKey(preview.format), {
              documents: formatNumber(preview.counts.documents, lang),
              items: formatNumber(preview.counts.items, lang),
              parties: formatNumber(preview.counts.parties, lang),
              attachments: formatNumber(preview.counts.attachments, lang),
            })}
          />
        </View>

        {preview.format === 'erp' && (
          <Text className="text-xs text-warning-dark text-right leading-5">
            {t('settings.restore.preview.ledgerOnlyNote')}
          </Text>
        )}

        {preview.needsMigration && (
          <Text className="text-xs text-muted text-right leading-5">
            {t('settings.restore.preview.migrationNote')}
          </Text>
        )}

        <View className="rounded-2xl bg-danger-light p-3.5">
          <Text className="text-xs text-danger text-right leading-5 font-semibold">
            {t('settings.restore.preview.warning')}
          </Text>
        </View>

        <LabeledInput
          label={t('settings.restore.preview.confirmLabel', { word })}
          value={typed}
          onChangeText={setTyped}
          placeholder={t('settings.restore.preview.confirmPlaceholder')}
        />
      </ScrollView>

      <Pressable
        onPress={onConfirm}
        disabled={!armed}
        accessibilityRole="button"
        accessibilityLabel={t('settings.restore.preview.confirm')}
        accessibilityState={{ disabled: !armed }}
        className="rounded-xl bg-danger py-3 active:opacity-80"
        style={{ opacity: armed ? 1 : 0.4 }}
      >
        <Text className="text-sm font-bold text-surface text-center">
          {t('settings.restore.preview.confirm')}
        </Text>
      </Pressable>
      <Pressable onPress={onCancel} accessibilityRole="button" className="py-2 active:opacity-70">
        <Text className="text-sm font-bold text-muted text-center">
          {t('settings.restore.preview.cancel')}
        </Text>
      </Pressable>
    </Dialog>
  );
}
