import { View, Text, ActivityIndicator } from 'react-native';
import colors from '@/theme/colors';
import { Dialog } from '@/components/ui/Dialog';

interface RestoreProgressOverlayProps {
  visible: boolean;
  title: string;
  note?: string;
}

/**
 * Blocking progress. NO `onClose` on purpose — that is what makes the dialog
 * refuse both a backdrop tap and the Android hardware back button, which it must
 * while a database file is mid-copy: a dismissal here would return the owner to
 * a Settings screen whose data handle has already been closed.
 */
export function RestoreProgressOverlay({ visible, title, note }: RestoreProgressOverlayProps) {
  return (
    <Dialog visible={visible}>
      <View className="items-center gap-3 py-2">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text className="text-sm font-bold text-ink text-center">{title}</Text>
        {note ? <Text className="text-xs text-muted text-center leading-5">{note}</Text> : null}
      </View>
    </Dialog>
  );
}
