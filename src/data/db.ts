import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { buildDemoData } from '../domain/demo-data';
import { localIsoDate } from '../domain/dates';
import type { AppSnapshot } from '../domain/types';

const DB_NAME = 'pipeline-material-inspector';
const DB_VERSION = 1;
const SNAPSHOT_KEY = 'app';

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

export async function loadSnapshot(): Promise<AppSnapshot> {
  return withDb(async (database) => {
    const existing = await database.get('snapshot', SNAPSHOT_KEY);
    if (existing) return existing;
    const seeded = buildDemoData(localIsoDate());
    await database.put('snapshot', seeded, SNAPSHOT_KEY);
    return seeded;
  });
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<void> {
  await withDb(async (database) => {
    await database.put('snapshot', snapshot, SNAPSHOT_KEY);
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
