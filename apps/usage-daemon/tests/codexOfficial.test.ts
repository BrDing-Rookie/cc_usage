import { describe, expect, it } from 'vitest';
import fixture from './fixtures/codex-browser-result.json';
import { normalizeCodexOfficialUsage } from '../src/adapters/codexOfficial';

describe('normalizeCodexOfficialUsage', () => {
  it('merges local auth metadata with the browser-worker result', () => {
    const snapshot = normalizeCodexOfficialUsage(
      {
        sourceId: 'codex-official',
        accountLabel: 'ChatGPT Personal',
        planName: 'Plus'
      },
      fixture
    );

    expect(snapshot.sourceId).toBe('codex-official');
    expect(snapshot.planName).toBe('Plus');
    expect(snapshot.usagePercent).toBe(37);
    expect(snapshot.capabilities.absoluteAmount).toBe(false);
  });
});
