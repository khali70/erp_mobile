import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useDocumentForm } from '../hooks/useDocumentForm';
import { StoreDateCard } from '../components/StoreDateCard';
import { PartyCard } from '../components/PartyCard';
import { RestoredDraftBanner } from '../components/RestoredDraftBanner';
import { DocLinesSection } from '../components/DocLinesSection';
import { DocSummaryCard } from '../components/DocSummaryCard';
import { SaveDocButton } from '../components/SaveDocButton';
import { DocFormModals } from '../components/DocFormModals';

/** وارد جديد · فاتورة مشتريات — new incoming document / purchase. Supplier party,
 *  unit costs, supplier debt note, and no barcode scan. Owns its own layout. */
export function NewIncomingScreen() {
  const { t } = useTranslation();
  const f = useDocumentForm('purchase');
  // Quick-add is always an add (even when prefilled); the sheet keys "edit" off
  // a non-null initial, which we prefill — so both titles use the add copy.
  const addTitle = t('suppliers.form.addTitle');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('documents.incoming.title')}
        onBack={f.goBack}
        backLabel={t('common.back')}
        action={{ icon: 'check', onPress: f.save, accessibilityLabel: t('documents.save') }}
      />

      <ScrollView contentContainerClassName="px-4 py-4 pb-10 gap-4" showsVerticalScrollIndicator={false}>
        <StoreDateCard ns={f.ns} docDate={f.docDate} />
        <PartyCard
          ns={f.ns}
          party={f.party}
          isWalkIn={f.isWalkIn}
          partyLabel={f.partyLabel}
          showDebt
          onOpen={() => f.setPickerOpen(true)}
          onQuickAdd={() => f.setPartyFormOpen(true)}
        />

        {f.wasRestored && f.lines.length > 0 && <RestoredDraftBanner onDiscard={f.discardDraft} />}

        <DocLinesSection
          ns={f.ns}
          mode="purchase"
          lines={f.lines}
          onMutateQty={f.mutateQty}
          onSetQty={f.setQty}
          onSetPrice={f.setPrice}
          onRemove={f.removeLine}
          onAddLine={() => f.setItemPickerOpen(true)}
          entryMode={f.entryMode}
          onSetEntryMode={f.setEntryMode}
          quick={f.quick}
          locks={f.locks}
          onQuickChange={f.setQuickField}
          onToggleLock={f.toggleLock}
          onAddQuick={f.addQuickLine}
          titleSuggestions={f.titleSuggestions}
        />

        <DocSummaryCard count={f.lines.length} total={f.total} />
        <SaveDocButton onPress={f.save} saving={f.saving} />
      </ScrollView>

      <DocFormModals f={f} mode="purchase" addTitle={addTitle} />
    </View>
  );
}
