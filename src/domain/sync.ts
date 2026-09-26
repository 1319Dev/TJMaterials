import type { SyncQueueItem } from './types';

export const SYNC_LABEL = {
  offlineSaved: 'OFFLINE — SAVED LOCALLY',
} as const;

export type SyncLabel = (typeof SYNC_LABEL)[keyof typeof SYNC_LABEL];

export function describeSync(input: { pending: number }): { label: SyncLabel; detail: string } {
  const waiting =
    input.pending > 0 ? `${input.pending} change${input.pending === 1 ? '' : 's'} saved on this device. ` : '';
  return {
    label: SYNC_LABEL.offlineSaved,
    detail: `${waiting}Records stay in this browser.`,
  };
}

export function countPending(queue: readonly SyncQueueItem[]): number {
  return queue.filter((item) => item.status === 'pending').length;
}

export function enqueue(
  queue: readonly SyncQueueItem[],
  item: Omit<SyncQueueItem, 'status' | 'ackedAt'>,
): SyncQueueItem[] {
  return [...queue, { ...item, status: 'pending', ackedAt: null }];
}
