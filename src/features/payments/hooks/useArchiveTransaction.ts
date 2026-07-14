import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { transactionRepository } from '@/repositories/transaction-repository.client';

/**
 * THE ERASER — the only way a mistyped movement of money can be taken back.
 *
 * The cash book is append-only, and it must be: money that moved cannot be made
 * not to have moved. But a 50,000 drawing typed where 5,000 was meant, or a سداد
 * recorded twice, is not money that moved — it is a typo, and until this hook
 * existed it corrupted the derived debt AND the drawer balance FOREVER. An owner
 * whose cash figure has silently stopped matching the notes in his drawer stops
 * trusting the app, and a ledger nobody trusts is worse than no ledger.
 *
 * It archives (soft-deletes), never DELETEs: the row keeps its `deleted_at` and
 * simply stops counting. Every figure in the app — `owed()`, `balances()`, the
 * ledger itself — filters on `deleted_at IS NULL`, so a single archive walks the
 * money back out of all of them at once, with nothing to keep in step by hand.
 *
 * It takes an ARRAY because a transfer is TWO rows and they die together
 * (`archiveMany` is atomic; see `legIdsOf`). Confirm first, always: this is
 * destructive, and the numbers are money.
 */
export function useArchiveTransaction(onArchived: () => void) {
  const { t } = useTranslation();

  const archive = useCallback(
    (ids: string[]) => {
      try {
        transactionRepository.archiveMany(ids);
        onArchived();
      } catch (err) {
        Alert.alert(t('payments.delete.errorTitle'), String((err as Error)?.message ?? err));
      }
    },
    [onArchived, t],
  );

  const confirmArchive = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      Alert.alert(t('payments.delete.title'), t('payments.delete.body'), [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('payments.delete.confirm'), style: 'destructive', onPress: () => archive(ids) },
      ]);
    },
    [archive, t],
  );

  return { confirmArchive };
}
