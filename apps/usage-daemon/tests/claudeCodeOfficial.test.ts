import { describe, expect, it } from 'vitest';
import fixture from './fixtures/claude-official-usage.json';
import { normalizeClaudeOfficialUsage } from '../src/adapters/claudeCodeOfficial';

describe('normalizeClaudeOfficialUsage', () => {
  it('maps multi-window official Claude usage into one normalized snapshot', () => {
    const snapshot = normalizeClaudeOfficialUsage(fixture, {
      sourceId: 'claude-code-official',
      accountLabel: 'Personal',
      planName: 'Pro'
    });

    expect(snapshot.planName).toBe('Pro');
    expect(snapshot.usagePercent).toBe(68);
    expect(snapshot.capabilities.absoluteAmount).toBe(false);
    expect(snapshot.windows).toHaveLength(2);
    expect(snapshot.windows[0].label).toBe('5h');
  });
});
