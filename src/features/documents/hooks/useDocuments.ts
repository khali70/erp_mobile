import { useCallback, useEffect, useState } from 'react';
import { documentRepository } from '@/repositories/document-repository.client';

export type DocumentRow = ReturnType<typeof documentRepository.list>[number];

/**
 * Loads posted documents from the repository (source of truth = SQLite),
 * newest first. Returns the list plus `reload` to re-query after mutations.
 */
export function useDocuments() {
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  const reload = useCallback(() => {
    const rows = documentRepository.list({ status: 'posted' });
    // Newest first: fall back to createdAt when docDate is null.
    rows.sort((a, b) => (b.docDate ?? b.createdAt) - (a.docDate ?? a.createdAt));
    setDocuments(rows);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { documents, reload };
}
