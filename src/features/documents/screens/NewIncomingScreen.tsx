import { useState } from 'react';
import { View, ScrollView, Text, TextInput } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import colors from '@/theme/colors';
import type { RootStackParamList } from '@/navigation/RootNavigator';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { useConvertQueue } from '@/features/voice-notes/hooks/useConvertQueue';
import { VoiceQueueCard } from '@/features/voice-notes/components/VoiceQueueCard';
import { useDocumentForm } from '../hooks/useDocumentForm';
import { StoreDateCard } from '../components/StoreDateCard';
import { PartyCard } from '../components/PartyCard';
import { RestoredDraftBanner } from '../components/RestoredDraftBanner';
import { DocLinesSection } from '../components/DocLinesSection';
import { DocSummaryCard } from '../components/DocSummaryCard';
import { PaymentCard } from '../components/PaymentCard';
import { AttachmentsCard } from '../components/AttachmentsCard';
import { SaveDocButton } from '../components/SaveDocButton';
import { DocFormModals } from '../components/DocFormModals';
import { EditDocLineSheet } from '../components/EditDocLineSheet';

/** وارد جديد · فاتورة مشتريات — new incoming document / purchase. Supplier party,
 *  unit costs, supplier debt note, and no barcode scan. Owns its own layout. */
export function NewIncomingScreen() {
  const { t } = useTranslation();
  // Carried in when this purchase is being created FROM a captured voice note;
  // a successful save marks that note processed (see useDocumentForm).
  const route = useRoute<RouteProp<RootStackParamList, 'NewIncoming'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  // The pending voice-note queue this purchase is being entered from. The active
  // note is the nav param (or the head of what remains), and it is what
  // useDocumentForm marks processed on save — so the RIGHT note closes out.
  const queue = useConvertQueue(route.params?.voiceNoteId);
  const f = useDocumentForm('purchase', queue.activeId ?? route.params?.voiceNoteId);
  // Quick-add is always an add (even when prefilled); the sheet keys "edit" off
  // a non-null initial, which we prefill — so both titles use the add copy.
  const addTitle = t('suppliers.form.addTitle');
  // Which line the Edit-Line sheet targets; null = closed. Purchase lines carry
  // no stock ceiling, so no maxQty is passed.
  const [editLineId, setEditLineId] = useState<string | null>(null);
  const editLine = f.lines.find((l) => l.id === editLineId) ?? null;

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={t('documents.incoming.title')}
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
          onSwapItem={f.requestSwapItem}
          onEditRequest={setEditLineId}
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

        <View className="bg-surface rounded-2xl p-4 border border-border gap-2">
          <Text className="text-xs font-bold text-muted text-right">{t('documents.note')}</Text>
          <TextInput
            value={f.note}
            onChangeText={f.setNote}
            placeholder={t('documents.notePlaceholder')}
            placeholderTextColor={colors.muted}
            multiline
            className="text-ink text-sm text-right bg-background rounded-xl px-3 py-2.5 min-h-[64px]"
            style={{ textAlignVertical: 'top' }}
          />
        </View>

        <AttachmentsCard
          attachments={f.attachments}
          onAddPhoto={f.addPhoto}
          onAddFile={f.addFile}
          onRemove={f.removeAttachment}
        />

        <DocSummaryCard count={f.lines.length} total={f.total} />
        <PaymentCard
          paidValue={f.paidValue}
          onChangePaid={f.setPaid}
          account={f.account}
          onChangeAccount={f.setAccount}
          proof={f.paymentAttachments}
          onAddProof={f.addPaymentProof}
          onRemoveProof={f.removePaymentProof}
          remaining={f.remaining}
        />
        <SaveDocButton onPress={f.save} saving={f.saving} />
      </ScrollView>

      <DocFormModals f={f} mode="purchase" addTitle={addTitle} />

      <EditDocLineSheet
        visible={editLine !== null}
        line={editLine}
        mode="purchase"
        onClose={() => setEditLineId(null)}
        onSave={(patch) => editLine && f.updateLine(editLine.id, patch)}
      />
    </View>
  );
}
