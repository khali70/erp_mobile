import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { documentRepository } from '@/repositories/document-repository.client';
import { itemRepository } from '@/repositories/item-repository.client';
import { presentDocumentDetail, type DocumentDetailViewModel } from '../document-presenters';

/**
 * Loads one document with its lines from the repository and resolves item names
 * for display. Returns the presented detail/report view model (null while
 * loading or if the doc is missing) plus `reload`.
 */
export function useDocumentDetail(documentId: string) {
  const { t, i18n } = useTranslation();
  const [detail, setDetail] = useState<DocumentDetailViewModel | null>(null);

  const reload = useCallback(() => {
    const doc = documentRepository.getWithLines(documentId);
    if (!doc) {
      setDetail(null);
      return;
    }
    const lines = doc.lines.map((l) => ({
      id: l.id,
      itemId: l.itemId,
      qty: l.qty,
      unitPrice: l.unitPrice,
      title: l.title,
      note: l.note,
      itemName: itemRepository.getById(l.itemId)?.name ?? null,
    }));
    setDetail(
      presentDocumentDetail(
        { ...doc, partyName: doc.partyName, attachments: doc.attachments, lines },
        t,
        i18n.language,
      ),
    );
  }, [documentId, t, i18n.language]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { detail, reload };
}
