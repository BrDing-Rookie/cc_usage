import { describe, expect, it } from 'vitest';
import { resolveCredentialValue, resolveBrowserProfileDir } from '../src/auth/credentialStore';

describe('credentialStore', () => {
  it('prefers env over config over local state', () => {
    const resolved = resolveCredentialValue(
      'API_KEY',
      { API_KEY: 'env-token' },
      { API_KEY: 'config-token' },
      { API_KEY: 'local-token' }
    );

    expect(resolved).toBe('env-token');
  });

  it('creates isolated profile directories per source', () => {
    expect(resolveBrowserProfileDir('/tmp/vibe', 'mininglamp')).toBe('/tmp/vibe/browser-profiles/mininglamp');
  });
});
