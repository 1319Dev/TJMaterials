import { emptyTrackerSheet } from './empty';
import { enqueue } from './sync';
import type { AppSnapshot, TrackerRow, TrackerSheet, VerificationStatus } from './types';

export interface RecordContext {
  now: Date;
  newId: () => string;
}

export type TrackerField =
  | 'item'
  | 'qty'
  | 'qtyOrdered'
  | 'qtyReceived'
  | 'qtyUsed'
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
  | 'location'
  | 'mtrYn'
  | 'matchesIfc'
  | 'damagedMaterials'
  | 'notes';

const FIELD_ALIASES: Record<TrackerField, string[]> = {
  item: ['item', 'item no', 'item number', 'line'],
  qty: ['qty', 'quantity', 'qnty'],
  qtyOrdered: ['qty ordered', 'quantity ordered'],
  qtyReceived: ['qty received', 'quantity received'],
  qtyUsed: ['qty used', 'quantity used'],
  materialType: ['material type'],
  sizeInches: ['size inches', 'size', 'diameter'],
  description: ['material description', 'description', 'desc'],
  wallSdr: ['wall sdr', 'wall thickness', 'wall', 'sdr'],
  steelGrade: ['steel grade', 'grade'],
  manufacturer: ['manufacturer', 'mfr', 'mfg'],
  modelNumber: ['model number', 'model no', 'model'],
  serialLotHeat: ['serial lot heat', 'serial lot heat no', 'heat number', 'heat no', 'heat', 'serial', 'lot'],
  ansiPressureRating: ['ansi pressure rating', 'pressure rating', 'ansi rating', 'ansi', 'class'],
  uom: ['uom each ft', 'uom', 'unit'],
  location: ['location a b c', 'location'],
  mtrYn: ['mtr y n', 'mtr'],
  matchesIfc: ['matches ifc y n', 'matches ifc'],
  damagedMaterials: ['damaged materials', 'damaged'],
  notes: ['notes remarks', 'notes'],
};

const META_ALIASES = {
  constructionOrderNo: ['construction order no', 'construction order number'],
  projectNumber: ['project number', 'project no'],
} as const;

export interface ParsedTrackerRow {
  item: string;
  qty: string;
  qtyOrdered: string;
  qtyReceived: string;
  qtyUsed: string;
  materialType: string;
  sizeInches: string;
  description: string;
  wallSdr: string;
  steelGrade: string;
  manufacturer: string;
  modelNumber: string;
  serialLotHeat: string;
  ansiPressureRating: string;
  uom: string;
  location: string;
  mtrYn: string;
  matchesIfc: string;
  damagedMaterials: string;
  notes: string;
}

export function blankParsedTrackerRow(): ParsedTrackerRow {
  return {
    item: '',
    qty: '',
    qtyOrdered: '',
    qtyReceived: '',
    qtyUsed: '',
    materialType: '',
    sizeInches: '',
    description: '',
    wallSdr: '',
    steelGrade: '',
    manufacturer: '',
    modelNumber: '',
    serialLotHeat: '',
    ansiPressureRating: '',
    uom: '',
    location: '',
    mtrYn: '',
    matchesIfc: '',
    damagedMaterials: '',
    notes: '',
  };
}

export interface ParsedTracker {
  constructionOrderNo: string;
  projectNumber: string;
  projectName: string;
  sheetDate: string;
  inspector: string;
  rows: ParsedTrackerRow[];
  errors: string[];
}

export interface OcrProposal {
  key: string;
  item: string;
  qty: string;
  sizeInches: string;
  description: string;
  wallSdr: string;
  steelGrade: string;
  manufacturer: string;
  modelNumber: string;
  serialLotHeat: string;
  ansiPressureRating: string;
  materialType?: string;
  uom?: string;
  qtyOrdered?: string;
  qtyReceived?: string;
  qtyUsed?: string;
  location?: string;
  mtrYn?: string;
  matchesIfc?: string;
  damagedMaterials?: string;
  notes?: string;
  confidence: number;
  uncertain: boolean;
  rawText: string;
}

const EXPECTED_COLUMNS =
  'Item, QTY-Ordered, Material Type, Size (Inches), Material Description, Wall / SDR, Grade, Manufacturer, Model Number, Serial / Lot / Heat #, ANSI / Pressure Rating, UOM (Each/Ft), QTY-Received, Difference, QTY-Used, Remaining Material, Location (A,B,C), MTR (Y/N), Matches IFC (Y/N), Damaged Materials, Notes/Remarks';

export function normLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\],]/g, ' ')
    .replace(/[#.]/g, '')
    .replace(/[_/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

export function normalizeMatrix(rows: readonly (readonly unknown[])[]): string[][] {
  return rows.map((row) => (Array.isArray(row) ? row.map((cell) => cellText(cell)) : []));
}

function matchAlias(label: string, aliases: readonly string[]): number {
  const norm = normLabel(label);
  if (!norm) return 0;
  let score = 0;
  for (const alias of aliases) {
    if (norm === alias) score = Math.max(score, alias.length);
  }
  return score;
}

function matchField(label: string): { field: TrackerField; score: number } | null {
  let best: { field: TrackerField; score: number } | null = null;
  for (const field of Object.keys(FIELD_ALIASES) as TrackerField[]) {
    const score = matchAlias(label, FIELD_ALIASES[field]);
    if (score > 0 && (!best || score > best.score)) best = { field, score };
  }
  return best;
}

function inlineValue(cell: string, label: RegExp): string | null {
  const match = cell.match(label);
  if (!match) return null;
  const rest = cell.slice(match[0].length).replace(/^[:\s#.-]+/, '').trim();
  return rest;
}

const CO_LABEL = /^construction order\s+(?:no|number)\b/i;
const PN_LABEL = /^project\s+(?:number|no)\b/i;
const NAME_LABEL = /^project\s+name\b/i;
const PROJECT_HASH = /^project\s*#/i;
const DATE_LABEL = /^date\b/i;
const INSPECTOR_LABEL = /^inspector\b/i;

interface SheetMeta {
  constructionOrderNo: string;
  projectNumber: string;
  projectName: string;
  sheetDate: string;
  inspector: string;
}

function takeLabel(cell: string, row: string[], index: number, label: RegExp): string | null {
  if (!label.test(cell)) return null;
  const inline = inlineValue(cell, label);
  if (inline) return inline;
  const next = row[index + 1]?.trim() ?? '';
  if (!next) return '';
  if (
    CO_LABEL.test(next) ||
    PN_LABEL.test(next) ||
    NAME_LABEL.test(next) ||
    PROJECT_HASH.test(next) ||
    DATE_LABEL.test(next) ||
    INSPECTOR_LABEL.test(next)
  ) {
    return '';
  }
  return next;
}

function readMeta(matrix: string[][]): SheetMeta {
  const meta: SheetMeta = {
    constructionOrderNo: '',
    projectNumber: '',
    projectName: '',
    sheetDate: '',
    inspector: '',
  };
  for (const row of matrix) {
    for (let index = 0; index < row.length; index += 1) {
      const cell = row[index] ?? '';
      if (!meta.constructionOrderNo) {
        const value = takeLabel(cell, row, index, CO_LABEL);
        if (value !== null) meta.constructionOrderNo = value;
      }
      if (!meta.projectNumber) {
        const value = takeLabel(cell, row, index, PN_LABEL) ?? takeLabel(cell, row, index, PROJECT_HASH);
        if (value !== null) meta.projectNumber = value;
      }
      if (!meta.projectName) {
        const value = takeLabel(cell, row, index, NAME_LABEL);
        if (value !== null) meta.projectName = value;
      }
      if (!meta.sheetDate) {
        const value = takeLabel(cell, row, index, DATE_LABEL);
        if (value !== null) meta.sheetDate = value;
      }
      if (!meta.inspector) {
        const value = takeLabel(cell, row, index, INSPECTOR_LABEL);
        if (value !== null) meta.inspector = value;
      }
    }
  }
  return meta;
}

interface MappedColumn {
  index: number;
  field: TrackerField;
  score: number;
}

function headerMap(row: string[]): MappedColumn[] {
  const mapped: MappedColumn[] = [];
  row.forEach((cell, index) => {
    const match = matchField(cell);
    if (!match) return;
    mapped.push({ index, field: match.field, score: match.score });
  });
  return mapped;
}

function isHeaderRow(row: string[]): boolean {
  const fields = new Set(headerMap(row).map((column) => column.field));
  return fields.size >= 4 && (fields.has('description') || fields.has('item'));
}

function fieldValue(columns: MappedColumn[], cells: string[], field: TrackerField, join: boolean): string {
  const hits = columns.filter((column) => column.field === field).sort((a, b) => b.score - a.score);
  const values = hits
    .map((column) => cells[column.index]?.trim() ?? '')
    .filter((value) => value.length > 0);
  if (values.length === 0) return '';
  if (!join) return values[0];
  return [...new Set(values)].join(' / ');
}

function rowHasMaterial(row: ParsedTrackerRow): boolean {
  return [
    row.description,
    row.materialType,
    row.qty,
    row.qtyOrdered,
    row.qtyReceived,
    row.sizeInches,
    row.wallSdr,
    row.steelGrade,
    row.modelNumber,
    row.serialLotHeat,
    row.ansiPressureRating,
    row.uom,
    row.qtyUsed,
    row.location,
    row.notes,
    row.mtrYn,
    row.matchesIfc,
    row.damagedMaterials,
  ].some((value) => value.trim().length > 0);
}

function rowFromCells(columns: MappedColumn[], cells: string[]): ParsedTrackerRow | null {
  const row = blankParsedTrackerRow();
  (Object.keys(FIELD_ALIASES) as TrackerField[]).forEach((field) => {
    row[field] = fieldValue(columns, cells, field, field === 'serialLotHeat');
  });
  if (!row.qtyOrdered && row.qty) row.qtyOrdered = row.qty;
  if (normLabel(row.item) === 'item' || normLabel(row.description) === 'description' || normLabel(row.description) === 'material description') {
    return null;
  }
  if (!rowHasMaterial(row)) return null;
  return row;
}

function metaFromColumns(row: string[], dataRows: string[][]): { constructionOrderNo: string; projectNumber: string } {
  let constructionOrderNo = '';
  let projectNumber = '';
  row.forEach((cell, index) => {
    if (!constructionOrderNo && matchAlias(cell, META_ALIASES.constructionOrderNo) > 0) {
      constructionOrderNo = dataRows.map((data) => data[index]?.trim() ?? '').find((value) => value.length > 0) ?? '';
    }
    if (!projectNumber && matchAlias(cell, META_ALIASES.projectNumber) > 0) {
      projectNumber = dataRows.map((data) => data[index]?.trim() ?? '').find((value) => value.length > 0) ?? '';
    }
  });
  return { constructionOrderNo, projectNumber };
}

function emptyParse(errors: string[]): ParsedTracker {
  return {
    constructionOrderNo: '',
    projectNumber: '',
    projectName: '',
    sheetDate: '',
    inspector: '',
    rows: [],
    errors,
  };
}

export function parseTrackerMatrix(input: readonly (readonly unknown[])[]): ParsedTracker {
  const matrix = normalizeMatrix(input).filter((row) => row.some((cell) => cell.length > 0));
  const headerIndex = matrix.findIndex((row) => isHeaderRow(row));
  if (headerIndex < 0) {
    return emptyParse([`Could not find Master List columns. Expected ${EXPECTED_COLUMNS}. Nothing was imported.`]);
  }
  const columns = headerMap(matrix[headerIndex]);
  const dataRows = matrix.slice(headerIndex + 1);
  const rows = dataRows
    .map((cells) => rowFromCells(columns, cells))
    .filter((row): row is ParsedTrackerRow => row !== null);
  if (rows.length === 0) {
    return emptyParse(['The sheet has column headers and no material rows. Nothing was imported.']);
  }
  const scanned = readMeta(matrix);
  const fromColumns = metaFromColumns(matrix[headerIndex], dataRows);
  return {
    constructionOrderNo: scanned.constructionOrderNo || fromColumns.constructionOrderNo,
    projectNumber: scanned.projectNumber || fromColumns.projectNumber,
    projectName: scanned.projectName,
    sheetDate: scanned.sheetDate,
    inspector: scanned.inspector,
    rows,
    errors: [],
  };
}

function blankReview(status: VerificationStatus): VerificationStatus {
  return status === 'match' ? 'review_required' : status;
}

function audit(
  snapshot: AppSnapshot,
  ctx: RecordContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
  verificationStatus: VerificationStatus,
): AppSnapshot {
  const createdAt = ctx.now.toISOString();
  const withLog: AppSnapshot = {
    ...snapshot,
    auditLogs: [
      ...snapshot.auditLogs,
      {
        id: ctx.newId(),
        projectId: snapshot.project.id,
        action,
        entityType,
        entityId,
        summary,
        verificationStatus,
        createdAt,
      },
    ],
  };
  return {
    ...withLog,
    queue: enqueue(withLog.queue, {
      id: ctx.newId(),
      entityType,
      entityId,
      op: 'upsert',
      createdAt,
    }),
  };
}

function toTrackerRow(
  parsed: ParsedTrackerRow,
  extra: {
    id: string;
    source: TrackerRow['source'];
    verificationStatus: VerificationStatus;
    confidence: number | null;
    uncertain: boolean;
    reviewNote: string;
    deliveryId: string | null;
    documentId: string | null;
    uomFallback?: string;
    receivedFromQty?: boolean;
  },
): TrackerRow {
  const qty = parsed.qty.trim();
  const qtyOrdered = (parsed.qtyOrdered || qty).trim();
  const qtyReceived = (parsed.qtyReceived || (extra.receivedFromQty ? qty : '')).trim();
  return {
    id: extra.id,
    item: parsed.item.trim(),
    qty: qty || qtyOrdered || qtyReceived,
    qtyOrdered,
    qtyReceived,
    qtyUsed: parsed.qtyUsed.trim(),
    materialType: parsed.materialType.trim(),
    sizeInches: parsed.sizeInches.trim(),
    description: parsed.description.trim(),
    wallSdr: parsed.wallSdr.trim(),
    steelGrade: parsed.steelGrade.trim(),
    manufacturer: parsed.manufacturer.trim(),
    modelNumber: parsed.modelNumber.trim(),
    serialLotHeat: parsed.serialLotHeat.trim(),
    ansiPressureRating: parsed.ansiPressureRating.trim(),
    uom: parsed.uom.trim() || extra.uomFallback || '',
    location: parsed.location.trim(),
    mtrYn: parsed.mtrYn.trim(),
    matchesIfc: parsed.matchesIfc.trim(),
    damagedMaterials: parsed.damagedMaterials.trim(),
    notes: parsed.notes.trim(),
    source: extra.source,
    verificationStatus: extra.verificationStatus,
    confidence: extra.confidence,
    uncertain: extra.uncertain,
    reviewNote: extra.reviewNote,
    deliveryId: extra.deliveryId,
    documentId: extra.documentId,
  };
}

export function importTrackerSheet(
  snapshot: AppSnapshot,
  parsed: ParsedTracker,
  meta: { fileName: string },
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[]; rowCount: number } {
  if (parsed.errors.length > 0) return { snapshot, errors: parsed.errors, rowCount: 0 };
  const importedAt = ctx.now.toISOString();
  const rows: TrackerRow[] = parsed.rows.map((row) =>
    toTrackerRow(row, {
      id: ctx.newId(),
      source: 'import',
      verificationStatus: blankReview('not_verified'),
      confidence: null,
      uncertain: false,
      reviewNote: 'Loaded from the tracking sheet. This is not an acceptance.',
      deliveryId: null,
      documentId: null,
    }),
  );
  const tracker: TrackerSheet = {
    constructionOrderNo: parsed.constructionOrderNo,
    projectNumber: parsed.projectNumber,
    projectName: parsed.projectName,
    sheetDate: parsed.sheetDate,
    inspector: parsed.inspector,
    sourceFileName: meta.fileName.trim(),
    importedAt,
    rows,
  };
  const next = audit(
    { ...snapshot, tracker },
    ctx,
    'tracker_import',
    'tracker',
    snapshot.project.id,
    `Tracking sheet ${tracker.sourceFileName || 'upload'} saved locally. Material was not accepted.`,
    'not_verified',
  );
  return { snapshot: next, errors: [], rowCount: rows.length };
}

export function proposalIsUncertain(proposal: OcrProposal): boolean {
  const blob = [
    proposal.item,
    proposal.qty,
    proposal.sizeInches,
    proposal.description,
    proposal.wallSdr,
    proposal.steelGrade,
    proposal.manufacturer,
    proposal.modelNumber,
    proposal.serialLotHeat,
    proposal.ansiPressureRating,
    proposal.rawText,
  ].join(' ');
  if (/\?{2,}|illegible|unreadable|\[unclear\]/i.test(blob)) return true;
  if (/^\?+$/.test(proposal.qty.trim())) return true;
  if (!proposal.description.trim() || !proposal.qty.trim()) return true;
  if (proposal.uncertain) return true;
  if (proposal.confidence < 0.7) return true;
  return false;
}

export function applyTrackerProposals(
  snapshot: AppSnapshot,
  proposals: readonly OcrProposal[],
  options: {
    documentId: string | null;
    deliveryId: string | null;
    constructionOrderNo?: string;
    projectNumber?: string;
  },
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[]; applied: number } {
  if (proposals.length === 0) {
    return { snapshot, errors: ['Select at least one row. Nothing was written.'], applied: 0 };
  }
  const tracker = snapshot.tracker?.rows ? snapshot.tracker : emptyTrackerSheet();
  const rows: TrackerRow[] = proposals.map((proposal) => {
    const uncertain = proposalIsUncertain(proposal);
    const parsed = blankParsedTrackerRow();
    parsed.item = proposal.item;
    parsed.qty = proposal.qty;
    parsed.qtyOrdered = proposal.qtyOrdered ?? '';
    parsed.qtyReceived = proposal.qtyReceived ?? '';
    parsed.qtyUsed = proposal.qtyUsed ?? '';
    parsed.materialType = proposal.materialType ?? '';
    parsed.sizeInches = proposal.sizeInches;
    parsed.description = proposal.description;
    parsed.wallSdr = proposal.wallSdr;
    parsed.steelGrade = proposal.steelGrade;
    parsed.manufacturer = proposal.manufacturer;
    parsed.modelNumber = proposal.modelNumber;
    parsed.serialLotHeat = proposal.serialLotHeat;
    parsed.ansiPressureRating = proposal.ansiPressureRating;
    parsed.uom = proposal.uom ?? '';
    parsed.location = proposal.location ?? '';
    parsed.mtrYn = proposal.mtrYn ?? '';
    parsed.matchesIfc = proposal.matchesIfc ?? '';
    parsed.damagedMaterials = proposal.damagedMaterials ?? '';
    parsed.notes = proposal.notes ?? '';
    return toTrackerRow(parsed, {
      id: ctx.newId(),
      source: 'ocr',
      verificationStatus: 'review_required',
      confidence: proposal.confidence,
      uncertain,
      reviewNote: uncertain
        ? 'OCR uncertain. REVIEW REQUIRED. Material was not accepted.'
        : 'Read from a packing slip on this device. REVIEW REQUIRED. Material was not accepted.',
      deliveryId: options.deliveryId,
      documentId: options.documentId,
      uomFallback: 'Each',
      receivedFromQty: true,
    });
  });
  const constructionOrderNo = tracker.constructionOrderNo || options.constructionOrderNo?.trim() || '';
  const projectNumber = tracker.projectNumber || options.projectNumber?.trim() || '';
  const nextTracker: TrackerSheet = {
    ...tracker,
    constructionOrderNo,
    projectNumber,
    rows: [...tracker.rows, ...rows],
  };
  const next = audit(
    { ...snapshot, tracker: nextTracker, materials: snapshot.materials },
    ctx,
    'tracker_ocr',
    'tracker',
    options.documentId ?? snapshot.project.id,
    `Packing slip OCR added ${rows.length} tracker row${rows.length === 1 ? '' : 's'}. REVIEW REQUIRED. Material was not accepted.`,
    'review_required',
  );
  return { snapshot: next, errors: [], applied: rows.length };
}

export function nextItemNumber(rows: readonly { item: string }[]): number {
  let max = 0;
  for (const row of rows) {
    const item = row.item.trim();
    if (!/^\d+$/.test(item)) continue;
    const value = Number(item);
    if (value > max) max = value;
  }
  return max + 1;
}

export interface ReceiptMasterLine {
  materialType: string;
  description: string;
  sizeInches: string;
  wallSdr: string;
  steelGrade: string;
  manufacturer: string;
  modelNumber: string;
  serialLotHeat: string;
  ansiPressureRating: string;
  uom: string;
  quantity: string;
  notes: string;
}

export function appendReceiptToMasterList(
  snapshot: AppSnapshot,
  input: {
    deliveryId: string;
    receivedOn: string;
    inspectorName: string;
    notes: string;
    lines: readonly ReceiptMasterLine[];
  },
  ctx: RecordContext,
): { tracker: TrackerSheet; items: string[] } {
  const tracker = snapshot.tracker?.rows ? snapshot.tracker : emptyTrackerSheet();
  let itemNo = nextItemNumber(tracker.rows);
  const items: string[] = [];
  const rows: TrackerRow[] = input.lines.map((line) => {
    const item = String(itemNo);
    itemNo += 1;
    items.push(item);
    const qty = line.quantity.trim();
    return {
      id: ctx.newId(),
      item,
      qty,
      qtyOrdered: qty,
      qtyReceived: qty,
      qtyUsed: '',
      materialType: line.materialType.trim(),
      sizeInches: line.sizeInches.trim(),
      description: line.description.trim(),
      wallSdr: line.wallSdr.trim(),
      steelGrade: line.steelGrade.trim(),
      manufacturer: line.manufacturer.trim(),
      modelNumber: line.modelNumber.trim(),
      serialLotHeat: line.serialLotHeat.trim(),
      ansiPressureRating: line.ansiPressureRating.trim(),
      uom: line.uom.trim() || 'Each',
      location: '',
      mtrYn: '',
      matchesIfc: '',
      damagedMaterials: '',
      notes: (line.notes || input.notes).trim(),
      source: 'manual',
      verificationStatus: 'review_required',
      confidence: null,
      uncertain: false,
      reviewNote: 'Logged from receive. REVIEW REQUIRED. Material was not accepted.',
      deliveryId: input.deliveryId,
      documentId: null,
    };
  });
  return {
    items,
    tracker: {
      ...tracker,
      projectName: tracker.projectName || snapshot.project.name,
      projectNumber: tracker.projectNumber || snapshot.project.projectNumber,
      constructionOrderNo: tracker.constructionOrderNo || snapshot.project.constructionOrderNo,
      sheetDate: tracker.sheetDate || input.receivedOn,
      inspector: tracker.inspector || input.inspectorName.trim() || snapshot.project.inspectorName,
      rows: [...tracker.rows, ...rows],
    },
  };
}

export type TrackerEditField =
  | 'item'
  | 'qtyOrdered'
  | 'qtyReceived'
  | 'qtyUsed'
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
  | 'location'
  | 'mtrYn'
  | 'matchesIfc'
  | 'damagedMaterials'
  | 'notes';

export function updateTrackerHeader(
  snapshot: AppSnapshot,
  patch: Partial<Pick<TrackerSheet, 'projectName' | 'projectNumber' | 'sheetDate' | 'inspector' | 'constructionOrderNo'>>,
): AppSnapshot {
  const next = { ...snapshot.tracker };
  (Object.keys(patch) as Array<keyof typeof patch>).forEach((key) => {
    const value = patch[key];
    if (value === undefined) return;
    next[key] = value.trim();
  });
  return { ...snapshot, tracker: next };
}

export function updateTrackerCell(snapshot: AppSnapshot, rowId: string, field: TrackerEditField, value: string): AppSnapshot {
  const rows = snapshot.tracker.rows.map((row) => {
    if (row.id !== rowId) return row;
    const next: TrackerRow = { ...row, [field]: value };
    if (field === 'qtyOrdered' || field === 'qtyReceived') {
      next.qty = next.qtyReceived.trim() || next.qtyOrdered.trim();
    }
    return next;
  });
  return { ...snapshot, tracker: { ...snapshot.tracker, rows } };
}
