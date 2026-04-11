import { buildMininglampAdapter } from './adapters/mininglamp';
import type { SourceAdapter } from './adapters/types';

type DefaultAdapterDeps = {
  env?: Record<string, string | undefined>;
};

export function buildDefaultAdapters(
  _runtimeDir: string,
  deps: DefaultAdapterDeps = {}
): SourceAdapter[] {
  const env = deps.env ?? process.env;
  const adapters: SourceAdapter[] = [];

  const mininglampBase = env.MININGLAMP_BASE_URL?.trim();
  const mininglampKey = env.MININGLAMP_API_KEY?.trim();

  if (mininglampBase && mininglampKey) {
    adapters.push(
      buildMininglampAdapter({
        baseUrl: mininglampBase,
        apiKey: mininglampKey
      })
    );
  }

  return adapters;
}
