import { invoke } from '@tauri-apps/api/core';
import type { MaterializedState } from '@vibe-monitor/shared';

export async function loadMaterializedState(): Promise<MaterializedState> {
  return invoke<MaterializedState>('read_materialized_state');
}

export async function readAppConfig(): Promise<Record<string, string>> {
  return invoke<Record<string, string>>('read_app_config');
}

export async function writeAppConfig(config: Record<string, string>): Promise<void> {
  return invoke('write_app_config', { config });
}

export async function restartDaemon(): Promise<void> {
  return invoke('restart_daemon');
}
