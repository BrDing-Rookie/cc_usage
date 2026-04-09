import { describe, expect, it } from 'vitest';
import { buildDefaultAdapters } from '../src/defaultAdapters';

describe('buildDefaultAdapters', () => {
  it('registers claude official, codex official, and micc api when local state and env are available', async () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      env: {
        OPENAI_API_BASE: 'https://llm-gateway.mininglamp.com/v1',
        OPENAI_API_KEY: 'sk-test'
      },
      now: () => new Date('2026-04-10T10:00:00.000Z'),
      readClaudeCredentials: () => ({
        accessToken: 'sk-ant-test',
        subscriptionType: 'max'
      }),
      readCodexState: () => ({
        planName: 'Plus',
        accountLabel: 'Personal'
      }),
      fetchClaudeUsage: async () => ({
        five_hour: {
          utilization: 68,
          resets_at: '2026-04-10T12:00:00.000Z'
        },
        seven_day: {
          utilization: 22,
          resets_at: '2026-04-16T00:00:00.000Z'
        }
      })
    });

    expect(adapters.map((adapter) => adapter.sourceId)).toEqual([
      'claude-code-official',
      'codex-official',
      'micc-api'
    ]);

    const claudeResult = await adapters[0].refresh();
    const codexResult = await adapters[1].refresh();
    const miccResult = await adapters[2].refresh();

    expect(claudeResult.ok && claudeResult.snapshot.planName).toBe('max');
    expect(codexResult.ok && codexResult.snapshot.accountLabel).toBe('Personal');
    expect(miccResult.ok && miccResult.snapshot.sourceId).toBe('micc-api');
  });

  it('omits sources that do not have local state or env configuration', () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      env: {},
      readClaudeCredentials: () => null,
      readCodexState: () => null,
      fetchClaudeUsage: async () => ({})
    });

    expect(adapters).toEqual([]);
  });

  it('keeps claude official visible even when the usage fetch fails', async () => {
    const adapters = buildDefaultAdapters('/tmp/vibe', {
      env: {},
      readClaudeCredentials: () => ({
        accessToken: 'sk-ant-test',
        subscriptionType: 'max'
      }),
      readCodexState: () => null,
      fetchClaudeUsage: async () => {
        throw new Error('network timeout');
      }
    });

    expect(adapters).toHaveLength(1);

    const result = await adapters[0].refresh();
    expect(result.ok).toBe(true);

    if (!result.ok) {
      throw new Error('expected a snapshot result');
    }

    expect(result.snapshot.sourceId).toBe('claude-code-official');
    expect(result.snapshot.refreshStatus).toBe('source_broken');
    expect(result.snapshot.lastError).toContain('network timeout');
  });
});
