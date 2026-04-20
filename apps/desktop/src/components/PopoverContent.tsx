import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
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
import './PopoverContent.css';

const POPOVER_WIDTH = 320;
const POPOVER_MIN_HEIGHT = 180;
const POPOVER_MAX_HEIGHT = 420;
const OVERVIEW_VERTICAL_CHROME = 24;
const DETAIL_LIST_MAX_HEIGHT = 304;

type PopoverContentProps = {
  pinnedAccountId: string | null;
  state: MaterializedState;
};

export function PopoverContent({ pinnedAccountId, state }: PopoverContentProps) {
  const [selectedGatewayId, setSelectedGatewayId] = useState<GatewayId | null>(null);
  const [isDetailScrollable, setIsDetailScrollable] = useState(false);
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const detailHeaderRef = useRef<HTMLDivElement | null>(null);
  const detailEmptyRef = useRef<HTMLDivElement | null>(null);
  const accountListRef = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      selectedGatewayId &&
      !state.gateways.some((gateway) => gateway.gatewayId === selectedGatewayId)
    ) {
      setSelectedGatewayId(null);
    }
  }, [selectedGatewayId, state.gateways]);

  useLayoutEffect(() => {
    let nextHeight = POPOVER_MIN_HEIGHT;
    let nextScrollable = false;

    if (selectedGatewayId) {
      const headerHeight = detailHeaderRef.current?.scrollHeight ?? 0;
      const emptyHeight = detailEmptyRef.current?.scrollHeight ?? 0;
      const accountListHeight = accountListRef.current?.scrollHeight ?? 0;

      nextScrollable = accountListHeight > DETAIL_LIST_MAX_HEIGHT;
      nextHeight = clampHeight(
        headerHeight + emptyHeight + Math.min(accountListHeight, DETAIL_LIST_MAX_HEIGHT)
      );
    } else if (state.gateways.length) {
      nextHeight = clampHeight(
        (overviewRef.current?.scrollHeight ?? 0) + OVERVIEW_VERTICAL_CHROME
      );
    }

    if (lastHeightRef.current !== nextHeight) {
      lastHeightRef.current = nextHeight;
      void getCurrentWindow().setSize(new LogicalSize(POPOVER_WIDTH, nextHeight));
    }

    setIsDetailScrollable((previous) => (previous === nextScrollable ? previous : nextScrollable));
  }, [selectedGatewayId, state]);

  if (selectedGatewayId) {
    const gateway = state.gateways.find((item) => item.gatewayId === selectedGatewayId);
    const accounts = sortAccounts(
      state.accounts.filter((item) => item.gatewayId === selectedGatewayId),
      pinnedAccountId
    );

    return (
      <GatewayDetail
        gateway={gateway ?? null}
        accounts={accounts}
        onBack={() => setSelectedGatewayId(null)}
        headerRef={detailHeaderRef}
        emptyRef={detailEmptyRef}
        accountListRef={accountListRef}
        isScrollable={isDetailScrollable}
      />
    );
  }

  if (!state.gateways.length) {
    return <div className="popover-empty">No data available</div>;
  }

  return (
    <div className="popover-overview" ref={overviewRef}>
      {sortGateways(state.gateways, state.accounts, pinnedAccountId).map((gateway) => (
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

function sortGateways(
  gateways: GatewaySummary[],
  accounts: AccountSnapshot[],
  pinnedAccountId: string | null
) {
  return [...gateways].sort((left, right) => {
    const leftPinned = gatewayContainsPinned(left.gatewayId, accounts, pinnedAccountId);
    const rightPinned = gatewayContainsPinned(right.gatewayId, accounts, pinnedAccountId);

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return comparePercent(right.usagePercent, left.usagePercent);
  });
}

function sortAccounts(accounts: AccountSnapshot[], pinnedAccountId: string | null) {
  return [...accounts].sort((left, right) => {
    const leftPinned = left.sourceId === pinnedAccountId;
    const rightPinned = right.sourceId === pinnedAccountId;

    if (leftPinned !== rightPinned) {
      return leftPinned ? -1 : 1;
    }

    return comparePercent(right.usagePercent, left.usagePercent);
  });
}

function gatewayContainsPinned(
  gatewayId: GatewayId,
  accounts: AccountSnapshot[],
  pinnedAccountId: string | null
) {
  return accounts.some(
    (account) => account.gatewayId === gatewayId && account.sourceId === pinnedAccountId
  );
}

function comparePercent(left: number | null, right: number | null) {
  if (left === null && right === null) {
    return 0;
  }
  if (left === null) {
    return 1;
  }
  if (right === null) {
    return -1;
  }

  return left - right;
}

function GatewayDetail({
  gateway,
  accounts,
  onBack,
  headerRef,
  emptyRef,
  accountListRef,
  isScrollable
}: {
  gateway: GatewaySummary | null;
  accounts: AccountSnapshot[];
  onBack: () => void;
  headerRef: React.RefObject<HTMLDivElement | null>;
  emptyRef: React.RefObject<HTMLDivElement | null>;
  accountListRef: React.RefObject<HTMLDivElement | null>;
  isScrollable: boolean;
}) {
  const gatewayLabel = gateway ? getGatewayLabel(gateway.gatewayId) : 'Gateway';

  return (
    <div className="gateway-detail">
      <div className="gateway-detail__header" ref={headerRef}>
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
        <div className="popover-empty" ref={emptyRef}>
          No accounts configured
        </div>
      ) : (
        <div
          aria-label={`${gatewayLabel} accounts`}
          className={`account-list${isScrollable ? ' account-list--scrollable' : ''}`}
          ref={accountListRef}
          role="list"
        >
          {accounts.map((account) => (
            <div
              key={account.sourceId}
              className={`account-card${
                account.refreshStatus !== 'ok' ? ' account-card--warning' : ''
              }`}
              role="listitem"
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

function clampHeight(height: number) {
  return Math.max(POPOVER_MIN_HEIGHT, Math.min(POPOVER_MAX_HEIGHT, height));
}
