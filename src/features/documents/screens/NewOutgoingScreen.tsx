import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PartyFormSheet } from '@/features/parties/components/PartyFormSheet';
import { useDocumentForm } from '../hooks/useDocumentForm';
import { StoreDateCard } from '../components/StoreDateCard';
import { PartyCard } from '../components/PartyCard';
import { RestoredDraftBanner } from '../components/RestoredDraftBanner';
import { DocLinesSection } from '../components/DocLinesSection';
import { DocSummaryCard } from '../components/DocSummaryCard';
import { SaveDocButton } from '../components/SaveDocButton';
import { ScanPane } from '../components/ScanPane';
import { LineItemPicker } from '../components/LineItemPicker';
import { PartyPicker } from '../components/PartyPicker';

/** صادر جديد · بيع — new outgoing document / sale. Customer party, sale prices
 *  and barcode scanning. Owns its layout; shared behaviour lives in the hook. */
export function NewOutgoingScreen() {
  const { t } = useTranslation();
  const f = useDocumentForm('sale');
  // Quick-add is always an add (even when prefilled), so both titles are the
  // add copy — the sheet keys "edit" off a non-null initial, which we prefill.
  const addTitle = t('customers.form.addTitle');

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('documents.outgoing.title')}
        onBack={f.goBack}
        backLabel={t('common.back')}
        action={{ icon: 'check', onPress: f.save, accessibilityLabel: t('documents.save') }}
      />

      <ScrollView contentContainerClassName="px-4 py-4 pb-10 gap-4" showsVerticalScrollIndicator={false}>
        {/* Toggling the scanner swaps the store/date + party block for a live
            camera in place — the camera only mounts while scanning, so there is
            no idle battery or permission cost. */}
        {f.scanning ? (
          <ScanPane
            items={f.items}
            onScanItem={f.scanAppend}
            onClose={() => f.setScanning(false)}
            onManualAdd={() => {
              f.setScanning(false);
              f.setItemPickerOpen(true);
            }}
          />
        ) : (
          <>
            <StoreDateCard ns={f.ns} docDate={f.docDate} />
            <PartyCard
              ns={f.ns}
              party={f.party}
              isWalkIn={f.isWalkIn}
              partyLabel={f.partyLabel}
              onOpen={() => f.setPickerOpen(true)}
              onQuickAdd={() => f.setPartyFormOpen(true)}
            />
          </>
        )}

        {f.wasRestored && f.lines.length > 0 && <RestoredDraftBanner onDiscard={f.discardDraft} />}

        <DocLinesSection
          ns={f.ns}
          mode="sale"
          lines={f.lines}
          onMutateQty={f.mutateQty}
          onSetQty={f.setQty}
          onSetPrice={f.setPrice}
          onRemove={f.removeLine}
          onAddLine={() => f.setItemPickerOpen(true)}
          scanning={f.scanning}
          onToggleScan={() => f.setScanning((v) => !v)}
        />

        <DocSummaryCard count={f.lines.length} total={f.total} />
        <SaveDocButton onPress={f.save} saving={f.saving} />
      </ScrollView>

      <LineItemPicker
        visible={f.itemPickerOpen}
        items={f.items}
        onClose={() => f.setItemPickerOpen(false)}
        onSelect={f.appendItem}
      />

      <PartyPicker
        visible={f.pickerOpen}
        mode="sale"
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
    </View>
  );
}
