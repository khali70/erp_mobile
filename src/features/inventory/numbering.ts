// Per-type human document numbers: IN-000001 / OUT-000001, zero-padded 6,
// monotonic per kind. Pure — the repository supplies the last sequence.

export type DocKind = 'incoming' | 'outgoing';

const PREFIX: Record<DocKind, string> = { incoming: 'IN', outgoing: 'OUT' };
const PAD = 6;

/** Build the display number for a given kind + 1-based sequence. */
export function formatDocNumber(kind: DocKind, seq: number): string {
  return `${PREFIX[kind]}-${String(seq).padStart(PAD, '0')}`;
}

/** Next sequence after the last used one (null/undefined → first = 1). */
export function nextSequence(lastSeq: number | null | undefined): number {
  return (lastSeq ?? 0) + 1;
}

/** Extract the numeric sequence from a doc number, or null if malformed. */
export function parseSequence(docNo: string): number | null {
  const m = /-(\d+)$/.exec(docNo);
  return m ? parseInt(m[1], 10) : null;
}

/** Convenience: the next full doc number given the last one of the same kind. */
export function nextDocNumber(kind: DocKind, lastDocNo: string | null): string {
  const lastSeq = lastDocNo ? parseSequence(lastDocNo) : null;
  return formatDocNumber(kind, nextSequence(lastSeq));
}
