import { useCallback, useRef } from 'react';
import { View, Alert } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { FilterChips, type FilterOption } from '@/components/ui/FilterChips';
import { useVoiceNotes } from '../hooks/useVoiceNotes';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { resolveVoiceUri } from '../utils/voiceFilePath';
import { VoiceNotesList } from '../components/VoiceNotesList';
import { RecordFab } from '../components/RecordFab';
import type { VoiceFilter, VoiceNote } from '../types';

/**
 * الملاحظات الصوتية — the capture-now / process-later review screen. Composition
 * only: the centered RecordFab owns on-the-fly capture, `useVoiceNotes` owns the
 * list, and `useVoicePlayer` owns playback (one player, seekable rows). Converting
 * a note routes into the existing New Incoming/Outgoing flow, carrying the note id
 * so a successful save marks it done.
 */
export function VoiceNotesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { notes, filter, setFilter, reload, create, markDone, discard } = useVoiceNotes('pending');
  const player = useVoicePlayer();

  // Latest player in a ref so the focus effect can stop playback on blur WITHOUT
  // depending on `player` — that object is new every render (and now changes every
  // playback tick), and depending on it would re-fire the effect on every
  // re-render (an infinite focus/reload loop → "Maximum update depth exceeded").
  const playerRef = useRef(player);
  playerRef.current = player;

  // Re-read on focus: a note converted on the New Incoming/Outgoing screen comes
  // back 'processed', and playback should stop when leaving the list.
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => playerRef.current.stop();
    }, [reload]),
  );

  const filterOptions: FilterOption<VoiceFilter>[] = [
    { key: 'pending', label: t('voiceNotes.filters.pending'), activeClass: 'bg-warning-dark' },
    { key: 'processed', label: t('voiceNotes.filters.processed'), activeClass: 'bg-positive' },
    { key: 'all', label: t('voiceNotes.filters.all'), activeClass: 'bg-primary' },
  ];

  // Resolve BY BASENAME: a restored note's stored uri is an absolute path from a
  // different install; the file it plays lives in THIS device's voice dir.
  const togglePlay = useCallback(
    (note: VoiceNote) => player.toggle(note.id, resolveVoiceUri(note.filePath)),
    [player],
  );

  const seekNote = useCallback(
    (note: VoiceNote, ms: number) => player.seek(note.id, resolveVoiceUri(note.filePath), ms),
    [player],
  );

  const convert = useCallback(
    (note: VoiceNote, route: 'NewIncoming' | 'NewOutgoing') => {
      player.stop();
      navigation.navigate(route, { voiceNoteId: note.id });
    },
    [navigation, player],
  );

  const doneNote = useCallback(
    (note: VoiceNote) => {
      if (player.activeId === note.id) player.stop();
      markDone(note.id);
    },
    [player, markDone],
  );

  const confirmDiscard = useCallback(
    (note: VoiceNote) => {
      Alert.alert(t('voiceNotes.discard.title'), t('voiceNotes.discard.body'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('voiceNotes.discard.confirm'),
          style: 'destructive',
          onPress: () => {
            if (player.activeId === note.id) player.stop();
            discard(note.id);
          },
        },
      ]);
    },
    [t, player, discard],
  );

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('voiceNotes.title')}
        onBack={() => navigation.goBack()}
        backLabel={t('common.back')}
      />

      <View className="flex-1 px-4 pt-3.5 gap-4">
        <FilterChips options={filterOptions} value={filter} onChange={setFilter} />
        <VoiceNotesList
          notes={notes}
          playingId={player.playingId}
          activeId={player.activeId}
          positionMs={player.positionMs}
          onTogglePlay={togglePlay}
          onSeek={seekNote}
          onAddIncoming={(n) => convert(n, 'NewIncoming')}
          onAddOutgoing={(n) => convert(n, 'NewOutgoing')}
          onMarkDone={doneNote}
          onDiscard={confirmDiscard}
        />
      </View>

      {/* The ONE primary capture control, centered over the list. */}
      <View className="absolute inset-x-0 bottom-0 pb-6 items-center bg-background/80">
        <RecordFab onCaptured={(rec) => create(rec)} />
      </View>
    </View>
  );
}
