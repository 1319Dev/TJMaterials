import type { SyncQueueItem } from './types';

export const SYNC_LABEL = {
  offlineSaved: 'OFFLINE — SAVED LOCALLY',
  saved: 'SAVED',
  syncing: 'SYNCING',
  syncComplete: 'SYNC COMPLETE',
} as const;

export type SyncLabel = (typeof SYNC_LABEL)[keyof typeof SYNC_LABEL];

export interface SyncInput {
  online: boolean;
  pending: number;
  syncing: boolean;
  remoteConfigured: boolean;
  lastAckAt: string | null;
}

export function describeSync(input: SyncInput): { label: SyncLabel; detail: string } {
  if (!input.online) {
    return {
      label: SYNC_LABEL.offlineSaved,
      detail: 'Offline. Records are on this device and will sync when the connection returns.',
    };
  }
  if (input.syncing) {
    return {
      label: SYNC_LABEL.syncing,
      detail: 'Sending queued records.',
    };
  }
  if (!input.remoteConfigured) {
    const waiting = input.pending > 0 ? `${input.pending} change${input.pending === 1 ? '' : 's'} waiting. ` : '';
    return {
      label: SYNC_LABEL.offlineSaved,
      detail: `${waiting}Saved on this device. No project database is connected on this build.`,
    };
  }
  if (input.pending > 0) {
    return {
      label: SYNC_LABEL.saved,
      detail: `${input.pending} change${input.pending === 1 ? '' : 's'} saved on this device. Waiting to sync.`,
    };
  }
  if (input.lastAckAt) {
    return {
      label: SYNC_LABEL.syncComplete,
      detail: 'Queued records were acknowledged by the connected database.',
    };
  }
  return {
    label: SYNC_LABEL.syncComplete,
    detail: 'No records are waiting.',
  };
}

export function countPending(queue: readonly SyncQueueItem[]): number {
  return queue.filter((item) => item.status === 'pending').length;
}

export function lastAckAt(queue: readonly SyncQueueItem[]): string | null {
  const stamps = queue.map((item) => item.ackedAt).filter((value): value is string => Boolean(value));
  stamps.sort();
  return stamps.at(-1) ?? null;
}

export function applySyncResult(
  queue: readonly SyncQueueItem[],
  result: 'acked' | 'not_configured',
  ackedAt: string,
): SyncQueueItem[] {
  if (result === 'not_configured') {
    return queue.map((item) => ({ ...item }));
  }
  return queue.map((item) =>
    item.status === 'pending'
      ? { ...item, status: 'complete', ackedAt }
      : { ...item },
  );
}

export function enqueue(
  queue: readonly SyncQueueItem[],
  item: Omit<SyncQueueItem, 'status' | 'ackedAt'>,
): SyncQueueItem[] {
  return [...queue, { ...item, status: 'pending', ackedAt: null }];
}
