import { useCallback, useState } from 'react';

/**
 * Tiny hook that simulates a refresh. Data is local, so the 600 ms delay
 * just gives the RefreshControl a moment to breathe — the affordance is
 * the value here, not the network.
 */
export function usePullRefresh(delayMs = 600) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, delayMs));
    setRefreshing(false);
  }, [delayMs]);
  return { refreshing, onRefresh };
}
