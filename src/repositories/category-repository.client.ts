import { db } from '@/db/client';
import { createCategoryRepository } from './category-repository';
import type { DocDb } from './document-repository';

export const categoryRepository = createCategoryRepository(db as unknown as DocDb);
