# المستندات — Documents List Screen

> Part of **ERP Mobile**. Project overview + full screen map: [`docs/PROJECT.md`](../../../../docs/PROJECT.md). Step 3.

## Purpose
Chronological list of every in/out document (sales + purchases). The audit trail — tap any row to view detail, and reverse it with a correcting document.

## UX
- Filter chips: all / incoming (وارد) / outgoing (صادر).
- Rows: date, party, direction badge (in/out), total, paid/debt state.
- Tap → document detail (lines, totals, party, payment). Reverse = new opposite document (never a hard delete).

## Navigation
- **In**: Home tile «المستندات» (with count badge).
- **Out**: opens document detail; ＋ opens NewOutgoing/NewIncoming.

## Why needed
Trust + explainability. Every stock and money change traces to a document here. Fixes the target app's "no undo / unexplained numbers" complaint — you reverse, you don't erase.

## Guard-rails
Documents are immutable; corrections are new documents. Archive, never delete.
