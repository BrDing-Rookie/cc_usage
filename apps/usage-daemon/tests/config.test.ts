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
    expect(config).toEqual({ activeGateway: 'llm-gateway' });
  });

  it('parses valid config with llm-gateway api key', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        activeGateway: 'llm-gateway',
        'llm-gateway': { apiKey: 'sk-test-key' }
      })
    );

    const config = loadConfig(dir);
    expect(config.activeGateway).toBe('llm-gateway');
    expect(config['llm-gateway']).toEqual({ apiKey: 'sk-test-key' });
  });

  it('migrates legacy mininglamp config to llm-gateway', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        activeGateway: 'mininglamp',
        mininglamp: { baseUrl: 'https://llm-gateway.mlamp.cn', apiKey: 'sk-legacy' }
      })
    );

    const config = loadConfig(dir);
    expect(config.activeGateway).toBe('llm-gateway');
    expect(config['llm-gateway']).toEqual({ apiKey: 'sk-legacy' });
  });

  it('migrates legacy litellm config to vibe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        litellm: { baseUrl: 'https://vibe.deepminer.ai', apiKey: 'sk-vibe' }
      })
    );

    const config = loadConfig(dir);
    expect(config.activeGateway).toBe('vibe');
    expect(config.vibe).toEqual({ apiKey: 'sk-vibe' });
  });

  it('returns default config and warns on invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{ bad json');

    const config = loadConfig(dir);

    expect(config).toEqual({ activeGateway: 'llm-gateway' });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('invalid JSON');
  });

  it('returns default config and warns on schema validation failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ activeGateway: 'unknown_gateway' })
    );

    const config = loadConfig(dir);

    expect(config).toEqual({ activeGateway: 'llm-gateway' });
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('config validation failed');
  });

  it('accepts empty object and defaults activeGateway', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{}');

    const config = loadConfig(dir);
    expect(config).toEqual({ activeGateway: 'llm-gateway' });
  });
});
