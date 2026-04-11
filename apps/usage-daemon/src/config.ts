import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfigSchema, type AppConfig } from '@vibe-monitor/shared';

export function loadConfig(runtimeDir: string): AppConfig {
  const configPath = join(runtimeDir, 'config.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`warning: invalid JSON in ${configPath}: ${e instanceof Error ? e.message : e}`);
    return {};
  }

  const result = appConfigSchema.safeParse(parsed);
  if (!result.success) {
    console.warn(`warning: config validation failed in ${configPath}: ${result.error.message}`);
    return {};
  }

  return result.data;
}
