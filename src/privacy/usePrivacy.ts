import { useCallback } from 'react';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';

/**
 * Reveal state for one masked value. Consumed by <MaskedValue>; screens never
 * read this directly.
 */
export function usePrivacyValue(id: string) {
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const revealed = useUiStore((s) => s.revealed);
  const cardRevealed = useUiStore((s) => !!s.revealedCards[id]);
  const revealCard = useUiStore((s) => s.revealCard);

  const revealThis = useCallback(() => revealCard(id), [revealCard, id]);

  return {
    /** Privacy mode is on — when false the value renders untouched. */
    enabled: privacyMode,
    masked: privacyMode && !revealed && !cardRevealed,
    revealThis,
  };
}

/** Whole-app masked/revealed state for the header eye toggle. */
export function usePrivacyToggle() {
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const revealed = useUiStore((s) => s.revealed);
  const reveal = useUiStore((s) => s.reveal);
  const maskAll = useUiStore((s) => s.maskAll);

  const toggle = useCallback(() => {
    if (revealed) maskAll();
    else reveal();
  }, [revealed, reveal, maskAll]);

  return { enabled: privacyMode, revealed, toggle };
}
