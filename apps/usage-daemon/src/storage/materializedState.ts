import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AccountSnapshot,
  GatewayId,
  GatewaySummary,
  MaterializedState,
  SourceSnapshot
} from '@vibe-monitor/shared';

const FIXED_GATEWAYS: GatewayId[] = ['llm-gateway', 'vibe'];

export function writeMaterializedState(
  dataDir: string,
  snapshots: SourceSnapshot[],
  generatedAt: string = new Date().toISOString()
): void {
  mkdirSync(dataDir, { recursive: true });
  const target = join(dataDir, 'current-snapshots.json');
  const tmp = join(dataDir, 'current-snapshots.json.tmp');

  const accounts = snapshots.map(toAccountSnapshot);
  const materialized: MaterializedState = {
    generatedAt,
    gateways: buildGatewaySummaries(accounts),
    accounts
  };

  writeFileSync(tmp, JSON.stringify(materialized, null, 2), 'utf8');
  renameSync(tmp, target);
}

function toAccountSnapshot(snapshot: SourceSnapshot): AccountSnapshot {
  const [rawGatewayId, rawAccountId] = snapshot.sourceId.split(':');
  const gatewayId = normalizeGatewayId(rawGatewayId ?? snapshot.vendorFamily);
  const accountId = rawAccountId ?? 'default';

  return {
    ...snapshot,
    sourceId: `${gatewayId}:${accountId}`,
    gatewayId,
    accountId
  };
}

function buildGatewaySummaries(accounts: AccountSnapshot[]): GatewaySummary[] {
  return FIXED_GATEWAYS.map((gatewayId) => {
    const gatewayAccounts = accounts.filter((account) => account.gatewayId === gatewayId);
    const accountCount = gatewayAccounts.length;
    const healthyCount = gatewayAccounts.filter((account) => account.refreshStatus === 'ok').length;
    const brokenCount = accountCount - healthyCount;
    const allAbsolute =
      accountCount > 0 &&
      gatewayAccounts.every(
        (account) =>
          account.usedAmount !== null &&
          account.totalAmount !== null &&
          account.amountUnit === gatewayAccounts[0]?.amountUnit
      );

    const usedAmount = allAbsolute
      ? gatewayAccounts.reduce((sum, account) => sum + (account.usedAmount ?? 0), 0)
      : null;
    const totalAmount = allAbsolute
      ? gatewayAccounts.reduce((sum, account) => sum + (account.totalAmount ?? 0), 0)
      : null;

    return {
      gatewayId,
      accountCount,
      healthyCount,
      brokenCount,
      usagePercent:
        usedAmount !== null && totalAmount !== null && totalAmount > 0
          ? Math.min(100, Math.max(0, (usedAmount / totalAmount) * 100))
          : null,
      usedAmount,
      totalAmount,
      amountUnit: allAbsolute ? gatewayAccounts[0]?.amountUnit ?? null : null,
      topAlertKind:
        gatewayAccounts.find((account) => account.alertKind)?.alertKind ?? null,
      lastSuccessAt:
        gatewayAccounts
          .map((account) => account.lastSuccessAt)
          .filter((value): value is string => Boolean(value))
          .sort()
          .at(-1) ?? null
    };
  });
}

function normalizeGatewayId(value: string | undefined): GatewayId {
  return value === 'vibe' || value === 'litellm' ? 'vibe' : 'llm-gateway';
}
