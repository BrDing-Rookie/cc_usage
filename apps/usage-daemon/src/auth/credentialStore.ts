import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';

export function resolveCredentialValue(
  key: string,
  env: Record<string, string | undefined>,
  config: Record<string, string | undefined>,
  localState: Record<string, string | undefined>
): string | null {
  return env[key] ?? config[key] ?? localState[key] ?? null;
}

export function resolveBrowserProfileDir(runtimeDir: string, sourceId: string): string {
  return `${runtimeDir}/browser-profiles/${sourceId}`;
}

export type ClaudeOfficialCredentials = {
  accessToken: string;
  subscriptionType: string | null;
};

type ClaudeKeychainRecord = {
  claudeAiOauth?: {
    accessToken?: string;
    subscriptionType?: string;
  };
};

type CodexTokenPayload = {
  'https://api.openai.com/auth'?: {
    chatgpt_plan_type?: string;
  };
};

type CodexIdPayload = {
  'https://api.openai.com/auth'?: {
    organizations?: Array<{
      title?: string;
      is_default?: boolean;
    }>;
  };
};

export type CodexOfficialState = {
  planName: string | null;
  accountLabel: string;
};

function titleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  const payload = parts[1];
  const normalized = payload + '='.repeat((4 - (payload.length % 4 || 4)) % 4);

  try {
    return JSON.parse(Buffer.from(normalized, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function readClaudeOfficialCredentials(
  loadRaw: () => string = () =>
    execFileSync('/usr/bin/security', ['find-generic-password', '-s', 'Claude Code-credentials', '-w'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
): ClaudeOfficialCredentials | null {
  try {
    const raw = loadRaw().trim();
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as ClaudeKeychainRecord;
    const accessToken = parsed.claudeAiOauth?.accessToken?.trim();

    if (!accessToken) {
      return null;
    }

    return {
      accessToken,
      subscriptionType: parsed.claudeAiOauth?.subscriptionType?.trim() || null
    };
  } catch {
    return null;
  }
}

export function readCodexOfficialState(
  authFilePath: string = `${homedir()}/.codex/auth.json`
): CodexOfficialState | null {
  if (!existsSync(authFilePath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(readFileSync(authFilePath, 'utf8')) as {
      tokens?: {
        access_token?: string;
        id_token?: string;
      };
    };

    const accessPayload = parsed.tokens?.access_token
      ? decodeJwtPayload<CodexTokenPayload>(parsed.tokens.access_token)
      : null;
    const idPayload = parsed.tokens?.id_token
      ? decodeJwtPayload<CodexIdPayload>(parsed.tokens.id_token)
      : null;

    const planNameRaw = accessPayload?.['https://api.openai.com/auth']?.chatgpt_plan_type;
    const defaultOrg = idPayload?.['https://api.openai.com/auth']?.organizations?.find(
      (org) => org.is_default
    );
    const fallbackOrg = idPayload?.['https://api.openai.com/auth']?.organizations?.[0];
    const username = userInfo().username;

    return {
      planName: typeof planNameRaw === 'string' && planNameRaw.length > 0 ? titleCase(planNameRaw) : null,
      accountLabel: defaultOrg?.title || fallbackOrg?.title || username
    };
  } catch {
    return null;
  }
}
