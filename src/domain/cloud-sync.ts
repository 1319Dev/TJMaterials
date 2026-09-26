import { applyRemoteSnapshot, SYNC_TABLES, toRemoteRow, type RemoteBundle, type SyncTable } from './rows';
import type { AppSnapshot, SyncQueueItem } from './types';

export interface RemoteDb {
  upsert(table: string, row: Record<string, unknown>): Promise<string | null>;
  listProjects(): Promise<{ rows: Record<string, unknown>[]; error: string | null }>;
  selectProject(projectId: string): Promise<{ row: Record<string, unknown> | null; error: string | null }>;
  selectChildren(table: SyncTable, projectId: string): Promise<{ rows: Record<string, unknown>[]; error: string | null }>;
  selectAudits(projectId: string): Promise<{ rows: Record<string, unknown>[]; error: string | null }>;
}

const rank = new Map<string, number>(SYNC_TABLES.map((name, index) => [name, index]));

export function orderedPending(queue: readonly SyncQueueItem[]): SyncQueueItem[] {
  return queue
    .filter((item) => item.status === 'pending')
    .slice()
    .sort((a, b) => {
      const left = rank.get(a.entityType) ?? 999;
      const right = rank.get(b.entityType) ?? 999;
      if (left !== right) return left - right;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

export async function pushPending(
  db: RemoteDb,
  snapshot: AppSnapshot,
  ackedAt = new Date().toISOString(),
): Promise<{ snapshot: AppSnapshot; error: string | null }> {
  if (snapshot.settings.sample) return { snapshot, error: null };
  const pending = orderedPending(snapshot.queue);
  const acked: string[] = [];
  for (const item of pending) {
    const row = toRemoteRow(snapshot, item.entityType, item.entityId);
    if (!row) {
      return {
        snapshot: ack(snapshot, acked, ackedAt),
        error: `Could not upload ${item.entityType}. The record is missing on this device, so it was left in the queue.`,
      };
    }
    const error = await db.upsert(item.entityType, row);
    if (error) return { snapshot: ack(snapshot, acked, ackedAt), error };
    acked.push(item.id);
  }
  return { snapshot: ack(snapshot, acked, ackedAt), error: null };
}

function ack(snapshot: AppSnapshot, ids: string[], ackedAt: string): AppSnapshot {
  if (ids.length === 0) return snapshot;
  const idSet = new Set(ids);
  return {
    ...snapshot,
    queue: snapshot.queue.map((item) => (idSet.has(item.id) ? { ...item, status: 'complete', ackedAt } : item)),
  };
}

export async function pullInto(db: RemoteDb, snapshot: AppSnapshot): Promise<{ snapshot: AppSnapshot; error: string | null }> {
  if (snapshot.settings.sample) return { snapshot, error: null };
  let projectId = snapshot.project.id;
  if (!snapshot.project.name.trim()) {
    const listed = await db.listProjects();
    if (listed.error) return { snapshot, error: listed.error };
    if (listed.rows.length === 0) return { snapshot, error: null };
    const newest = [...listed.rows].sort((a, b) => String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')))[0];
    if (!newest) return { snapshot, error: null };
    projectId = String(newest.id);
  }
  const project = await db.selectProject(projectId);
  if (project.error) return { snapshot, error: project.error };
  const tables: RemoteBundle['tables'] = {};
  for (const table of SYNC_TABLES) {
    if (table === 'projects') continue;
    const selected = await db.selectChildren(table, projectId);
    if (selected.error) return { snapshot, error: selected.error };
    tables[table] = selected.rows;
  }
  const audits = await db.selectAudits(projectId);
  if (audits.error) return { snapshot, error: audits.error };
  return {
    snapshot: applyRemoteSnapshot(snapshot, { project: project.row, tables, audits: audits.rows }),
    error: null,
  };
}

export async function runCloudSync(db: RemoteDb, snapshot: AppSnapshot): Promise<{ snapshot: AppSnapshot; error: string | null }> {
  if (snapshot.settings.sample) return { snapshot, error: null };
  const pushed = await pushPending(db, snapshot);
  if (pushed.error) return pushed;
  if (!pushed.snapshot.project.name.trim() && orderedPending(pushed.snapshot.queue).length > 0) {
    return pushed;
  }
  return pullInto(db, pushed.snapshot);
}
