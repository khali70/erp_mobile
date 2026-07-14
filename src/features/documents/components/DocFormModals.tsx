import { PartyFormSheet } from '@/features/parties/components/PartyFormSheet';
import type { DocMode } from '../types';
import type { useDocumentForm } from '../hooks/useDocumentForm';
import { LineItemPicker } from './LineItemPicker';
import { PartyPicker } from './PartyPicker';
import { CsvImportReviewSheet } from './CsvImportReviewSheet';

interface DocFormModalsProps {
  f: ReturnType<typeof useDocumentForm>;
  mode: DocMode;
  /** Party quick-add sheet title (customer vs supplier copy). */
  addTitle: string;
}

/**
 * The trailing modal cluster shared by both new-document screens: item picker,
 * party picker, and the quick-add party sheet. All state lives in the form hook.
 */
export function DocFormModals({ f, mode, addTitle }: DocFormModalsProps) {
  return (
    <>
      <LineItemPicker
        visible={f.itemPickerOpen}
        items={f.items}
        stock={f.stock}
        onClose={() => f.setItemPickerOpen(false)}
        onSelect={f.appendItem}
      />

      <PartyPicker
        visible={f.pickerOpen}
        mode={mode}
        parties={f.parties}
        onClose={() => f.setPickerOpen(false)}
        onSelect={f.selectParty}
        onQuickAdd={f.openQuickAdd}
      />

      <PartyFormSheet
        visible={f.partyFormOpen}
        initial={f.partyFormInitial}
        titleAdd={addTitle}
        titleEdit={addTitle}
        onClose={() => f.setPartyFormOpen(false)}
        onSave={f.saveQuickAdd}
      />

      <CsvImportReviewSheet
        visible={f.csvImportOpen}
        rows={f.importRows}
        onClose={() => f.setCsvImportOpen(false)}
        onConfirm={f.importLines}
      />
    </>
  );
}
