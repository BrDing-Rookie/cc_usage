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
  it('returns empty object when config file does not exist', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    const config = loadConfig(dir);
    expect(config).toEqual({});
  });

  it('parses valid config with mininglamp credentials', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({
        mininglamp: {
          baseUrl: 'https://llm-gateway.mlamp.cn',
          apiKey: 'sk-test-key'
        }
      })
    );

    const config = loadConfig(dir);
    expect(config.mininglamp).toEqual({
      baseUrl: 'https://llm-gateway.mlamp.cn',
      apiKey: 'sk-test-key'
    });
  });

  it('returns empty object and warns on invalid JSON', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{ bad json');

    const config = loadConfig(dir);

    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('invalid JSON');
  });

  it('returns empty object and warns on schema validation failure', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(
      join(dir, 'config.json'),
      JSON.stringify({ mininglamp: { baseUrl: 'not-a-url' } })
    );

    const config = loadConfig(dir);

    expect(config).toEqual({});
    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain('config validation failed');
  });

  it('accepts empty object as valid config', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vibe-config-'));
    writeFileSync(join(dir, 'config.json'), '{}');

    const config = loadConfig(dir);
    expect(config).toEqual({});
  });
});
