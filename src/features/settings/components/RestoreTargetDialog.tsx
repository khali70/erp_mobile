import { Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Dialog } from '@/components/ui/Dialog';
import type { RestoreChoice } from '../hooks/useRestoreDatabase';
import { RestoreTargetOption } from './RestoreTargetOption';

interface RestoreTargetDialogProps {
  visible: boolean;
  onChoose: (choice: RestoreChoice) => void;
  onCancel: () => void;
}

/**
 * Step one: WHICH file. A current backup is a single `.zip` and is the first,
 * primary option; the other three exist for files made by earlier builds and are
 * labelled as older so nobody reaches for them by default. Asking up front is
 * what lets a mismatch be REJECTED by name ("that is a ledger file, pick it
 * under the ledger option") instead of half-restored.
 */
export function RestoreTargetDialog({ visible, onChoose, onCancel }: RestoreTargetDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog visible={visible} onClose={onCancel}>
      <Text className="text-base font-bold text-ink text-right">
        {t('settings.restore.target.title')}
      </Text>
      <Text className="text-xs text-muted text-right leading-5">
        {t('settings.restore.target.hint')}
      </Text>

      <RestoreTargetOption
        icon="archive"
        label={t('settings.restore.target.zip')}
        hint={t('settings.restore.target.zipHint')}
        onPress={() => onChoose('zip')}
      />
      <RestoreTargetOption
        icon="package"
        label={t('settings.restore.target.merged')}
        hint={t('settings.restore.target.mergedHint')}
        onPress={() => onChoose('merged')}
      />
      <RestoreTargetOption
        icon="database"
        label={t('settings.restore.target.erp')}
        hint={t('settings.restore.target.erpHint')}
        onPress={() => onChoose('erp')}
      />
      <RestoreTargetOption
        icon="image"
        label={t('settings.restore.target.attachments')}
        hint={t('settings.restore.target.attachmentsHint')}
        onPress={() => onChoose('attachments')}
      />

      <Pressable
        onPress={onCancel}
        accessibilityRole="button"
        className="rounded-xl py-3 active:opacity-70"
      >
        <Text className="text-sm font-bold text-muted text-center">
          {t('settings.restore.target.cancel')}
        </Text>
      </Pressable>
    </Dialog>
  );
}
