import type { AppConfig, GatewayId } from '@vibe-monitor/shared';
import { GATEWAY_PRESETS } from '@vibe-monitor/shared';
import { buildLiteLLMAdapter } from './adapters/litellm';
import { buildMininglampAdapter } from './adapters/mininglamp';
import type { SourceAdapter } from './adapters/types';
import { loadConfig } from './config';

type DefaultAdapterDeps = {
  config?: AppConfig;
};

export function buildDefaultAdapters(
  runtimeDir: string,
  deps: DefaultAdapterDeps = {}
): SourceAdapter[] {
  const config = deps.config ?? loadConfig(runtimeDir);

  return config.gateways.flatMap((gateway) =>
    gateway.accounts.flatMap((account) => {
      if (!account.enabled || !account.apiKey) {
        return [];
      }

      const credentials = {
        baseUrl: GATEWAY_PRESETS[gateway.gatewayId].baseUrl,
        apiKey: account.apiKey
      };
      const sourceId = `${gateway.gatewayId}:${account.accountId}`;

      return [wrapAdapter(buildAdapter(gateway.gatewayId, credentials), sourceId, account.label)];
    })
  );
}

function buildAdapter(
  gatewayId: GatewayId,
  credentials: { baseUrl: string; apiKey: string }
) {
  return gatewayId === 'llm-gateway'
    ? buildMininglampAdapter(credentials)
    : buildLiteLLMAdapter(credentials);
}

function wrapAdapter(base: SourceAdapter, sourceId: string, accountLabel: string): SourceAdapter {
  return {
    ...base,
    sourceId,
    async refresh() {
      const result = await base.refresh();

      if (!result.ok) {
        return {
          ...result,
          sourceId
        };
      }

      return {
        ok: true,
        snapshot: {
          ...result.snapshot,
          sourceId,
          accountLabel
        }
      } as const;
    }
  };
}
