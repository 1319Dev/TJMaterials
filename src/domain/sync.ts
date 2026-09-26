import type { SyncQueueItem } from './types';

export const SYNC_LABEL = {
  offlineSaved: 'OFFLINE — SAVED LOCALLY',
  syncing: 'SYNCING',
  syncComplete: 'SYNC COMPLETE',
} as const;

export type SyncLabel = (typeof SYNC_LABEL)[keyof typeof SYNC_LABEL];

/**
 * Phase 1 does not ship a remote database client.
 * SYNC COMPLETE is only returned after a configured transport acknowledges the queue.
 */
export const remoteConfigured = false;

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
      detail: 'This device is offline. New records stay in on-device storage.',
    };
  }
  if (input.syncing) {
    return {
      label: SYNC_LABEL.syncing,
      detail: 'Sending queued records.',
    };
  }
  if (input.pending === 0 && input.remoteConfigured && input.lastAckAt) {
    return {
      label: SYNC_LABEL.syncComplete,
      detail: 'Queued records were acknowledged by the connected database.',
    };
  }
  if (!input.remoteConfigured) {
    const waiting = input.pending > 0 ? `${input.pending} change${input.pending === 1 ? '' : 's'} waiting. ` : '';
    return {
      label: SYNC_LABEL.offlineSaved,
      detail: `${waiting}Saved on this device. No project database is connected, so nothing was uploaded.`,
    };
  }
  if (input.pending > 0) {
    return {
      label: SYNC_LABEL.offlineSaved,
      detail: 'Records are waiting to sync.',
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
