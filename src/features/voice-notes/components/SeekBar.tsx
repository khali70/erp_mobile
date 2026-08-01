import { useMemo, useRef, useState } from 'react';
import { View, Text, PanResponder, type LayoutChangeEvent } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ROW } from '@/theme/rtl';
import { formatDuration } from '../utils/formatTime';

interface SeekBarProps {
  /** Current playback position in ms. Ignored while the user is dragging. */
  positionMs: number;
  /** Total length of the clip in ms — the full progress track. */
  durationMs: number;
  /** Called on drag-release / tap-on-track with the seeked position in ms. */
  onSeek: (ms: number) => void;
  /** Purely cosmetic: brightens the fill while the note is playing. */
  isPlaying?: boolean;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * A WhatsApp-style seekable progress bar. Owns ONLY its local drag state; the
 * playback position and duration flow in as props from the single `useVoicePlayer`
 * owner, and a seek flows back out through `onSeek`.
 *
 * While the finger is down the bar shows the DRAGGED fraction and ignores the
 * incoming `positionMs`, so the thumb never fights the player tick; on release it
 * emits the seeked position once.
 *
 * The app is Arabic-only and always renders right-to-left (see `ROW`), regardless
 * of whether `I18nManager.isRTL` is true or the layout falls back to
 * `flex-row-reverse`. So this bar is UNCONDITIONALLY RTL: the fill and thumb are
 * anchored to the physical right (position 0 = right edge) and the touch ratio is
 * mirrored. `right`/`left` and `locationX` are never auto-flipped by RN, so this
 * renders identically in both native RTL modes — keying it off `I18nManager.isRTL`
 * was the bug (LTR fill whenever native RTL was not applied).
 */
export function SeekBar({ positionMs, durationMs, onSeek, isPlaying }: SeekBarProps) {
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const [dragFrac, setDragFrac] = useState<number | null>(null);

  // Refs so the PanResponder (built once) always reads the freshest values.
  const widthRef = useRef(0);
  const startXRef = useRef(0);
  const durationRef = useRef(durationMs);
  durationRef.current = durationMs;

  const trackFrac = durationMs > 0 ? clamp01(positionMs / durationMs) : 0;
  const frac = dragFrac ?? trackFrac;

  // The track runs right-to-left: a touch on the right edge means 0 and the left
  // edge means full, so mirror the horizontal ratio. `locationX` is always
  // measured from the physical left, in both native RTL modes.
  const ratioFromX = (x: number) => {
    const raw = widthRef.current > 0 ? x / widthRef.current : 0;
    return clamp01(1 - raw);
  };

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          startXRef.current = evt.nativeEvent.locationX;
          setDragFrac(ratioFromX(evt.nativeEvent.locationX));
        },
        onPanResponderMove: (_evt, gesture) => {
          setDragFrac(ratioFromX(startXRef.current + gesture.dx));
        },
        onPanResponderRelease: (_evt, gesture) => {
          const f = ratioFromX(startXRef.current + gesture.dx);
          setDragFrac(null);
          onSeek(Math.round(f * durationRef.current));
        },
        onPanResponderTerminate: () => setDragFrac(null),
      }),
    // Built once; all moving values are read through refs.
    [],
  );

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const shownMs = dragFrac !== null ? Math.round(dragFrac * durationMs) : positionMs;
  const thumbOffset = Math.max(0, frac * width);

  return (
    <View className="gap-1">
      <View
        onLayout={onLayout}
        {...pan.panHandlers}
        accessibilityRole="adjustable"
        accessibilityLabel={t('voiceNotes.player.seek')}
        className="justify-center py-2"
      >
        <View className="h-1.5 rounded-full bg-border overflow-hidden">
          <View
            className={`absolute top-0 bottom-0 rounded-full ${isPlaying ? 'bg-primary' : 'bg-primary-dark'}`}
            style={{ right: 0, width: `${frac * 100}%` }}
          />
        </View>
        <View
          className="absolute w-3.5 h-3.5 rounded-full bg-primary border-2 border-surface"
          style={{ right: thumbOffset - 7 }}
        />
      </View>

      <View className={`${ROW} items-center justify-between`}>
        <Text className="text-[11px] text-muted">{formatDuration(shownMs, i18n.language)}</Text>
        <Text className="text-[11px] text-muted">{formatDuration(durationMs, i18n.language)}</Text>
      </View>
    </View>
  );
}
