import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCodexUsageHtml } from '../src/providers/codexChatgptUsage';

describe('parseCodexUsageHtml', () => {
  it('extracts plan, percent, and reset time from the codex usage page', () => {
    const html = readFileSync(join(process.cwd(), 'tests/fixtures/codex-usage.html'), 'utf8');
    const parsed = parseCodexUsageHtml(html);

    expect(parsed.planName).toBe('Plus');
    expect(parsed.usagePercent).toBe(37);
    expect(parsed.resetAt).toBe('2026-04-10T00:00:00.000Z');
  });
});
