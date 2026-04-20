import { describe, expect, it } from 'vitest';
import { buildDefaultAdapters } from '../src/defaultAdapters';

describe('buildDefaultAdapters', () => {
  it('registers every enabled account across both gateways', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        statusBar: { pinnedAccountId: 'llm-gateway:prod' },
        gateways: [
          {
            gatewayId: 'llm-gateway',
            accounts: [
              { accountId: 'prod', label: 'Prod', apiKey: 'sk-test', enabled: true }
            ]
          },
          {
            gatewayId: 'vibe',
            accounts: [
              { accountId: 'main', label: 'Main', apiKey: 'sk-vibe', enabled: true }
            ]
          }
        ]
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual([
      'llm-gateway:prod',
      'vibe:main'
    ]);
  });

  it('skips disabled accounts', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        statusBar: { pinnedAccountId: null },
        gateways: [
          {
            gatewayId: 'llm-gateway',
            accounts: [
              { accountId: 'prod', label: 'Prod', apiKey: 'sk-test', enabled: false }
            ]
          },
          {
            gatewayId: 'vibe',
            accounts: [
              { accountId: 'main', label: 'Main', apiKey: 'sk-vibe', enabled: true }
            ]
          }
        ]
      }
    });

    expect(adapters.map((a) => a.sourceId)).toEqual(['vibe:main']);
  });

  it('returns empty when no enabled account has an api key', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      config: {
        statusBar: { pinnedAccountId: null },
        gateways: [
          { gatewayId: 'llm-gateway', accounts: [] },
          { gatewayId: 'vibe', accounts: [] }
        ]
      }
    });

    expect(adapters).toEqual([]);
  });
});
