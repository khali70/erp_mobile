import { db } from '@/db/client';
import { createCustomerRepository, type CustomerDb } from './customer-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const customerRepository = createCustomerRepository(db as unknown as CustomerDb);
