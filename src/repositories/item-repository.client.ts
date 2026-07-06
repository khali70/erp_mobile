import { db } from '@/db/client';
import { createItemRepository } from './item-repository';
import type { DocDb } from './document-repository';

// Production singleton bound to the app's expo-sqlite instance. App code imports
// this; tests build their own repo over an in-memory db via the factory.
export const itemRepository = createItemRepository(db as unknown as DocDb);
