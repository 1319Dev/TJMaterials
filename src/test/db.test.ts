import { beforeEach, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import {
  clearParkedSnapshot,
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

test('backfills pipe joints and component rows when a phase 1 snapshot is opened', async () => {
  const phase1 = buildDemoData('2026-09-26');
  const legacy = {
    ...phase1,
    materials: phase1.materials.filter((material) => material.materialCode !== 'PMI-FIT-000004'),
  } as AppSnapshot;
  delete (legacy as Partial<AppSnapshot>).pipeJoints;
  delete (legacy as Partial<AppSnapshot>).fittings;
  delete (legacy as Partial<AppSnapshot>).flanges;
  delete (legacy as Partial<AppSnapshot>).valves;
  await saveSnapshot(legacy);
  const loaded = await loadSnapshot();
  expect(loaded?.pipeJoints.some((joint) => joint.jointNumber === 'J-1041' && joint.lengthFt === 40.25)).toBe(true);
  expect(loaded?.fittings.some((fitting) => fitting.grade === 'WPHY 70' && fitting.expectedGrade === 'WPHY 52')).toBe(true);
  expect(loaded?.valves.some((valve) => valve.actuatorSerial === 'ACT-88321')).toBe(true);
});

test('parking keeps the named project when the working copy is the sample', async () => {
  const named = createEmptySnapshot();
  named.project.name = 'Yard copy';
  await parkLiveSnapshot(named);
  await saveSnapshot(buildDemoData('2026-09-26'));
  const working = await loadSnapshot();
  expect(working?.settings.sample).toBe(true);
  expect(working?.project.name).not.toBe('Yard copy');
  const parked = await loadParkedSnapshot();
  expect(parked?.project.name).toBe('Yard copy');
  expect(parked?.materials).toHaveLength(0);
  await clearParkedSnapshot();
  expect(await loadParkedSnapshot()).toBeNull();
  expect((await loadSnapshot())?.settings.sample).toBe(true);
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
