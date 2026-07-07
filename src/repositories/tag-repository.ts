import { asc, eq, isNull } from 'drizzle-orm';
import * as schema from '@/db/schema';
import { newId, now } from '@/utils/id';
import type { Tag } from '@/db/schema';
import type { DocDb } from './document-repository';

/**
 * Tag registry — autocomplete + known-tag list only. Items store their own
 * denormalized `tags` array; this table exists so the suggestion list stays
 * consistent. `upsertMany` is called on every item save with that item's tags.
 */
export function createTagRepository(database: DocDb) {
  function getByName(name: string): Tag | null {
    return database.select().from(schema.tags).where(eq(schema.tags.name, name)).get() ?? null;
  }

  return {
    list(): Tag[] {
      return database
        .select()
        .from(schema.tags)
        .where(isNull(schema.tags.deletedAt))
        .orderBy(asc(schema.tags.name))
        .all();
    },

    /** Register any names not already present. Existing names are left as-is. */
    upsertMany(names: string[]): void {
      const ts = now();
      for (const raw of names) {
        const name = raw.trim();
        if (!name || getByName(name)) continue;
        database
          .insert(schema.tags)
          .values({ id: newId(), createdAt: ts, updatedAt: ts, deletedAt: null, name })
          .run();
      }
    },
  };
}

export type TagRepository = ReturnType<typeof createTagRepository>;
