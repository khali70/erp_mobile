import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useConvertQueue } from '@/features/voice-notes/hooks/useConvertQueue';
import { VoiceQueueCard } from '@/features/voice-notes/components/VoiceQueueCard';
import { useDocumentForm } from '../hooks/useDocumentForm';
import { EditDocLineSheet } from '../components/EditDocLineSheet';
import { StoreDateCard } from '../components/StoreDateCard';
import { PartyCard } from '../components/PartyCard';
import { RestoredDraftBanner } from '../components/RestoredDraftBanner';
import { DocLinesSection } from '../components/DocLinesSection';
import { DocSummaryCard } from '../components/DocSummaryCard';
import { SalePaymentCard } from '../components/SalePaymentCard';
import { SaveDocButton } from '../components/SaveDocButton';
import { ScanPane } from '../components/ScanPane';
import { DocFormModals } from '../components/DocFormModals';

/** صادر جديد · بيع — new outgoing document / sale. Customer party, sale prices
 *  and barcode scanning. Owns its layout; shared behaviour lives in the hook. */
export function NewOutgoingScreen() {
  const { t } = useTranslation();
  // Carried in when this sale is being created FROM a captured voice note; a
  // successful save marks that note processed (see useDocumentForm).
  const route = useRoute<RouteProp<RootStackParamList, 'NewOutgoing'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // The pending voice-note queue this sale is being entered from. The active note
  // is the nav param (or the head of what remains), and it is what useDocumentForm
  // marks processed on save — so the RIGHT note closes out.
  const queue = useConvertQueue(route.params?.voiceNoteId);
  const f = useDocumentForm('sale', queue.activeId ?? route.params?.voiceNoteId);
  // Quick-add is always an add (even when prefilled), so both titles are the
  // add copy — the sheet keys "edit" off a non-null initial, which we prefill.
  const addTitle = t('customers.form.addTitle');
  // Which line the Edit-Line sheet targets; null = closed. The sheet re-seeds
  // from the live line so a save-then-reopen always shows the fresh values.
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const editLine = f.lines.find((l) => l.id === editLineId) ?? null;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('documents.outgoing.title')}
        onBack={f.goBack}
        backLabel={t('common.back')}
        action={{ icon: 'check', onPress: f.save, accessibilityLabel: t('documents.save') }}
      />

      {queue.hasQueue && queue.active && (
        <VoiceQueueCard
          note={queue.active}
          index={queue.index}
          total={queue.total}
          onNext={
            queue.nextId
              ? () => navigation.setParams({ voiceNoteId: queue.nextId ?? undefined })
              : undefined
          }
        />
      )}

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
          stock={f.stock}
          onMutateQty={f.mutateQty}
          onSetQty={f.setQty}
          onSetPrice={f.setPrice}
          onRemove={f.removeLine}
          onSwapItem={f.requestSwapItem}
          onEditRequest={setEditLineId}
          onAddLine={() => f.setItemPickerOpen(true)}
          scanning={f.scanning}
          onToggleScan={() => f.setScanning((v) => !v)}
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

        <SalePaymentCard
          account={f.account}
          onChangeAccount={f.setAccount}
          touchesInstapay={f.saleTouchesInstapay}
          proof={f.paymentAttachments}
          onAddProof={f.addPaymentProof}
          onRemoveProof={f.removePaymentProof}
        />
        <SaveDocButton onPress={f.save} saving={f.saving} />
      </ScrollView>

      <DocFormModals f={f} mode="sale" addTitle={addTitle} />

      <EditDocLineSheet
        visible={editLine !== null}
        line={editLine}
        mode="sale"
        maxQty={editLine ? f.stock.maxQtyById[editLine.id] ?? null : null}
        onClose={() => setEditLineId(null)}
        onSave={(patch) => editLine && f.updateLine(editLine.id, patch)}
      />
    </View>
  );
}
