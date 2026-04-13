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
  const activeId: GatewayId = config.activeGateway;
  const gatewayConfig = config[activeId];

  if (!gatewayConfig?.apiKey) {
    return [];
  }

  const preset = GATEWAY_PRESETS[activeId];
  const credentials = { baseUrl: preset.baseUrl, apiKey: gatewayConfig.apiKey };

  switch (activeId) {
    case 'llm-gateway':
      return [buildMininglampAdapter(credentials)];
    case 'vibe':
      return [buildLiteLLMAdapter(credentials)];
    default:
      return [];
  }
}
