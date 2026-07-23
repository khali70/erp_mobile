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
 * Step one: WHICH database. The backup flow emits two files seconds apart with
 * near-identical names, so the owner is asked up front rather than left to guess
 * from a file list — and the hints name the file prefix each option expects.
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
      <RestoreTargetOption
        icon="layers"
        label={t('settings.restore.target.both')}
        hint={t('settings.restore.target.bothHint')}
        onPress={() => onChoose('both')}
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
