import { describe, expect, it } from 'vitest';
import { resolveCredentialValue, resolveBrowserProfileDir } from '../src/auth/credentialStore';

describe('credentialStore', () => {
  it('prefers env over config over local state', () => {
    const resolved = resolveCredentialValue(
      'CLAUDE_TOKEN',
      {
        CLAUDE_TOKEN: 'env-token'
      },
      {
        CLAUDE_TOKEN: 'config-token'
      },
      {
        CLAUDE_TOKEN: 'local-token'
      }
    );

    expect(resolved).toBe('env-token');
  });

  it('creates isolated profile directories per source', () => {
    expect(resolveBrowserProfileDir('/tmp/vibe', 'codex-official')).toBe('/tmp/vibe/browser-profiles/codex-official');
    expect(resolveBrowserProfileDir('/tmp/vibe', 'claude-web')).toBe('/tmp/vibe/browser-profiles/claude-web');
  });
});
