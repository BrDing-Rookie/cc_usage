import { useEffect, useState } from 'react';
import type { MaterializedState } from '@vibe-monitor/shared';
import { loadMaterializedState } from '../api/client';

export function useSnapshots(initialState?: MaterializedState) {
  const [state, setState] = useState<MaterializedState | null>(initialState ?? null);

  useEffect(() => {
    if (initialState) {
      return;
    }

    void loadMaterializedState().then(setState);
    const id = window.setInterval(() => {
      void loadMaterializedState().then(setState);
    }, 5000);

    return () => window.clearInterval(id);
  }, [initialState]);

  return state;
}
