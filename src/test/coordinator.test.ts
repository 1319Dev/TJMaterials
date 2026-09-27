import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import * as XLSX from 'xlsx';
import { attachImageRecord, listMtrDesk } from '../domain/coordinator';
import { buildDemoData } from '../domain/demo-data';
import { emptySnapshot } from '../domain/empty';
import { ensurePhase2 } from '../domain/hydrate';
import { parsePackingSlipText } from '../domain/packing-slip-ocr';
import { applyTrackerProposals, importTrackerSheet, parseTrackerMatrix } from '../domain/tracker';
import type { AppSnapshot } from '../domain/types';
import { workbookToMatrix } from '../lib/spreadsheet';

const COLUMNS = [
  'Item',
  'QTY',
  'Size (Inches)',
  'Description',
  'Wall/SDR',
  'Steel Grade',
  'Manufacturer',
  'Model Number',
  'Serial/Lot/Heat #',
  'ANSI/Pressure Rating',
];

const MATRIX = [
  ['Construction Order No', 'CO-1001', 'Project Number', 'PN-44'],
  COLUMNS,
  ['1', '10', '12', 'Line pipe', '0.375', 'X52', 'ACME', 'LP-12', 'H99881', 'ANSI 600'],
  ['2', '4', '8', '90 elbow', 'STD', 'WPHY 52', 'Weldbend', 'E90-8', 'LOT-22', '600'],
];

function ctx() {
  let n = 0;
  return {
    now: new Date('2026-09-27T15:00:00.000Z'),
    newId: () => `id-${n++}`,
  };
}

function namedProject(): AppSnapshot {
  const snapshot = emptySnapshot();
  snapshot.project.name = 'Laydown Yard';
  return snapshot;
}

test('tracker import reads the sheet columns and does not accept material', () => {
  const parsed = parseTrackerMatrix(MATRIX);
  expect(parsed.errors).toEqual([]);
  expect(parsed.constructionOrderNo).toBe('CO-1001');
  expect(parsed.projectNumber).toBe('PN-44');
  expect(parsed.rows).toHaveLength(2);
  expect(parsed.rows[0]).toMatchObject({
    item: '1',
    qty: '10',
    sizeInches: '12',
    description: 'Line pipe',
    wallSdr: '0.375',
    steelGrade: 'X52',
    manufacturer: 'ACME',
    modelNumber: 'LP-12',
    serialLotHeat: 'H99881',
    ansiPressureRating: 'ANSI 600',
  });

  const imported = importTrackerSheet(namedProject(), parsed, { fileName: 'bom.xlsx' }, ctx());
  expect(imported.errors).toEqual([]);
  expect(imported.rowCount).toBe(2);
  expect(imported.snapshot.tracker.rows.every((row) => row.verificationStatus !== 'match')).toBe(true);
  expect(imported.snapshot.tracker.rows.every((row) => row.source === 'import')).toBe(true);
  expect(imported.snapshot.materials).toHaveLength(0);
});

test('a workbook round-trips into the tracker and a second upload replaces rows', () => {
  const sheet = XLSX.utils.aoa_to_sheet(MATRIX);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Tracker');
  const bytes = XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  const parsed = parseTrackerMatrix(workbookToMatrix(new Uint8Array(bytes)));
  expect(parsed.rows.map((row) => row.description)).toEqual(['Line pipe', '90 elbow']);

  const first = importTrackerSheet(namedProject(), parsed, { fileName: 'bom.xlsx' }, ctx());
  const replacement = parseTrackerMatrix([
    ['Construction Order No: CO-2', 'Project Number: PN-9'],
    COLUMNS,
    ['3', '1', '6', 'Cap', 'STD', 'A234', 'Forgeco', 'CAP-6', 'H2', '150'],
  ]);
  const second = importTrackerSheet(first.snapshot, replacement, { fileName: 'bom-2.xlsx' }, ctx());
  expect(second.snapshot.tracker.rows).toHaveLength(1);
  expect(second.snapshot.tracker.rows[0]?.description).toBe('Cap');
  expect(second.snapshot.tracker.constructionOrderNo).toBe('CO-2');
  expect(second.snapshot.tracker.projectNumber).toBe('PN-9');
  expect(second.snapshot.tracker.rows[0]?.verificationStatus).not.toBe('match');
});

test('a sheet without the tracker headers is refused', () => {
  const parsed = parseTrackerMatrix([
    ['Hello', 'World'],
    ['1', '2'],
  ]);
  expect(parsed.rows).toEqual([]);
  expect(parsed.errors[0]).toMatch(/Nothing was imported/);
  const imported = importTrackerSheet(namedProject(), parsed, { fileName: 'notes.xlsx' }, ctx());
  expect(imported.rowCount).toBe(0);
  expect(imported.snapshot.tracker.rows).toHaveLength(0);
});

test('packing slip OCR parses fixture text and flags an uncertain line', () => {
  const fixture = readFileSync(path.resolve(process.cwd(), 'src/test/fixtures/packing-slip.txt'), 'utf8');
  const parsed = parsePackingSlipText(fixture);
  expect(parsed.constructionOrderNo).toBe('CO-8841');
  expect(parsed.projectNumber).toBe('PN-220');
  expect(parsed.packingSlipNumber).toBe('PS-1902');
  expect(parsed.proposals).toHaveLength(2);
  expect(parsed.proposals[0]).toMatchObject({
    item: '1',
    qty: '12',
    sizeInches: '8',
    description: '8 IN STD ELL 90',
    wallSdr: 'STD',
    steelGrade: 'WPHY 52',
    manufacturer: 'WELDBEND',
    modelNumber: 'WB-90-8',
    serialLotHeat: 'H12345',
    ansiPressureRating: 'CLASS 600',
    uncertain: false,
  });
  expect(parsed.proposals[1]?.uncertain).toBe(true);
  expect(parsed.proposals[1]?.description).toContain('TEE');
  expect(parsed.proposals[1]?.qty).toBe('?');
});

test('collapsed single-space OCR still proposes editable review rows', () => {
  const text = [
    'CONSTRUCTION ORDER NO: CO0-8841',
    '',
    'PROJECT NUMBER: PN-220',
    '',
    'PACKING SLIP #: PS-1902',
    '',
    'ITEM QTY SIZE (INCHES) DESCRIPTION',
    '1 12 8 ELBOW 90',
    '',
    '2 4 6 TEE',
  ].join('\n');
  const parsed = parsePackingSlipText(text);
  expect(parsed.constructionOrderNo).toBe('CO0-8841');
  expect(parsed.projectNumber).toBe('PN-220');
  expect(parsed.packingSlipNumber).toBe('PS-1902');
  expect(parsed.proposals).toHaveLength(2);
  expect(parsed.proposals[0]).toMatchObject({
    item: '1',
    qty: '12',
    sizeInches: '8',
    description: 'ELBOW 90',
    uncertain: true,
  });
  expect(parsed.proposals[1]).toMatchObject({
    item: '2',
    qty: '4',
    sizeInches: '6',
    description: 'TEE',
    uncertain: true,
  });
  expect(parsed.proposals.every((row) => row.uncertain)).toBe(true);
});

test('confirmed OCR rows merge into the tracker and never auto-accept', () => {
  const demo = buildDemoData('2026-09-26');
  const before = demo.materials.map((material) => [material.id, material.verificationStatus]);
  const fixture = readFileSync(path.resolve(process.cwd(), 'src/test/fixtures/packing-slip.txt'), 'utf8');
  const parsed = parsePackingSlipText(fixture);
  const clean = parsed.proposals[0];
  const uncertain = parsed.proposals[1];
  expect(clean && uncertain).toBeTruthy();
  if (!clean || !uncertain) return;

  const onlyClean = applyTrackerProposals(demo, [clean], { documentId: 'doc-slip', deliveryId: null }, ctx());
  expect(onlyClean.errors).toEqual([]);
  expect(onlyClean.applied).toBe(1);
  expect(onlyClean.snapshot.tracker.rows).toHaveLength(1);
  expect(onlyClean.snapshot.tracker.rows[0]?.verificationStatus).toBe('review_required');
  expect(onlyClean.snapshot.tracker.rows[0]?.source).toBe('ocr');
  expect(onlyClean.snapshot.tracker.rows.some((row) => row.description === uncertain.description)).toBe(false);
  expect(onlyClean.snapshot.materials.map((material) => [material.id, material.verificationStatus])).toEqual(before);
  expect(onlyClean.snapshot.materials.some((material) => material.verificationStatus === 'match')).toBe(false);

  const both = applyTrackerProposals(
    onlyClean.snapshot,
    [{ ...clean, confidence: 0.99, uncertain: false }, uncertain],
    { documentId: 'doc-slip', deliveryId: 'delivery-1', constructionOrderNo: 'CO-8841', projectNumber: 'PN-220' },
    ctx(),
  );
  expect(both.snapshot.tracker.rows).toHaveLength(3);
  expect(both.snapshot.tracker.rows.every((row) => row.verificationStatus === 'review_required')).toBe(true);
  expect(both.snapshot.tracker.rows.some((row) => row.verificationStatus === 'match')).toBe(false);
  expect(both.snapshot.tracker.rows.filter((row) => row.uncertain)).toHaveLength(1);
  expect(both.snapshot.tracker.constructionOrderNo).toBe('CO-8841');
  expect(both.snapshot.materials.map((material) => material.verificationStatus)).toEqual(before.map(([, status]) => status));
});

test('an empty OCR confirmation writes nothing', () => {
  const snapshot = namedProject();
  const result = applyTrackerProposals(snapshot, [], { documentId: null, deliveryId: null }, ctx());
  expect(result.applied).toBe(0);
  expect(result.errors[0]).toMatch(/Nothing was written/);
  expect(result.snapshot.tracker.rows).toHaveLength(0);
});

test('an MTR image does not change material verification', () => {
  const demo = buildDemoData('2026-09-26');
  const material = demo.materials[0];
  expect(material).toBeTruthy();
  if (!material) return;
  const before = demo.materials.map((item) => item.verificationStatus);
  const attached = attachImageRecord(
    demo,
    {
      docType: 'mtr',
      subjectType: 'material',
      subjectId: material.id,
      role: 'mtr',
      caption: 'MTR photo',
      fileName: 'mtr.jpg',
      mimeType: 'image/jpeg',
      byteSize: 128,
    },
    ctx(),
  );
  expect(attached.snapshot.materials.map((item) => item.verificationStatus)).toEqual(before);
  expect(attached.snapshot.materials.some((item) => item.verificationStatus === 'match')).toBe(false);
  const row = listMtrDesk(attached.snapshot).find((item) => item.materialId === material.id);
  expect(row?.documentId).toBe(attached.documentId);
  expect(row?.paperwork).toBe('on_file');
  expect(row?.verificationStatus).toBe(material.verificationStatus);
});

test('older snapshots gain an empty tracker without becoming the sample', () => {
  const legacy = buildDemoData('2026-09-26');
  delete (legacy as Partial<AppSnapshot>).tracker;
  delete (legacy as Partial<AppSnapshot>).packingSlips;
  const next = ensurePhase2(legacy, '2026-09-26');
  expect(next.tracker.rows).toEqual([]);
  expect(next.packingSlips).toEqual([]);
  expect(next.pipeJoints.some((joint) => joint.jointNumber === 'J-1041')).toBe(true);
  expect(next.settings.sample).toBe(true);
});
