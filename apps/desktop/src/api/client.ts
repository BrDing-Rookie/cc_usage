import { invoke } from '@tauri-apps/api/core';
import type { MaterializedState } from '@vibe-monitor/shared';

export async function loadMaterializedState(): Promise<MaterializedState> {
  return invoke<MaterializedState>('read_materialized_state');
}
