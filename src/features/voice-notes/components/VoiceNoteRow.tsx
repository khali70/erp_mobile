import { View, Text, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import Feather from '@expo/vector-icons/Feather';
import colors from '@/theme/colors';
import { ROW } from '@/theme/rtl';
import { formatDay } from '@/utils/numerals';
import { SeekBar } from './SeekBar';
import type { VoiceNoteRowModel } from '../types';

interface VoiceNoteRowProps {
  model: VoiceNoteRowModel;
  onTogglePlay: () => void;
  onSeek: (ms: number) => void;
  onAddIncoming: () => void;
  onAddOutgoing: () => void;
  onMarkDone: () => void;
  onDiscard: () => void;
}

/** One captured note: play/pause, its length + capture time, a status badge, and
 *  the convert / discard actions. A note already turned into a document shows a
 *  processed badge and drops the convert actions (it must not be converted twice). */
export function VoiceNoteRow({
  model,
  onTogglePlay,
  onSeek,
  onAddIncoming,
  onAddOutgoing,
  onMarkDone,
  onDiscard,
}: VoiceNoteRowProps) {
  const { t, i18n } = useTranslation();
  const { note, isPlaying, positionMs } = model;
  const processed = note.status === 'processed' || note.linkedDocumentId !== null;

  return (
    <View className="bg-surface rounded-2xl p-3 border border-border gap-3">
      <View className={`${ROW} items-center gap-3`}>
        <Pressable
          onPress={onTogglePlay}
          accessibilityRole="button"
          accessibilityLabel={t(isPlaying ? 'voiceNotes.row.pause' : 'voiceNotes.row.play')}
          className="w-11 h-11 rounded-full bg-primary-light items-center justify-center"
        >
          <Feather name={isPlaying ? 'pause' : 'play'} size={20} color={colors.primary} />
        </Pressable>

        <View className="flex-1">
          <SeekBar
            positionMs={positionMs}
            durationMs={note.durationMs}
            isPlaying={isPlaying}
            onSeek={onSeek}
          />
        </View>

        <View
          className={`px-2 py-1 rounded-lg ${processed ? 'bg-positive-light' : 'bg-warning-light'}`}
        >
          <Text
            className={`text-[11px] font-bold ${processed ? 'text-positive' : 'text-warning-dark'}`}
          >
            {t(processed ? 'voiceNotes.status.processed' : 'voiceNotes.status.pending')}
          </Text>
        </View>
      </View>

      <View className={`${ROW} items-center justify-between`}>
        <Text className="text-xs text-muted">{formatDay(note.createdAt, i18n.language)}</Text>
        {note.note ? (
          <Text className="text-xs text-ink text-right flex-1 ms-3" numberOfLines={1}>
            {note.note}
          </Text>
        ) : null}
      </View>

      <View className={`${ROW} items-center gap-2`}>
        {processed ? (
          <View className={`${ROW} items-center gap-1.5 flex-1`}>
            <Feather name="check-circle" size={14} color={colors.positive} />
            <Text className="text-xs text-muted">{t('voiceNotes.row.converted')}</Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={onAddIncoming}
              accessibilityRole="button"
              accessibilityLabel={t('voiceNotes.row.addIncoming')}
              className={`${ROW} flex-1 items-center justify-center gap-1.5 bg-positive-light rounded-xl py-2`}
            >
              <Feather name="arrow-down-circle" size={16} color={colors.positive} />
              <Text className="text-xs font-bold text-positive">
                {t('voiceNotes.row.addIncoming')}
              </Text>
            </Pressable>
            <Pressable
              onPress={onAddOutgoing}
              accessibilityRole="button"
              accessibilityLabel={t('voiceNotes.row.addOutgoing')}
              className={`${ROW} flex-1 items-center justify-center gap-1.5 bg-danger-light rounded-xl py-2`}
            >
              <Feather name="arrow-up-circle" size={16} color={colors.danger} />
              <Text className="text-xs font-bold text-danger">
                {t('voiceNotes.row.addOutgoing')}
              </Text>
            </Pressable>
          </>
        )}

        {!processed && (
          <Pressable
            onPress={onMarkDone}
            accessibilityRole="button"
            accessibilityLabel={t('voiceNotes.row.markDone')}
            className="w-9 h-9 rounded-xl bg-positive-light items-center justify-center"
          >
            <Feather name="check" size={16} color={colors.positive} />
          </Pressable>
        )}

        <Pressable
          onPress={onDiscard}
          accessibilityRole="button"
          accessibilityLabel={t('voiceNotes.row.discard')}
          className="w-9 h-9 rounded-xl bg-background items-center justify-center"
        >
          <Feather name="trash-2" size={16} color={colors.muted} />
        </Pressable>
      </View>
    </View>
  );
}
