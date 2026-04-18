import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { appConfigSchema, type AppConfig, type GatewayId } from '@vibe-monitor/shared';

const LEGACY_RENAMES: Record<string, GatewayId> = {
  mininglamp: 'llm-gateway',
  litellm: 'vibe'
};

function createDefaultConfig(): AppConfig {
  return {
    statusBar: { pinnedAccountId: null },
    gateways: [
      { gatewayId: 'llm-gateway', accounts: [] },
      { gatewayId: 'vibe', accounts: [] }
    ]
  };
}

function normalizeAccounts(raw: unknown) {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.flatMap((account) => {
    if (!account || typeof account !== 'object') {
      return [];
    }

    const value = account as Record<string, unknown>;
    const accountId =
      typeof value.accountId === 'string' && value.accountId.trim()
        ? value.accountId.trim()
        : null;
    const label =
      typeof value.label === 'string' && value.label.trim() ? value.label.trim() : null;
    const apiKey =
      typeof value.apiKey === 'string' && value.apiKey.trim() ? value.apiKey.trim() : null;

    if (!accountId || !label || !apiKey) {
      return [];
    }

    return [
      {
        accountId,
        label,
        apiKey,
        enabled: value.enabled !== false
      }
    ];
  });
}

function normalizeConfig(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') {
    return createDefaultConfig();
  }

  const value = raw as Record<string, unknown>;

  if ('gateways' in value && !Array.isArray(value.gateways)) {
    return raw;
  }

  if (Array.isArray(value.gateways)) {
    const normalized = createDefaultConfig();

    normalized.gateways = normalized.gateways.map((gateway) => {
      const existing = value.gateways?.find?.(
        (candidate: unknown) =>
          candidate &&
          typeof candidate === 'object' &&
          (candidate as Record<string, unknown>).gatewayId === gateway.gatewayId
      ) as Record<string, unknown> | undefined;

      return {
        gatewayId: gateway.gatewayId,
        accounts: normalizeAccounts(existing?.accounts)
      };
    });

    const pinned =
      typeof (value.statusBar as Record<string, unknown> | undefined)?.pinnedAccountId ===
      'string'
        ? ((value.statusBar as Record<string, unknown>).pinnedAccountId as string)
        : null;

    normalized.statusBar.pinnedAccountId = pinned;
    return normalized;
  }

  const activeGatewayRaw =
    typeof value.activeGateway === 'string' ? value.activeGateway : null;
  const activeGateway = activeGatewayRaw
    ? LEGACY_RENAMES[activeGatewayRaw] ?? (activeGatewayRaw as GatewayId)
    : null;

  const normalized = createDefaultConfig();
  normalized.gateways = normalized.gateways.map((gateway) => {
    const legacySectionKey =
      gateway.gatewayId === 'llm-gateway' ? ['llm-gateway', 'mininglamp'] : ['vibe', 'litellm'];

    const section = legacySectionKey
      .map((key) => value[key])
      .find((candidate) => candidate && typeof candidate === 'object') as
      | Record<string, unknown>
      | undefined;

    const apiKey =
      typeof section?.apiKey === 'string' && section.apiKey.trim()
        ? section.apiKey.trim()
        : null;

    return {
      gatewayId: gateway.gatewayId,
      accounts: apiKey
        ? [
            {
              accountId: 'default',
              label: 'Default',
              apiKey,
              enabled: true
            }
          ]
        : []
    };
  });

  normalized.statusBar.pinnedAccountId =
    activeGateway && normalized.gateways.some((gateway) => gateway.gatewayId === activeGateway && gateway.accounts.length > 0)
      ? `${activeGateway}:default`
      : normalized.gateways.find((gateway) => gateway.accounts.length > 0)
          ? `${normalized.gateways.find((gateway) => gateway.accounts.length > 0)!.gatewayId}:default`
          : null;

  return normalized;
}

export function loadConfig(runtimeDir: string): AppConfig {
  const configPath = join(runtimeDir, 'config.json');

  let raw: string;
  try {
    raw = readFileSync(configPath, 'utf8');
  } catch {
    return appConfigSchema.parse(createDefaultConfig());
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.warn(
      `warning: invalid JSON in ${configPath}: ${
        error instanceof Error ? error.message : error
      }`
    );
    return appConfigSchema.parse(createDefaultConfig());
  }

  const migrated = normalizeConfig(parsed);
  const result = appConfigSchema.safeParse(migrated);
  if (!result.success) {
    console.warn(`warning: config validation failed in ${configPath}: ${result.error.message}`);
    return appConfigSchema.parse(createDefaultConfig());
  }

  return result.data;
}
