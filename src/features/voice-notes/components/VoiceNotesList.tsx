import { FlatList } from 'react-native';
import { VoiceNoteRow } from './VoiceNoteRow';
import { EmptyVoiceNotes } from './EmptyVoiceNotes';
import type { VoiceNote } from '../types';

interface VoiceNotesListProps {
  notes: VoiceNote[];
  /** id of the note actually playing right now (null when paused/stopped). */
  playingId: string | null;
  /** id of the note LOADED in the player — carries the live position. */
  activeId: string | null;
  /** Live position of the active note, ms. */
  positionMs: number;
  onTogglePlay: (note: VoiceNote) => void;
  onSeek: (note: VoiceNote, ms: number) => void;
  onAddIncoming: (note: VoiceNote) => void;
  onAddOutgoing: (note: VoiceNote) => void;
  onMarkDone: (note: VoiceNote) => void;
  onDiscard: (note: VoiceNote) => void;
}

/** The scrollable review list. Composition only — one <VoiceNoteRow> per note. */
export function VoiceNotesList({
  notes,
  playingId,
  activeId,
  positionMs,
  onTogglePlay,
  onSeek,
  onAddIncoming,
  onAddOutgoing,
  onMarkDone,
  onDiscard,
}: VoiceNotesListProps) {
  return (
    <FlatList
      data={notes}
      keyExtractor={(n) => n.id}
      contentContainerClassName="gap-3 pb-28"
      showsVerticalScrollIndicator={false}
      ListEmptyComponent={EmptyVoiceNotes}
      renderItem={({ item }) => (
        <VoiceNoteRow
          model={{
            note: item,
            isPlaying: playingId === item.id,
            positionMs: activeId === item.id ? positionMs : 0,
          }}
          onTogglePlay={() => onTogglePlay(item)}
          onSeek={(ms) => onSeek(item, ms)}
          onAddIncoming={() => onAddIncoming(item)}
          onAddOutgoing={() => onAddOutgoing(item)}
          onMarkDone={() => onMarkDone(item)}
          onDiscard={() => onDiscard(item)}
        />
      )}
    />
  );
}
