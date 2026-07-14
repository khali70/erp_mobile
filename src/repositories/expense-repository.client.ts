import { db } from '@/db/client';
import { createExpenseRepository, type ExpenseDb } from './expense-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const expenseRepository = createExpenseRepository(db as unknown as ExpenseDb);
