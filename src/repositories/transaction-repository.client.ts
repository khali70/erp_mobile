import { db } from '@/db/client';
import { createTransactionRepository, type TxDb } from './transaction-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const transactionRepository = createTransactionRepository(db as unknown as TxDb);
