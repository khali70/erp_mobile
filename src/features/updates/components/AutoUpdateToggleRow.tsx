import { useTranslation } from 'react-i18next';
import { SettingsSwitchRow } from '@/features/settings/components/SettingsSwitchRow';

interface AutoUpdateToggleRowProps {
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}

/**
 * "Check on launch" toggle — a thin wrapper that owns the updates-specific copy
 * and reuses the shared SettingsSwitchRow so it is visually identical to every
 * other settings switch.
 */
export function AutoUpdateToggleRow({ value, onValueChange, disabled }: AutoUpdateToggleRowProps) {
  const { t } = useTranslation();
  return (
    <SettingsSwitchRow
      label={t('updates.autoCheck.label')}
      hint={t('updates.autoCheck.hint')}
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
    />
  );
}
