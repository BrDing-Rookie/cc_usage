import type { SourceSnapshot } from '@vibe-monitor/shared';

export type AdapterFailure = {
  ok: false;
  sourceId: string;
  refreshStatus: 'auth_invalid' | 'source_broken';
  errorText: string;
};

export type AdapterSuccess = {
  ok: true;
  snapshot: SourceSnapshot;
};

export type AdapterResult = AdapterFailure | AdapterSuccess;

export type SourceAdapter = {
  sourceId: string;
  sourceKind: SourceSnapshot['sourceKind'];
  vendorFamily: SourceSnapshot['vendorFamily'];
  refresh: () => Promise<AdapterResult>;
};
