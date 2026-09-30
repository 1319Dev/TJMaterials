import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';
import * as XLSX from 'xlsx';
import { emptySnapshot } from '../domain/empty';
import {
  MASTER_DATA_ROW,
  MASTER_LIST_LAYOUT,
  buildMasterListWorkbook,
  differenceFormula,
  remainingFormula,
} from '../domain/master-list';
import { createReceipt, emptyReceiveLine, type ReceiveInput } from '../domain/receive';
import { importTrackerSheet, parseTrackerMatrix } from '../domain/tracker';
import { workbookToMatrix } from '../lib/spreadsheet';

const FIXTURE = readFileSync(path.resolve(process.cwd(), 'src/test/fixtures/garrett-master-list.xlsx'));

function ctx() {
  let n = 0;
  return {
    now: new Date('2026-09-27T15:00:00.000Z'),
    newId: () => `id-${n++}`,
  };
}

function named() {
  const snapshot = emptySnapshot();
  snapshot.project.name = 'Laydown Yard';
  snapshot.project.projectNumber = 'PN-77';
  snapshot.project.inspectorName = 'Garrett';
  return snapshot;
}

function receipt(bol: string, lines: ReceiveInput['lines']): ReceiveInput {
  return {
    receivedOn: '2026-09-27',
    vendor: 'Acme Pipe',
    inspectorName: 'Garrett',
    shipmentNumberMrc: '',
    salesOrderOrCustomerPo: '',
    packingSlipNumber: '',
    bolNumber: bol,
    carrier: '',
    poNumber: '',
    notes: 'Yard A',
    lines,
    photoStubs: [],
    gps: null,
    documents: [],
  };
}

test('Garrett’s Master List headers and formulas are the export layout', () => {
  const book = XLSX.read(FIXTURE, { type: 'buffer', cellFormula: true });
  const sheet = book.Sheets['Master List'];
  expect(sheet).toBeTruthy();
  for (const column of MASTER_LIST_LAYOUT) {
    const addr = XLSX.utils.encode_cell({ r: 4, c: column.col });
    expect(String(sheet?.[addr]?.v), addr).toBe(column.header);
  }
  expect(String(sheet?.AQ6?.f).replace(/^=/, '')).toBe(differenceFormula(6));
  expect(String(sheet?.AS6?.f).replace(/^=/, '')).toBe(remainingFormula(6));
  expect(sheet?.A1?.v).toBe('Project Name:');
  expect(sheet?.D2?.v).toBe('Material Handling Tracking');
});

test('a blank Master List template does not import numbered placeholder rows', () => {
  const parsed = parseTrackerMatrix(workbookToMatrix(new Uint8Array(FIXTURE)));
  expect(parsed.rows).toEqual([]);
  expect(parsed.errors[0]).toMatch(/Nothing was imported/);
  const imported = importTrackerSheet(named(), parsed, { fileName: 'template.xlsx' }, ctx());
  expect(imported.rowCount).toBe(0);
  expect(imported.snapshot.tracker.rows).toHaveLength(0);
});

test('a filled Master List row keeps ordered and received quantities apart', () => {
  const matrix = workbookToMatrix(new Uint8Array(FIXTURE));
  const header = matrix.find((row) => row[0] === 'Item' && row.includes('QTY-Ordered'));
  expect(header).toBeTruthy();
  if (!header) return;
  const data = header.map(() => '');
  const at = (label: string) => header.findIndex((cell) => cell === label);
  data[at('Item')] = '4';
  data[at('QTY-Ordered')] = '10';
  data[at('Material Type')] = 'Steel Pipe';
  data[at('Size (Inches)')] = '8';
  data[at('Material Description')] = 'Line pipe';
  data[at('Wall / SDR')] = '0.322';
  data[at('Grade')] = 'X52';
  data[at('Manufacturer')] = 'ACME';
  data[at('QTY-Received')] = '6';
  data[at('UOM (Each/Ft)')] = 'Ft';
  data[at('Location (A,B,C)')] = 'B';
  data[at('Notes/Remarks')] = 'Hold for MTR';
  const parsed = parseTrackerMatrix([
    ['Project Name:', 'North Yard', 'Project #:', 'PN-15', 'Date:', '2026-09-27', 'Inspector:', 'Garrett'],
    header,
    data,
  ]);
  expect(parsed.errors).toEqual([]);
  expect(parsed.projectName).toBe('North Yard');
  expect(parsed.projectNumber).toBe('PN-15');
  expect(parsed.sheetDate).toBe('2026-09-27');
  expect(parsed.inspector).toBe('Garrett');
  expect(parsed.rows).toHaveLength(1);
  expect(parsed.rows[0]).toMatchObject({
    item: '4',
    qtyOrdered: '10',
    qtyReceived: '6',
    materialType: 'Steel Pipe',
    sizeInches: '8',
    description: 'Line pipe',
    wallSdr: '0.322',
    steelGrade: 'X52',
    manufacturer: 'ACME',
    uom: 'Ft',
    location: 'B',
    notes: 'Hold for MTR',
  });
});

test('daily receive and receive material append the next Master List item and never accept it', () => {
  const first = createReceipt(
    named(),
    receipt('BOL-1', [
      {
        ...emptyReceiveLine(),
        description: '8 inch steel pipe',
        diameter: '8',
        wallThickness: '0.322',
        grade: 'X52',
        manufacturer: 'ACME',
        quantity: '6',
        materialType: 'Steel Pipe',
        uom: 'Ft',
      },
      {
        ...emptyReceiveLine(),
        category: 'fitting',
        description: '8 inch elbow',
        quantity: '2',
      },
    ]),
    ctx(),
  );
  expect(first.errors).toEqual([]);
  expect(first.trackerItems).toEqual(['1', '2']);
  expect(first.snapshot.tracker.rows).toHaveLength(2);
  expect(first.snapshot.tracker.projectName).toBe('Laydown Yard');
  expect(first.snapshot.tracker.projectNumber).toBe('PN-77');
  expect(first.snapshot.tracker.inspector).toBe('Garrett');
  expect(first.snapshot.tracker.sheetDate).toBe('2026-09-27');
  expect(first.snapshot.tracker.rows[0]).toMatchObject({
    item: '1',
    description: '8 inch steel pipe',
    qty: '6',
    qtyOrdered: '6',
    qtyReceived: '6',
    materialType: 'Steel Pipe',
    sizeInches: '8',
    wallSdr: '0.322',
    steelGrade: 'X52',
    manufacturer: 'ACME',
    uom: 'Ft',
    notes: 'Yard A',
    source: 'manual',
    verificationStatus: 'review_required',
  });
  expect(first.snapshot.tracker.rows[1]).toMatchObject({
    item: '2',
    description: '8 inch elbow',
    materialType: 'Fitting',
    uom: 'Each',
    qtyReceived: '2',
    verificationStatus: 'review_required',
  });
  expect(first.snapshot.tracker.rows.some((row) => row.verificationStatus === 'match')).toBe(false);
  expect(first.snapshot.materials.every((material) => material.verificationStatus === 'review_required')).toBe(true);

  const second = createReceipt(
    first.snapshot,
    receipt('BOL-2', [
      {
        ...emptyReceiveLine(),
        description: 'flange',
        quantity: '1',
      },
    ]),
    ctx(),
  );
  expect(second.trackerItems).toEqual(['3']);
  expect(second.snapshot.tracker.rows.map((row) => row.item)).toEqual(['1', '2', '3']);
  expect(second.snapshot.materials.some((material) => material.verificationStatus === 'match')).toBe(false);
});

test('exported workbook matches Master List columns, formulas, and companion sheets', () => {
  const saved = createReceipt(
    named(),
    receipt('BOL-9', [
      {
        ...emptyReceiveLine(),
        description: '8 inch steel pipe',
        quantity: '6',
        materialType: 'Steel Pipe',
      },
    ]),
    ctx(),
  );
  const bytes = buildMasterListWorkbook(saved.snapshot.tracker);
  const book = XLSX.read(bytes, { type: 'array', cellFormula: true });
  expect(book.SheetNames).toEqual(['Material Delivery and Inventory', 'Master List', 'AML', 'Sheet1']);
  expect(book.Workbook?.Sheets?.[2]?.Hidden).toBe(1);
  expect(book.Workbook?.Sheets?.[3]?.Hidden).toBe(1);
  const sheet = book.Sheets['Master List'];
  for (const column of MASTER_LIST_LAYOUT) {
    const addr = XLSX.utils.encode_cell({ r: 4, c: column.col });
    expect(String(sheet?.[addr]?.v), addr).toBe(column.header);
  }
  const excelRow = MASTER_DATA_ROW;
  expect(sheet?.A1?.v).toBe('Project Name:');
  expect(sheet?.B1?.v).toBe('Laydown Yard');
  expect(sheet?.B2?.v).toBe('PN-77');
  expect(sheet?.B4?.v).toBe('Garrett');
  expect(sheet?.D2?.v).toBe('Material Handling Tracking');
  expect(sheet?.A6?.v).toBe(1);
  expect(sheet?.B6?.v).toBe(6);
  expect(sheet?.C6?.v).toBe('Steel Pipe');
  expect(sheet?.F6?.v).toBe('8 inch steel pipe');
  expect(sheet?.AP6?.v).toBe(6);
  expect(String(sheet?.AQ6?.f).replace(/^=/, '')).toBe(differenceFormula(excelRow));
  expect(String(sheet?.AS6?.f).replace(/^=/, '')).toBe(remainingFormula(excelRow));
  expect(book.Sheets['Material Delivery and Inventory']?.A1?.v).toMatch(/Material Delivery/);
  expect(book.Sheets.AML?.A1?.v).toBe('Product Name');
  expect(book.Sheets.Sheet1?.A1?.v).toBe('Anodeless Risers');
});
