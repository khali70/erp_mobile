import { useCallback } from 'react';
import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatNumber } from '@/utils/numerals';
import { useVoicePlayer } from '../hooks/useVoicePlayer';
import { resolveVoiceUri } from '../utils/voiceFilePath';
import { SeekBar } from './SeekBar';
import type { VoiceNote } from '../types';

interface VoiceQueueCardProps {
  /** The active pending note being converted. */
  note: VoiceNote;
  /** 1-based position of this note in the queue. */
  index: number;
  /** Total pending notes in the queue. */
  total: number;
  /** Advance to the next queued note (omitted at the tail of the queue). */
  onNext?: () => void;
}

/**
 * The compact convert-queue player pinned atop the New Incoming/Outgoing screen:
 * the active pending note with a seekable bar, play/pause, and its queue position
 * (`n / total`). It owns its OWN single `useVoicePlayer` — one player for this
 * screen, never many — so playing here plays only this note. Empty queues never
 * render this card (the screen hides it).
 */
export function VoiceQueueCard({ note, index, total, onNext }: VoiceQueueCardProps) {
  const { t, i18n } = useTranslation();
  const player = useVoicePlayer();
  const lang = i18n.language;

  const isActive = player.activeId === note.id;
  const isPlaying = player.playingId === note.id;

  // Resolve BY BASENAME so a restored note plays from this device's voice dir.
  const toggle = useCallback(
    () => player.toggle(note.id, resolveVoiceUri(note.filePath)),
    [player, note],
  );
  const seek = useCallback(
    (ms: number) => player.seek(note.id, resolveVoiceUri(note.filePath), ms),
    [player, note],
  );

  return (
    <View className="bg-surface border-b border-border px-4 py-3 gap-2">
      <View className={`${ROW} items-center justify-between`}>
        <Text className="text-xs font-bold text-muted">{t('voiceNotes.queue.title')}</Text>
        <Text className="text-xs font-bold text-primary">
          {t('voiceNotes.queue.position', {
            index: formatNumber(index, lang),
            total: formatNumber(total, lang),
          })}
        </Text>
      </View>

      <View className={`${ROW} items-center gap-3`}>
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityLabel={t(isPlaying ? 'voiceNotes.row.pause' : 'voiceNotes.row.play')}
          className="w-10 h-10 rounded-full bg-primary-light items-center justify-center"
        >
          <Feather name={isPlaying ? 'pause' : 'play'} size={18} color={colors.primary} />
        </Pressable>

        <View className="flex-1">
          <SeekBar
            positionMs={isActive ? player.positionMs : 0}
            durationMs={note.durationMs}
            isPlaying={isPlaying}
            onSeek={seek}
          />
        </View>

        {onNext && (
          <Pressable
            onPress={() => {
              player.stop();
              onNext();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('voiceNotes.queue.next')}
            className={`${ROW} items-center gap-1 bg-primary-light rounded-xl px-2.5 py-2`}
          >
            <Text className="text-xs font-bold text-primary">{t('voiceNotes.queue.next')}</Text>
            <Feather name="skip-forward" size={14} color={colors.primary} />
          </Pressable>
        )}
      </View>
    </View>
  );
}
