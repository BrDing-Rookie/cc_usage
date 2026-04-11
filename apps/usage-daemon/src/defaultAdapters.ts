import { normalizeClaudeOfficialUsage, fetchClaudeOfficialUsage } from './adapters/claudeCodeOfficial';
import { normalizeCodexOfficialUsage } from './adapters/codexOfficial';
import { buildMininglampAdapter } from './adapters/mininglamp';
import type { ClaudeOfficialCredentials, CodexOfficialState } from './auth/credentialStore';
import { readClaudeOfficialCredentials, readCodexOfficialState, resolveBrowserProfileDir } from './auth/credentialStore';
import type { SourceAdapter } from './adapters/types';
import { runBrowserJob as defaultRunBrowserJob } from './browser/workerClient';
import { existsSync } from 'node:fs';

type ClaudeUsagePayload = Awaited<ReturnType<typeof fetchClaudeOfficialUsage>>;

type DefaultAdapterDeps = {
  env?: Record<string, string | undefined>;
  readClaudeCredentials?: () => ClaudeOfficialCredentials | null;
  readCodexState?: () => CodexOfficialState | null;
  fetchClaudeUsage?: (accessToken: string) => Promise<ClaudeUsagePayload>;
  runBrowserJob?: (job: unknown) => Promise<unknown>;
};

function buildClaudeOfficialAdapter(
  deps: Required<Pick<DefaultAdapterDeps, 'readClaudeCredentials' | 'fetchClaudeUsage'>>
): SourceAdapter {
  return {
    sourceId: 'claude-code-official',
    sourceKind: 'official_api',
    vendorFamily: 'Anthropic',
    async refresh() {
      const credentials = deps.readClaudeCredentials();
      if (!credentials) {
        return {
          ok: false,
          sourceId: 'claude-code-official',
          refreshStatus: 'auth_invalid',
          errorText: 'missing claude official credentials'
        } as const;
      }

      try {
        const payload = await deps.fetchClaudeUsage(credentials.accessToken);
        return {
          ok: true,
          snapshot: normalizeClaudeOfficialUsage(payload, {
            sourceId: 'claude-code-official',
            accountLabel: 'Claude Code Official',
            planName: credentials.subscriptionType
          })
        } as const;
      } catch (error) {
        return {
          ok: true,
          snapshot: {
            ...normalizeClaudeOfficialUsage(
              {},
              {
                sourceId: 'claude-code-official',
                accountLabel: 'Claude Code Official',
                planName: credentials.subscriptionType
              }
            ),
            refreshStatus: 'source_broken',
            lastError: error instanceof Error ? error.message : 'claude official fetch failed'
          }
        } as const;
      }
    }
  };
}

function buildCodexOfficialAdapter(
  runtimeDir: string,
  deps: Required<Pick<DefaultAdapterDeps, 'readCodexState' | 'runBrowserJob'>>
): SourceAdapter {
  return {
    sourceId: 'codex-official',
    sourceKind: 'browser_automation',
    vendorFamily: 'OpenAI',
    async refresh() {
      const state = deps.readCodexState();
      if (!state) {
        return {
          ok: false,
          sourceId: 'codex-official',
          refreshStatus: 'auth_invalid',
          errorText: 'missing codex official state'
        } as const;
      }

      const profileDir = resolveBrowserProfileDir(runtimeDir, 'codex-official');
      if (!existsSync(profileDir)) {
        return {
          ok: false,
          sourceId: 'codex-official',
          refreshStatus: 'auth_invalid',
          errorText: 'missing codex browser profile'
        } as const;
      }

      try {
        const jobResult = await deps.runBrowserJob({
          provider: 'codex-chatgpt-usage',
          runtimeDir,
          sourceId: 'codex-official',
          url: 'https://chatgpt.com/codex/cloud/settings/usage'
        });

        const parsed =
          typeof jobResult === 'object' && jobResult !== null
            ? (jobResult as Record<string, unknown>)
            : null;
        const data =
          parsed && parsed.ok === true && typeof parsed.data === 'object' && parsed.data !== null
            ? (parsed.data as Record<string, unknown>)
            : null;

        if (!data) {
          const detail = parsed && typeof parsed.error === 'string' ? parsed.error : 'unknown';
          throw new Error(`codex-browser-job-${detail}`);
        }

        return {
          ok: true,
          snapshot: normalizeCodexOfficialUsage(
            {
              sourceId: 'codex-official',
              accountLabel: state.accountLabel,
              planName: state.planName
            },
            {
              planName: typeof data.planName === 'string' ? data.planName : null,
              usagePercent: typeof data.usagePercent === 'number' ? data.usagePercent : null,
              resetAt: typeof data.resetAt === 'string' ? data.resetAt : null
            }
          )
        } as const;
      } catch (error) {
        return {
          ok: false,
          sourceId: 'codex-official',
          refreshStatus: 'source_broken',
          errorText: error instanceof Error ? error.message : 'codex official fetch failed'
        } as const;
      }
    }
  };
}

export function buildDefaultAdapters(
  runtimeDir: string,
  deps: DefaultAdapterDeps = {}
): SourceAdapter[] {
  const env = deps.env ?? process.env;
  const readClaudeCredentials = deps.readClaudeCredentials ?? readClaudeOfficialCredentials;
  const readCodexState = deps.readCodexState ?? readCodexOfficialState;
  const fetchClaudeUsage = deps.fetchClaudeUsage ?? fetchClaudeOfficialUsage;
  const runBrowserJob = deps.runBrowserJob ?? defaultRunBrowserJob;

  const adapters: SourceAdapter[] = [];

  if (readClaudeCredentials()) {
    adapters.push(buildClaudeOfficialAdapter({ readClaudeCredentials, fetchClaudeUsage }));
  }

  if (readCodexState()) {
    adapters.push(buildCodexOfficialAdapter(runtimeDir, { readCodexState, runBrowserJob }));
  }

  const mininglampBase = env.MININGLAMP_BASE_URL?.trim();
  const mininglampKey = env.MININGLAMP_API_KEY?.trim();

  if (mininglampBase && mininglampKey) {
    adapters.push(
      buildMininglampAdapter({
        baseUrl: mininglampBase,
        apiKey: mininglampKey
      })
    );
  }

  return adapters;
}
