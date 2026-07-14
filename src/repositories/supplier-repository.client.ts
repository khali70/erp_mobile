import { db } from '@/db/client';
import { createSupplierRepository, type SupplierDb } from './supplier-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const supplierRepository = createSupplierRepository(db as unknown as SupplierDb);
