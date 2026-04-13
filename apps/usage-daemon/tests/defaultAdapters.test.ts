import { describe, expect, it } from 'vitest';
import { buildDefaultAdapters } from '../src/defaultAdapters';

describe('buildDefaultAdapters', () => {
  it('registers llm-gateway when it is the active gateway', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        activeGateway: 'llm-gateway',
        'llm-gateway': { apiKey: 'sk-test' },
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['llm-gateway']);
  });

  it('registers vibe when it is the active gateway', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        activeGateway: 'vibe',
        vibe: { apiKey: 'sk-test' },
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['vibe']);
  });

  it('returns empty when active gateway has no api key', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: { activeGateway: 'llm-gateway' }
    });

    expect(adapters).toEqual([]);
  });

  it('only registers the active gateway even if both have keys', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        activeGateway: 'vibe',
        'llm-gateway': { apiKey: 'sk-1' },
        vibe: { apiKey: 'sk-2' },
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['vibe']);
  });
});
