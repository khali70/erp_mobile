import { db } from '@/db/client';
import { createDebtRepository, type DebtDb } from './debt-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const debtRepository = createDebtRepository(db as unknown as DebtDb);
