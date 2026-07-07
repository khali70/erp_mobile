import { useCallback, useEffect, useState } from 'react';
import { tagRepository } from '@/repositories/tag-repository.client';

/** Loads the tag registry (names) for autocomplete/suggestions. */
export function useTags() {
  const [tags, setTags] = useState<string[]>([]);

  const reload = useCallback(() => {
    setTags(tagRepository.list().map((row) => row.name));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { tags, reload };
}
