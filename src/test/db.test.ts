import { beforeEach, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { deleteBlob, loadSnapshot, readBlob, saveBlob, saveSnapshot } from '../data/db';

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
