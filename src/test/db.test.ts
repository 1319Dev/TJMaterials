import { beforeEach, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import {
  createEmptySnapshot,
  deleteBlob,
  loadParkedSnapshot,
  loadSnapshot,
  parkLiveSnapshot,
  readBlob,
  saveBlob,
  saveSnapshot,
} from '../data/db';
import type { AppSnapshot } from '../domain/types';

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('pipeline-material-inspector');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

test('starts with an empty project and keeps later edits', async () => {
  const first = await loadSnapshot();
  expect(first).toBeNull();
  const empty = createEmptySnapshot();
  expect(empty.project.name).toBe('');
  expect(empty.materials).toHaveLength(0);
  expect(empty.pipeJoints).toHaveLength(0);

  const named = { ...empty, project: { ...empty.project, name: 'Yard copy' } };
  await saveSnapshot(named);
  const second = await loadSnapshot();
  expect(second?.project.name).toBe('Yard copy');
  expect(second?.materials).toHaveLength(0);
});

test('a stored sample is not the project that opens', async () => {
  const sample = buildDemoData('2026-09-26');
  sample.project.name = 'Guest Demo Spread';
  await saveSnapshot(sample);
  const loaded = await loadSnapshot();
  expect(loaded?.settings.sample).toBe(false);
  expect(loaded?.project.id).not.toBe(sample.project.id);
  expect(loaded?.project.name).toBe('');
  expect(loaded?.materials).toHaveLength(0);
  expect(loaded?.pipeJoints).toHaveLength(0);
  expect(JSON.stringify(loaded)).not.toMatch(/Northline Spread A|Guest Demo|PMI-PIPE-000001/);
  const again = await loadSnapshot();
  expect(again?.settings.sample).toBe(false);
  expect(again?.project.name).toBe('');
  expect(again?.materials).toHaveLength(0);
});

test('an old guest demo name does not open even with another id', async () => {
  const sample = buildDemoData('2026-09-26');
  sample.project.id = '33333333-3333-4333-8333-333333333333';
  sample.project.name = 'Guest Demo Spread';
  sample.settings.sample = false;
  await saveSnapshot(sample);
  const loaded = await loadSnapshot();
  expect(loaded?.project.name).toBe('');
  expect(loaded?.settings.sample).toBe(false);
  expect(loaded?.materials).toHaveLength(0);
});

test('a stored sample marked only by its flag does not open', async () => {
  const sample = buildDemoData('2026-09-26');
  sample.project.id = '22222222-2222-4222-8222-222222222222';
  sample.project.name = 'Northline Spread A';
  sample.settings.sample = true;
  await saveSnapshot(sample);
  const loaded = await loadSnapshot();
  expect(loaded?.settings.sample).toBe(false);
  expect(loaded?.materials).toHaveLength(0);
  expect(loaded?.project.name).toBe('');
});

test('a parked field project replaces a stored sample on open', async () => {
  const named = createEmptySnapshot();
  named.project.name = 'Yard copy';
  await parkLiveSnapshot(named);
  await saveSnapshot(buildDemoData('2026-09-26'));
  const working = await loadSnapshot();
  expect(working?.settings.sample).toBe(false);
  expect(working?.project.name).toBe('Yard copy');
  expect(working?.materials).toHaveLength(0);
  expect(await loadParkedSnapshot()).toBeNull();
});

test('a phase 1 field project does not gain sample rows', async () => {
  const phase1 = buildDemoData('2026-09-26');
  const legacy = {
    ...phase1,
    project: { ...phase1.project, id: '11111111-1111-4111-8111-111111111111', name: 'Yard copy' },
    settings: { ...phase1.settings, sample: false },
    materials: [],
  } as AppSnapshot;
  delete (legacy as Partial<AppSnapshot>).pipeJoints;
  delete (legacy as Partial<AppSnapshot>).fittings;
  delete (legacy as Partial<AppSnapshot>).flanges;
  delete (legacy as Partial<AppSnapshot>).valves;
  await saveSnapshot(legacy);
  const loaded = await loadSnapshot();
  expect(loaded?.project.name).toBe('Yard copy');
  expect(loaded?.settings.sample).toBe(false);
  expect(loaded?.materials).toHaveLength(0);
  expect(loaded?.pipeJoints).toEqual([]);
  expect(loaded?.fittings).toEqual([]);
});

test('stores and removes an attachment blob without changing its size', async () => {
  const bytes = new TextEncoder().encode('heat H52-18440');
  await saveBlob({ id: 'doc-1', bytes, fileName: 'note.txt', mimeType: 'text/plain', byteSize: bytes.byteLength });
  const stored = await readBlob('doc-1');
  expect(stored?.byteSize).toBe(bytes.byteLength);
  expect(stored?.fileName).toBe('note.txt');
  expect(stored?.mimeType).toBe('text/plain');
  expect(new TextDecoder().decode(stored?.bytes)).toBe('heat H52-18440');
  await deleteBlob('doc-1');
  expect(await readBlob('doc-1')).toBeUndefined();
  expect(buildDemoData('2026-09-26').documents[0]?.byteSize).toBe(0);
});
