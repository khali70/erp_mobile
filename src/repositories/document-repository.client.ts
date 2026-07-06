import { db } from '@/db/client';
import { createDocumentRepository, type DocDb } from './document-repository';

// Production singleton bound to the app's expo-sqlite instance. Screens/hooks
// import this; tests build their own repo over an in-memory db via the factory.
export const documentRepository = createDocumentRepository(db as unknown as DocDb);
