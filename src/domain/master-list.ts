import * as XLSX from 'xlsx';
import companions from './master-list-companions.json';
import type { TrackerRow, TrackerSheet } from './types';

/** Excel row of the Master List column titles. Data begins on the next row. */
export const MASTER_HEADER_ROW = 5;
export const MASTER_DATA_ROW = 6;

export type MasterField =
  | 'item'
  | 'qtyOrdered'
  | 'materialType'
  | 'sizeInches'
  | 'description'
  | 'wallSdr'
  | 'steelGrade'
  | 'manufacturer'
  | 'modelNumber'
  | 'serialLotHeat'
  | 'ansiPressureRating'
  | 'uom'
  | 'qtyReceived'
  | 'difference'
  | 'qtyUsed'
  | 'remaining'
  | 'location'
  | 'mtrYn'
  | 'matchesIfc'
  | 'damagedMaterials'
  | 'notes';

export interface MasterColumn {
  header: string;
  col: number;
  mergeTo?: number;
  field: MasterField;
}

/**
 * Column positions taken from Garrett's Material Handling Tracking workbook.
 * Header text sits on row 5. Merged spans match that sheet.
 * Difference is AP{n}-B{n}. Remaining Material is AP{n}-AR{n}.
 */
export const MASTER_LIST_LAYOUT: readonly MasterColumn[] = [
  { header: 'Item', col: 0, field: 'item' },
  { header: 'QTY-Ordered', col: 1, field: 'qtyOrdered' },
  { header: 'Material Type', col: 2, field: 'materialType' },
  { header: 'Size (Inches)', col: 3, mergeTo: 4, field: 'sizeInches' },
  { header: 'Material Description', col: 5, mergeTo: 18, field: 'description' },
  { header: 'Wall / SDR', col: 19, mergeTo: 20, field: 'wallSdr' },
  { header: 'Grade', col: 21, mergeTo: 22, field: 'steelGrade' },
  { header: 'Manufacturer', col: 23, mergeTo: 29, field: 'manufacturer' },
  { header: 'Model Number', col: 30, mergeTo: 32, field: 'modelNumber' },
  { header: 'Serial / Lot / Heat #', col: 33, mergeTo: 36, field: 'serialLotHeat' },
  { header: 'ANSI / Pressure Rating', col: 37, mergeTo: 39, field: 'ansiPressureRating' },
  { header: 'UOM (Each/Ft)', col: 40, field: 'uom' },
  { header: 'QTY-Received', col: 41, field: 'qtyReceived' },
  { header: 'Difference', col: 42, field: 'difference' },
  { header: 'QTY-Used', col: 43, field: 'qtyUsed' },
  { header: 'Remaining Material', col: 44, field: 'remaining' },
  { header: 'Location (A,B,C)', col: 45, field: 'location' },
  { header: 'MTR (Y/N)', col: 46, field: 'mtrYn' },
  { header: 'Matches IFC (Y/N)', col: 47, field: 'matchesIfc' },
  { header: 'Damaged Materials', col: 48, field: 'damagedMaterials' },
  { header: 'Notes/Remarks', col: 49, field: 'notes' },
];

const LOCATION_LEGEND: ReadonlyArray<readonly [string, string, string, string]> = [
  ['A', 'Location ?', 'E', 'Location ?'],
  ['B', 'Location ?', 'F', 'Location ?'],
  ['C', 'Location ?', 'G', 'Location ?'],
  ['D', 'Location ?', 'H', 'Location ?'],
];

export function differenceFormula(excelRow: number): string {
  return `AP${excelRow}-B${excelRow}`;
}

export function remainingFormula(excelRow: number): string {
  return `AP${excelRow}-AR${excelRow}`;
}

export function orderedQty(row: Pick<TrackerRow, 'qty' | 'qtyOrdered' | 'qtyReceived'>): string {
  if (row.qtyOrdered.trim()) return row.qtyOrdered.trim();
  if (row.qtyReceived.trim()) return '';
  return row.qty.trim();
}

export function receivedQty(row: Pick<TrackerRow, 'qtyReceived'>): string {
  return row.qtyReceived.trim();
}

function numeric(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  return Number(trimmed);
}

export function formatMasterFormula(left: string, right: string): string {
  const a = numeric(left);
  const b = numeric(right);
  if (a === null || b === null) return '—';
  return String(a - b);
}

function cachedDifference(left: string, right: string): number {
  const a = numeric(left);
  const b = numeric(right);
  if (a === null || b === null) return 0;
  return a - b;
}

function fieldText(row: TrackerRow, field: MasterField): string {
  switch (field) {
    case 'item':
      return row.item;
    case 'qtyOrdered':
      return orderedQty(row);
    case 'qtyReceived':
      return receivedQty(row);
    case 'materialType':
      return row.materialType;
    case 'sizeInches':
      return row.sizeInches;
    case 'description':
      return row.description;
    case 'wallSdr':
      return row.wallSdr;
    case 'steelGrade':
      return row.steelGrade;
    case 'manufacturer':
      return row.manufacturer;
    case 'modelNumber':
      return row.modelNumber;
    case 'serialLotHeat':
      return row.serialLotHeat;
    case 'ansiPressureRating':
      return row.ansiPressureRating;
    case 'uom':
      return row.uom;
    case 'qtyUsed':
      return row.qtyUsed;
    case 'location':
      return row.location;
    case 'mtrYn':
      return row.mtrYn;
    case 'matchesIfc':
      return row.matchesIfc;
    case 'damagedMaterials':
      return row.damagedMaterials;
    case 'notes':
      return row.notes;
    case 'difference':
    case 'remaining':
      return '';
    default:
      return '';
  }
}

function writeText(sheet: XLSX.WorkSheet, row: number, col: number, value: string): void {
  const trimmed = value.trim();
  if (!trimmed) return;
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    sheet[addr] = { t: 'n', v: Number(trimmed) };
    return;
  }
  sheet[addr] = { t: 's', v: trimmed };
}

function writeLabel(sheet: XLSX.WorkSheet, row: number, col: number, value: string): void {
  sheet[XLSX.utils.encode_cell({ r: row, c: col })] = { t: 's', v: value };
}

function columnWidths(): XLSX.ColInfo[] {
  const cols: XLSX.ColInfo[] = Array.from({ length: 51 }, () => ({ wch: 8.86 }));
  const spans: Array<[number, number, number]> = [
    [1, 1, 16.71],
    [2, 2, 19],
    [3, 3, 27.57],
    [4, 5, 10.71],
    [6, 19, 3.29],
    [20, 23, 5.71],
    [24, 30, 8.29],
    [31, 37, 5.71],
    [38, 40, 10.71],
    [41, 42, 17.71],
    [43, 43, 14.29],
    [44, 44, 25.29],
    [45, 46, 21.71],
    [47, 48, 25.71],
    [49, 49, 25.29],
    [50, 50, 81],
    [51, 51, 27.71],
  ];
  spans.forEach(([start, end, width]) => {
    for (let col = start; col <= end; col += 1) cols[col - 1] = { wch: width };
  });
  return cols;
}

function masterSheet(tracker: TrackerSheet): XLSX.WorkSheet {
  const sheet: XLSX.WorkSheet = {};
  writeLabel(sheet, 0, 0, 'Project Name:');
  writeText(sheet, 0, 1, tracker.projectName);
  writeLabel(sheet, 1, 0, 'Project #:');
  writeText(sheet, 1, 1, tracker.projectNumber);
  writeLabel(sheet, 2, 0, 'Date:');
  writeText(sheet, 2, 1, tracker.sheetDate);
  writeLabel(sheet, 3, 0, 'Inspector:');
  writeText(sheet, 3, 1, tracker.inspector);
  writeLabel(sheet, 1, 3, 'Material Handling Tracking');

  LOCATION_LEGEND.forEach((entry, index) => {
    writeLabel(sheet, index, 43, entry[0]);
    writeLabel(sheet, index, 44, entry[1]);
    writeLabel(sheet, index, 45, entry[2]);
    writeLabel(sheet, index, 46, entry[3]);
  });

  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 2 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 3 }, e: { r: 3, c: 18 } },
  ];

  MASTER_LIST_LAYOUT.forEach((column) => {
    writeLabel(sheet, MASTER_HEADER_ROW - 1, column.col, column.header);
    if (column.mergeTo !== undefined) {
      merges.push({
        s: { r: MASTER_HEADER_ROW - 1, c: column.col },
        e: { r: MASTER_HEADER_ROW - 1, c: column.mergeTo },
      });
    }
  });

  tracker.rows.forEach((row, index) => {
    const excelRow = MASTER_DATA_ROW + index;
    const sheetRow = excelRow - 1;
    MASTER_LIST_LAYOUT.forEach((column) => {
      if (column.field === 'difference') {
        const ordered = orderedQty(row);
        const received = receivedQty(row);
        sheet[XLSX.utils.encode_cell({ r: sheetRow, c: column.col })] = {
          t: 'n',
          f: differenceFormula(excelRow),
          v: cachedDifference(received, ordered),
        };
        return;
      }
      if (column.field === 'remaining') {
        const received = receivedQty(row);
        sheet[XLSX.utils.encode_cell({ r: sheetRow, c: column.col })] = {
          t: 'n',
          f: remainingFormula(excelRow),
          v: cachedDifference(received, row.qtyUsed),
        };
        return;
      }
      writeText(sheet, sheetRow, column.col, fieldText(row, column.field));
      if (column.mergeTo !== undefined) {
        merges.push({ s: { r: sheetRow, c: column.col }, e: { r: sheetRow, c: column.mergeTo } });
      }
    });
  });

  const lastRow = Math.max(MASTER_HEADER_ROW, MASTER_DATA_ROW - 1 + tracker.rows.length);
  sheet['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: lastRow - 1, c: 49 } });
  sheet['!merges'] = merges;
  sheet['!cols'] = columnWidths();
  sheet['!autofilter'] = { ref: `B5:AX${lastRow}` };
  return sheet;
}

function asBytes(raw: ArrayBuffer | Uint8Array | number[]): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  return new Uint8Array(raw);
}

export function buildMasterListWorkbook(tracker: TrackerSheet): Uint8Array {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(companions.checklist), 'Material Delivery and Inventory');
  XLSX.utils.book_append_sheet(book, masterSheet(tracker), 'Master List');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(companions.aml), 'AML');
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(companions.sheet1), 'Sheet1');
  book.Workbook = {
    Sheets: [{ Hidden: 0 }, { Hidden: 0 }, { Hidden: 1 }, { Hidden: 1 }],
  };
  return asBytes(XLSX.write(book, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer);
}
