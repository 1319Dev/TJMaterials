import { beforeEach, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { deleteBlob, loadSnapshot, readBlob, saveBlob, saveSnapshot } from '../data/db';
import type { AppSnapshot } from '../domain/types';

beforeEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('pipeline-material-inspector');
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => resolve();
  });
});

test('seeds guest data in IndexedDB and keeps later edits', async () => {
  const first = await loadSnapshot();
  expect(first.project.name).toBe('Guest Demo Spread');
  expect(first.materials.some((material) => material.materialCode === 'PMI-PIPE-000001')).toBe(true);

  const renamed = { ...first, project: { ...first.project, name: 'Yard copy' } };
  await saveSnapshot(renamed);
  const second = await loadSnapshot();
  expect(second.project.name).toBe('Yard copy');
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
  expect(loaded.pipeJoints.some((joint) => joint.jointNumber === 'J-1041' && joint.lengthFt === 40.25)).toBe(true);
  expect(loaded.fittings.some((fitting) => fitting.grade === 'WPHY 70' && fitting.expectedGrade === 'WPHY 52')).toBe(true);
  expect(loaded.valves.some((valve) => valve.actuatorSerial === 'ACT-88321')).toBe(true);
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
