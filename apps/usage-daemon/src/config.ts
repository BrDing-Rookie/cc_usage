import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfigSchema, type AppConfig } from '@vibe-monitor/shared';

/** Rename map for legacy gateway identifiers */
const LEGACY_RENAMES: Record<string, string> = {
  mininglamp: 'llm-gateway',
  litellm: 'vibe',
};

/** Strip legacy baseUrl fields and rename old gateway IDs */
function migrateConfig(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  const migrated = { ...obj };

  // Rename legacy section names
  for (const [oldName, newName] of Object.entries(LEGACY_RENAMES)) {
    if (oldName in migrated && !(newName in migrated)) {
      migrated[newName] = migrated[oldName];
      delete migrated[oldName];
    }
  }

  // Rename legacy activeGateway value
  if (typeof migrated.activeGateway === 'string' && migrated.activeGateway in LEGACY_RENAMES) {
    migrated.activeGateway = LEGACY_RENAMES[migrated.activeGateway];
  }

  // Strip legacy baseUrl fields from gateway sections
  for (const key of ['llm-gateway', 'vibe'] as const) {
    const section = migrated[key];
    if (typeof section === 'object' && section !== null) {
      const { baseUrl, ...rest } = section as Record<string, unknown>;
      if (Object.keys(rest).length > 0) {
        migrated[key] = rest;
      } else {
        delete migrated[key];
      }
    }
  }

  return migrated;
}

export function loadConfig(runtimeDir: string): AppConfig {
  const configPath = join(runtimeDir, 'config.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return appConfigSchema.parse({});
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.warn(`warning: invalid JSON in ${configPath}: ${e instanceof Error ? e.message : e}`);
    return appConfigSchema.parse({});
  }

  const migrated = migrateConfig(parsed);
  const result = appConfigSchema.safeParse(migrated);
  if (!result.success) {
    console.warn(`warning: config validation failed in ${configPath}: ${result.error.message}`);
    return appConfigSchema.parse({});
  }

  return result.data;
}
