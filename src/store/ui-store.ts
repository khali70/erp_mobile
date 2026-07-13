import { create } from 'zustand';
import type { RevealState } from '@/privacy/privacy';

// UI / client state only. Durable business data lives in SQLite, not here.
//
// Privacy note: the reveal state below is deliberately NOT persisted. A value
// the owner revealed once must never come back revealed after a restart — the
// durable flags (privacyMode / startMasked) live in settings-store instead.
type UiState = RevealState & {
  ready: boolean;
  setReady: (v: boolean) => void;

  /** Reveal every masked value (header eye toggle). */
  reveal: () => void;
  /** Reveal a single value, leaving the rest masked. */
  revealCard: (id: string) => void;
  /** Re-mask everything (eye toggle, idle timeout, background). */
  maskAll: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),

  revealed: false,
  revealedCards: {},
  reveal: () => set({ revealed: true, revealedCards: {} }),
  // A fresh object each time, so the idle timer (which watches this identity)
  // restarts on every reveal — even a repeat reveal of the same value.
  revealCard: (id) =>
    set((s) => ({ revealedCards: { ...s.revealedCards, [id]: true } })),
  maskAll: () => set({ revealed: false, revealedCards: {} }),
}));
