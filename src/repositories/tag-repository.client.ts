import { db } from '@/db/client';
import { createTagRepository } from './tag-repository';
import type { DocDb } from './document-repository';

export const tagRepository = createTagRepository(db as unknown as DocDb);
