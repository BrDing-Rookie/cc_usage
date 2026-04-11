import { describe, expect, it } from 'vitest';
import { buildDefaultAdapters } from '../src/defaultAdapters';

describe('buildDefaultAdapters', () => {
  it('registers mininglamp when config has credentials', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        mininglamp: {
          baseUrl: 'https://llm-gateway.mininglamp.com',
          apiKey: 'sk-test'
        }
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['mininglamp']);
  });

  it('returns empty when config has no credentials', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', { config: {} });

    expect(adapters).toEqual([]);
  });
});
