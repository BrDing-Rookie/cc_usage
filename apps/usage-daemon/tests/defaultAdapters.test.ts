import { describe, expect, it } from 'vitest';
import { buildDefaultAdapters } from '../src/defaultAdapters';

describe('buildDefaultAdapters', () => {
  it('registers mininglamp when env is available', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      env: {
        MININGLAMP_BASE_URL: 'https://llm-gateway.mininglamp.com',
        MININGLAMP_API_KEY: 'sk-test'
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['mininglamp']);
  });

  it('returns empty when env is not configured', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', { env: {} });

    expect(adapters).toEqual([]);
  });
});
