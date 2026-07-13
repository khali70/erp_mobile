/**
 * Privacy mode — pure rules for masking money aggregates.
 *
 * This is a shoulder-surfing defence, NOT security: it hides money aggregates
 * from a glance while the shopkeeper serves a customer. It never touches the
 * data layer — the real numbers stay in memory, only rendering changes.
 */

/** Re-mask after this long without a reveal action while something is revealed. */
export const IDLE_MASK_MS = 30_000;

/** Dot count in the mask run (width comes from the hidden value, not from this). */
export const MASK_DOT_COUNT = 6;

/** Transient reveal state, as held by the (non-persisted) ui-store. */
export interface RevealState {
  /** Whole-app reveal, driven by the header eye toggle. */
  revealed: boolean;
  /** Per-value reveals, keyed by the MaskedValue `id`. */
  revealedCards: Record<string, boolean>;
}

/** True when a given value must render as dots instead of its number. */
export function isValueMasked(
  privacyMode: boolean,
  state: RevealState,
  id: string,
): boolean {
  if (!privacyMode) return false;
  if (state.revealed) return false;
  return !state.revealedCards[id];
}

/** True when anything at all is currently revealed (drives the idle timer). */
export function isAnythingRevealed(state: RevealState): boolean {
  if (state.revealed) return true;
  return Object.values(state.revealedCards).some(Boolean);
}

/** The mask run itself, e.g. `••••••`. */
export function maskRun(count: number = MASK_DOT_COUNT): string {
  return '•'.repeat(count);
}
