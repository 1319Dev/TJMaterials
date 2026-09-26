import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { SAMPLE_PROJECT_ID } from '../domain/demo-data';
import { emptySnapshot, normalizeSettings } from '../domain/empty';
import { ensurePhase2 } from '../domain/hydrate';
import type { AppSnapshot } from '../domain/types';

const DB_NAME = 'pipeline-material-inspector';
const DB_VERSION = 1;
const SNAPSHOT_KEY = 'app';
const LIVE_SNAPSHOT_KEY = 'live';

export interface StoredBlob {
  id: string;
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

interface PmiSchema extends DBSchema {
  snapshot: {
    key: string;
    value: AppSnapshot;
  };
  blobs: {
    key: string;
    value: StoredBlob;
  };
}

function open() {
  return openDB<PmiSchema>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('snapshot')) database.createObjectStore('snapshot');
      if (!database.objectStoreNames.contains('blobs')) database.createObjectStore('blobs');
    },
  });
}

async function withDb<T>(fn: (database: IDBPDatabase<PmiSchema>) => Promise<T>): Promise<T> {
  const database = await open();
  try {
    return await fn(database);
  } finally {
    database.close();
  }
}

export async function loadSnapshot(): Promise<AppSnapshot | null> {
  return withDb(async (database) => {
    const existing = await database.get('snapshot', SNAPSHOT_KEY);
    if (!existing) return null;
    const normalized = ensurePhase2({
      ...existing,
      settings: normalizeSettings(existing.settings),
    });
    const stored =
      normalized.project.id === SAMPLE_PROJECT_ID
        ? { ...normalized, settings: { ...normalized.settings, sample: true, guest: true } }
        : normalized;
    if (stored !== existing) await database.put('snapshot', stored, SNAPSHOT_KEY);
    return stored;
  });
}

export function createEmptySnapshot(): AppSnapshot {
  return emptySnapshot();
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<void> {
  await withDb(async (database) => {
    await database.put('snapshot', snapshot, SNAPSHOT_KEY);
  });
}

export async function parkLiveSnapshot(snapshot: AppSnapshot): Promise<void> {
  if (snapshot.settings.sample || snapshot.project.id === SAMPLE_PROJECT_ID) return;
  await withDb(async (database) => {
    await database.put('snapshot', snapshot, LIVE_SNAPSHOT_KEY);
  });
}

export async function loadParkedSnapshot(): Promise<AppSnapshot | null> {
  return withDb(async (database) => {
    const existing = await database.get('snapshot', LIVE_SNAPSHOT_KEY);
    if (!existing || existing.project?.id === SAMPLE_PROJECT_ID) return null;
    const normalized = ensurePhase2({
      ...existing,
      settings: normalizeSettings(existing.settings),
    });
    if (normalized.settings.sample) return null;
    return normalized;
  });
}

export async function clearParkedSnapshot(): Promise<void> {
  await withDb(async (database) => {
    await database.delete('snapshot', LIVE_SNAPSHOT_KEY);
  });
}

export async function saveBlob(record: StoredBlob): Promise<void> {
  await withDb(async (database) => {
    await database.put('blobs', record, record.id);
  });
}

export async function readBlob(id: string): Promise<StoredBlob | undefined> {
  return withDb(async (database) => database.get('blobs', id));
}

export async function deleteBlob(id: string): Promise<void> {
  await withDb(async (database) => {
    await database.delete('blobs', id);
  });
}
