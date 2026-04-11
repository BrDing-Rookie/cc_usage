import type { AppConfig } from '@vibe-monitor/shared';
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
  const adapters: SourceAdapter[] = [];

  if (config.mininglamp?.baseUrl && config.mininglamp?.apiKey) {
    adapters.push(
      buildMininglampAdapter({
        baseUrl: config.mininglamp.baseUrl,
        apiKey: config.mininglamp.apiKey
      })
    );
  }

  return adapters;
}
