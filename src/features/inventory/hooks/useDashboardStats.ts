import { useCallback, useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import {
  computeDashboardStats,
  getCachedStats,
  setCachedStats,
  type DashboardStats,
} from '../dashboard-stats';

/**
 * Serves the cached dashboard stats immediately and recomputes the heavy
 * aggregation in the background (deferred past interactions so it never janks
 * the UI). `reload` forces a recompute for the header's manual refresh button.
 */
export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(getCachedStats());
  const [computing, setComputing] = useState(false);

  const reload = useCallback(() => {
    setComputing(true);
    const task = InteractionManager.runAfterInteractions(() => {
      const next = computeDashboardStats();
      setCachedStats(next);
      setStats(next);
      setComputing(false);
    });
    return () => task.cancel();
  }, []);

  // First mount with an empty cache → compute once in the background.
  useEffect(() => {
    if (getCachedStats()) return;
    return reload();
  }, [reload]);

  return { stats, computing, reload };
}
