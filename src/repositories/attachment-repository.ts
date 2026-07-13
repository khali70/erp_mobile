import { attachmentsDb } from '@/db/attachments-client';
import { newId, now } from '@/utils/id';
import type { AttachmentMeta } from './document-repository';

interface InsertAttachmentInput {
  documentId: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

interface AttachmentRow {
  id: string;
  document_id: string;
  name: string;
  mime: string;
  size: number;
  created_at: number;
}

// Owns the separate attachments.db (BLOB bytes). The rest of the app only ever
// sees AttachmentMeta (no bytes) until a file is explicitly opened.
export const attachmentRepository = {
  /** Store bytes; returns the metadata to embed on the document. */
  insert(input: InsertAttachmentInput): AttachmentMeta {
    const id = newId();
    const size = input.bytes.byteLength;
    attachmentsDb.runSync(
      'INSERT INTO attachments (id, document_id, name, mime, size, created_at, bytes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      input.documentId,
      input.name,
      input.mime,
      size,
      now(),
      input.bytes,
    );
    return { id, name: input.name, mime: input.mime, size };
  },

  /** Load one attachment's bytes (only when the owner opens it). */
  getBytes(id: string): Uint8Array | null {
    const row = attachmentsDb.getFirstSync<{ bytes: Uint8Array }>(
      'SELECT bytes FROM attachments WHERE id = ?',
      id,
    );
    return row?.bytes ?? null;
  },

  /** Metadata (no bytes) for every attachment on a document. */
  listMeta(documentId: string): AttachmentMeta[] {
    const rows = attachmentsDb.getAllSync<AttachmentRow>(
      'SELECT id, document_id, name, mime, size, created_at FROM attachments WHERE document_id = ? ORDER BY created_at ASC',
      documentId,
    );
    return rows.map((r) => ({ id: r.id, name: r.name, mime: r.mime, size: r.size }));
  },

  remove(id: string): void {
    attachmentsDb.runSync('DELETE FROM attachments WHERE id = ?', id);
  },

  /**
   * Stamp the owning document id onto attachments. Bytes are inserted during
   * entry (before the doc exists) with an empty document_id; this backfills the
   * real id after the document is posted, so backup/cleanup can group by doc.
   */
  assignDocument(ids: string[], documentId: string): void {
    for (const id of ids) {
      attachmentsDb.runSync('UPDATE attachments SET document_id = ? WHERE id = ?', documentId, id);
    }
  },
};
