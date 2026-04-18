import { useState } from 'react';
import type {
  AccountSnapshot,
  GatewayId,
  GatewaySummary,
  MaterializedState
} from '@vibe-monitor/shared';
import {
  formatCountLabel,
  formatMetricPair,
  formatPercent,
  formatRefreshLabel,
  getGatewayLabel,
  getGatewayStatusLabel
} from './monitorUtils';

type PopoverContentProps = {
  state: MaterializedState;
};

export function PopoverContent({ state }: PopoverContentProps) {
  const [selectedGatewayId, setSelectedGatewayId] = useState<GatewayId | null>(null);

  if (selectedGatewayId) {
    const gateway = state.gateways.find((item) => item.gatewayId === selectedGatewayId);
    const accounts = state.accounts.filter((item) => item.gatewayId === selectedGatewayId);

    return (
      <GatewayDetail
        gateway={gateway ?? null}
        accounts={accounts}
        onBack={() => setSelectedGatewayId(null)}
      />
    );
  }

  if (!state.gateways.length) {
    return <div className="popover-empty">No data available</div>;
  }

  return (
    <div className="popover-overview">
      {state.gateways.map((gateway) => (
        <button
          key={gateway.gatewayId}
          className={`gateway-card${
            gateway.brokenCount > 0 || gateway.topAlertKind ? ' gateway-card--warning' : ''
          }`}
          onClick={() => setSelectedGatewayId(gateway.gatewayId)}
          type="button"
          aria-label={getGatewayLabel(gateway.gatewayId)}
        >
          <div className="gateway-card__top">
            <span className="gateway-card__name">{getGatewayLabel(gateway.gatewayId)}</span>
            <span className="gateway-card__status">{getGatewayStatusLabel(gateway)}</span>
          </div>
          <strong className="gateway-card__metric">
            {gateway.accountCount === 0
              ? 'Usage unavailable'
              : formatMetricPair(gateway.usedAmount, gateway.totalAmount, gateway.amountUnit)}
          </strong>
          <div className="gateway-card__counts">
            <span>{formatCountLabel(gateway.healthyCount, 'healthy')}</span>
            <span>{formatCountLabel(gateway.brokenCount, 'issues')}</span>
          </div>
        </button>
      ))}
    </div>
  );
}

function GatewayDetail({
  gateway,
  accounts,
  onBack
}: {
  gateway: GatewaySummary | null;
  accounts: AccountSnapshot[];
  onBack: () => void;
}) {
  const gatewayLabel = gateway ? getGatewayLabel(gateway.gatewayId) : 'Gateway';

  return (
    <div className="gateway-detail">
      <div className="gateway-detail__header">
        <button className="detail-back" onClick={onBack} type="button">
          Back
        </button>
        <div className="gateway-detail__title-group">
          <div className="gateway-card__name">{gatewayLabel}</div>
          <div className="gateway-detail__subtitle">
            {accounts.length === 0
              ? 'No accounts configured'
              : `${accounts.length} ${
                  accounts.length === 1 ? 'account' : 'accounts'
                }`}
          </div>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="popover-empty">No accounts configured</div>
      ) : (
        <div className="account-list">
          {accounts.map((account) => (
            <div
              key={account.sourceId}
              className={`account-card${
                account.refreshStatus !== 'ok' ? ' account-card--warning' : ''
              }`}
            >
              <div className="account-card__header">
                <span className="account-card__name">{account.accountLabel}</span>
                <span
                  className={`account-card__percent${
                    (account.usagePercent ?? 0) >= 80 ? ' account-card__percent--warning' : ''
                  }`}
                >
                  {formatPercent(account.usagePercent)}
                </span>
              </div>
              <div className="account-card__metric">
                {formatMetricPair(account.usedAmount, account.totalAmount, account.amountUnit)}
              </div>
              <div className="account-card__status">
                {formatRefreshLabel(account.refreshStatus)}
              </div>
              {account.lastError && (
                <div className="account-card__error">{account.lastError}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
