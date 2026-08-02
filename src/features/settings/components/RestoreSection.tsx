import { useTranslation } from 'react-i18next';
import { useRestoreDatabase } from '../hooks/useRestoreDatabase';
import { RestoreRow } from './RestoreRow';
import { RestoreTargetDialog } from './RestoreTargetDialog';
import { RestorePreviewDialog } from './RestorePreviewDialog';
import { RestoreProgressOverlay } from './RestoreProgressOverlay';
import { RestoreResultDialog } from './RestoreResultDialog';
import { RestoreErrorDialog } from './RestoreErrorDialog';
import { RestoreRestartBanner } from './RestoreRestartBanner';

/**
 * The whole restore affordance as ONE thing Settings can mount: the row plus
 * every step it can lead to. The state machine lives in `useRestoreDatabase`;
 * this only maps a phase to the dialog that belongs to it, so the Settings
 * screen grows by a single line and none of the flow leaks into it.
 */
export function RestoreSection() {
  const { t } = useTranslation();
  const restore = useRestoreDatabase();
  const busy = restore.phase === 'validating' || restore.phase === 'restoring';

  return (
    <>
      {restore.restartRequired ? (
        <RestoreRestartBanner />
      ) : (
        <RestoreRow onPress={restore.start} disabled={busy} />
      )}

      <RestoreTargetDialog
        visible={restore.phase === 'choosing'}
        onChoose={restore.choose}
        onCancel={restore.reset}
      />

      {restore.phase === 'preview' && restore.preview && (
        <RestorePreviewDialog
          preview={restore.preview}
          onConfirm={restore.confirm}
          onCancel={restore.cancel}
        />
      )}

      <RestoreProgressOverlay
        visible={restore.phase === 'validating'}
        title={t('settings.restore.validating.title')}
      />
      <RestoreProgressOverlay
        visible={restore.phase === 'restoring'}
        title={t('settings.restore.progress.title')}
        note={t('settings.restore.progress.note')}
      />

      <RestoreResultDialog
        visible={restore.phase === 'done'}
        attachmentsMissing={restore.attachmentsMissing}
        voiceRecordingsMissing={restore.voiceRecordingsMissing}
        onAcknowledge={restore.acknowledge}
      />

      {restore.phase === 'error' && restore.error && (
        <RestoreErrorDialog error={restore.error} onClose={restore.dismissError} />
      )}
    </>
  );
}
