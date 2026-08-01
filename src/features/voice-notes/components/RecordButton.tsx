import { Pressable, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';

interface RecordButtonProps {
  recording: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** The big circular capture control: a mic when idle, a stop square while
 *  recording. One tap toggles between the two. */
export function RecordButton({ recording, disabled, onPress }: RecordButtonProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={t(recording ? 'voiceNotes.record.stop' : 'voiceNotes.record.start')}
      className={`w-24 h-24 rounded-full items-center justify-center ${
        recording ? 'bg-danger' : 'bg-primary'
      } ${disabled ? 'opacity-40' : ''}`}
    >
      <View>
        <Feather name={recording ? 'square' : 'mic'} size={36} color={colors.surface} />
      </View>
    </Pressable>
  );
}
