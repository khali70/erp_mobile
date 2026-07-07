import { useCallback, useEffect, useMemo, useState } from 'react';
import { categoryRepository } from '@/repositories/category-repository.client';
import type { Category } from '@/db/schema';

/**
 * Loads the category registry (source of truth = SQLite). Returns the ordered
 * list, a name→record index for O(1) label/color lookup, a `create` for inline
 * "add category", and a `reload`.
 */
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  const reload = useCallback(() => {
    setCategories(categoryRepository.list());
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const byName = useMemo(
    () => new Map(categories.map((c) => [c.name, c])),
    [categories],
  );

  const create = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return null;
      const created = categoryRepository.create({ name: trimmed, sortOrder: 999 });
      reload();
      return created;
    },
    [reload],
  );

  return { categories, byName, create, reload };
}
