import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadConfig } from '../src/config';

const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  warnSpy.mockClear();
});

describe('loadConfig', () => {
  it('returns default config when config file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    const config = loadConfig(dir);
    expect(config).toEqual({
      statusBar: { pinnedAccountId: null },
      gateways: [
        { gatewayId: 'llm-gateway', accounts: [] },
        { gatewayId: 'vibe', accounts: [] }
      ]
    });
  });

  it('parses a valid multi-account config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        statusBar: { pinnedAccountId: 'llm-gateway:prod' },
        gateways: [
          {
            gatewayId: 'llm-gateway',
            accounts: [{ accountId: 'prod', label: 'Prod', apiKey: 'sk-test-key', enabled: true }]
          },
          {
            gatewayId: 'vibe',
            accounts: []
          }
        ]
      })
    );

    const config = loadConfig(dir);
    expect(config.statusBar.pinnedAccountId).toBe('llm-gateway:prod');
    expect(config.gateways[0].accounts[0]).toEqual({
      accountId: 'prod',
      label: 'Prod',
      apiKey: 'sk-test-key',
      enabled: true
    });
  });

  it('migrates legacy mininglamp config into a gateway account', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        activeGateway: 'mininglamp',
        mininglamp: { baseUrl: 'https://llm-gateway.mlamp.cn', apiKey: 'sk-legacy' }
      })
    );

    const config = loadConfig(dir);
    expect(config.statusBar.pinnedAccountId).toBe('llm-gateway:default');
    expect(config.gateways[0].accounts[0]).toEqual({
      accountId: 'default',
      label: 'Default',
      apiKey: 'sk-legacy',
      enabled: true
    });
  });

  it('migrates legacy litellm section into the vibe gateway', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        litellm: { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-vibe' }
      })
    );

    const config = loadConfig(dir);
    expect(config.statusBar.pinnedAccountId).toBe('vibe:default');
    expect(config.gateways[1].accounts[0]).toEqual({
      accountId: 'default',
      label: 'Default',
      apiKey: 'sk-vibe',
      enabled: true
    });
  });

  it('returns default config and warns on invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{ bad json');

    const config = loadConfig(dir);

    expect(config).toEqual({
      statusBar: { pinnedAccountId: null },
      gateways: [
        { gatewayId: 'llm-gateway', accounts: [] },
        { gatewayId: 'vibe', accounts: [] }
      ]
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('invalid JSON');
  });

  it('returns default config and warns on schema validation failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ statusBar: { pinnedAccountId: null }, gateways: 'bad-shape' })
    );

    const config = loadConfig(dir);

    expect(config).toEqual({
      statusBar: { pinnedAccountId: null },
      gateways: [
        { gatewayId: 'llm-gateway', accounts: [] },
        { gatewayId: 'vibe', accounts: [] }
      ]
    });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('config validation failed');
  });

  it('accepts empty object and defaults to empty fixed gateways', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{}');

    const config = loadConfig(dir);
    expect(config).toEqual({
      statusBar: { pinnedAccountId: null },
      gateways: [
        { gatewayId: 'llm-gateway', accounts: [] },
        { gatewayId: 'vibe', accounts: [] }
      ]
    });
  });
});
