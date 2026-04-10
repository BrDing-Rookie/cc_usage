import { describe, expect, it } from 'vitest';
import config from '../../../config/sources.custom.json';
import fixture from './fixtures/custom-endpoint-usage.json';
import { normalizeCustomEndpointUsage } from '../src/adapters/customEndpoint';

describe('normalizeCustomEndpointUsage', () => {
  it('maps the declarative field paths into a normalized snapshot', () => {
    const snapshot = normalizeCustomEndpointUsage(config[0], fixture);

    expect(snapshot.sourceId).toBe('claude-code-custom-local');
    expect(snapshot.planName).toBe('Max');
    expect(snapshot.usedAmount).toBe(270);
    expect(snapshot.totalAmount).toBe(500);
    expect(snapshot.amountUnit).toBe('requests');
  });
});
