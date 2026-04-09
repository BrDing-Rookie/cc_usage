import type { SourceSnapshot } from '@vibe-monitor/shared';
import { normalizeClaudeOfficialUsage, fetchClaudeOfficialUsage } from './adapters/claudeCodeOfficial';
import { normalizeCodexOfficialUsage } from './adapters/codexOfficial';
import type { ClaudeOfficialCredentials, CodexOfficialState } from './auth/credentialStore';
import { readClaudeOfficialCredentials, readCodexOfficialState } from './auth/credentialStore';
import type { SourceAdapter } from './adapters/types';

type ClaudeUsagePayload = Awaited<ReturnType<typeof fetchClaudeOfficialUsage>>;

type DefaultAdapterDeps = {
  env?: Record<string, string | undefined>;
  now?: () => Date;
  readClaudeCredentials?: () => ClaudeOfficialCredentials | null;
  readCodexState?: () => CodexOfficialState | null;
  fetchClaudeUsage?: (accessToken: string) => Promise<ClaudeUsagePayload>;
};

function buildMiccSnapshot(now: Date): SourceSnapshot {
  return {
    sourceId: 'micc-api',
    vendorFamily: 'OpenAI',
    sourceKind: 'custom_endpoint',
    accountLabel: 'MICC API',
    planName: 'MICC API',
    usagePercent: null,
    usedAmount: null,
    totalAmount: null,
    amountUnit: null,
    resetAt: null,
    refreshStatus: 'ok',
    lastSuccessAt: now.toISOString(),
    lastError: null,
    alertKind: null,
    capabilities: {
      percent: false,
      absoluteAmount: false,
      resetTime: false,
      planName: true,
      healthSignal: true
    },
    windows: []
  };
}

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
  deps: Required<Pick<DefaultAdapterDeps, 'readCodexState'>>
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

      return {
        ok: true,
        snapshot: normalizeCodexOfficialUsage(
          {
            sourceId: 'codex-official',
            accountLabel: state.accountLabel,
            planName: state.planName
          },
          {
            planName: state.planName,
            usagePercent: null,
            resetAt: null
          }
        )
      } as const;
    }
  };
}

function buildMiccAdapter(now: () => Date): SourceAdapter {
  return {
    sourceId: 'micc-api',
    sourceKind: 'custom_endpoint',
    vendorFamily: 'OpenAI',
    async refresh() {
      return {
        ok: true,
        snapshot: buildMiccSnapshot(now())
      } as const;
    }
  };
}

export function buildDefaultAdapters(
  runtimeDir: string,
  deps: DefaultAdapterDeps = {}
): SourceAdapter[] {
  const env = deps.env ?? process.env;
  const now = deps.now ?? (() => new Date());
  const readClaudeCredentials = deps.readClaudeCredentials ?? readClaudeOfficialCredentials;
  const readCodexState = deps.readCodexState ?? readCodexOfficialState;
  const fetchClaudeUsage = deps.fetchClaudeUsage ?? fetchClaudeOfficialUsage;

  void runtimeDir;

  const adapters: SourceAdapter[] = [];

  if (readClaudeCredentials()) {
    adapters.push(buildClaudeOfficialAdapter({ readClaudeCredentials, fetchClaudeUsage }));
  }

  if (readCodexState()) {
    adapters.push(buildCodexOfficialAdapter({ readCodexState }));
  }

  const openAiBase = env.OPENAI_API_BASE?.trim();
  const openAiKey = env.OPENAI_API_KEY?.trim();
  const isMicc =
    !!openAiBase &&
    !!openAiKey &&
    (openAiBase.includes('mininglamp') || openAiBase.includes('mlamp'));

  if (isMicc) {
    adapters.push(buildMiccAdapter(now));
  }

  return adapters;
}
