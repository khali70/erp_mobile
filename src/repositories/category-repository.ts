import { asc, eq, isNull } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Category } from '@/db/schema';
import type { DocDb } from './document-repository';

export interface CreateCategoryInput {
  name: string;
  color?: string | null;
  icon?: string | null;
  i18nKey?: string | null;
  sortOrder?: number;
}

/**
 * User-extensible category registry. `name` is the key stored on items.category.
 * Creating an existing name is a no-op that returns the current row, so inline
 * "add category" from the UI is idempotent.
 */
export function createCategoryRepository(database: DocDb) {
  function getByName(name: string): Category | null {
    return (
      database.select().from(schema.categories).where(eq(schema.categories.name, name)).get() ??
      null
    );
  }

  return {
    getByName,

    list(): Category[] {
      return database
        .select()
        .from(schema.categories)
        .where(isNull(schema.categories.deletedAt))
        .orderBy(asc(schema.categories.sortOrder), asc(schema.categories.name))
        .all();
    },

    /** Insert-or-return: a duplicate name yields the existing category. */
    create(input: CreateCategoryInput): Category {
      const existing = getByName(input.name);
      if (existing) return existing;
      const ts = now();
      const row = {
        id: newId(),
        createdAt: ts,
        updatedAt: ts,
        deletedAt: null,
        name: input.name,
        color: input.color ?? null,
        icon: input.icon ?? null,
        i18nKey: input.i18nKey ?? null,
        sortOrder: input.sortOrder ?? 0,
      };
      database.insert(schema.categories).values(row).run();
      return row as Category;
    },

    count(): number {
      return database
        .select({ id: schema.categories.id })
        .from(schema.categories)
        .where(isNull(schema.categories.deletedAt))
        .all().length;
    },
  };
}

export type CategoryRepository = ReturnType<typeof createCategoryRepository>;
