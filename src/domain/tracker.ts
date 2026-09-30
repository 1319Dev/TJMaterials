import { enqueue } from './sync';
import type { AppSnapshot, TrackerRow, TrackerSheet, VerificationStatus } from './types';

export interface RecordContext {
  now: Date;
  newId: () => string;
}

export type TrackerField =
  | 'item'
  | 'qty'
  | 'sizeInches'
  | 'description'
  | 'wallSdr'
  | 'steelGrade'
  | 'manufacturer'
  | 'modelNumber'
  | 'serialLotHeat'
  | 'ansiPressureRating';

const FIELD_ALIASES: Record<TrackerField, string[]> = {
  item: ['item', 'item no', 'item number', 'line'],
  qty: ['qty', 'quantity', 'qnty'],
  sizeInches: ['size inches', 'size', 'diameter'],
  description: ['description', 'material description', 'desc'],
  wallSdr: ['wall sdr', 'wall thickness', 'wall', 'sdr'],
  steelGrade: ['steel grade', 'grade'],
  manufacturer: ['manufacturer', 'mfr', 'mfg'],
  modelNumber: ['model number', 'model no', 'model'],
  serialLotHeat: ['serial lot heat', 'serial lot heat no', 'heat number', 'heat no', 'heat', 'serial', 'lot'],
  ansiPressureRating: ['ansi pressure rating', 'pressure rating', 'ansi rating', 'ansi', 'class'],
};

const META_ALIASES = {
  constructionOrderNo: ['construction order no', 'construction order number'],
  projectNumber: ['project number', 'project no'],
} as const;

export interface ParsedTrackerRow {
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
}

export interface ParsedTracker {
  constructionOrderNo: string;
  projectNumber: string;
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
  confidence: number;
  uncertain: boolean;
  rawText: string;
}

const EXPECTED_COLUMNS =
  'Item, QTY, Size (Inches), Description, Wall/SDR, Steel Grade, Manufacturer, Model Number, Serial/Lot/Heat #, ANSI/Pressure Rating';

export function normLabel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[()[\]]/g, ' ')
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

function readMeta(matrix: string[][]): { constructionOrderNo: string; projectNumber: string } {
  let constructionOrderNo = '';
  let projectNumber = '';
  for (const row of matrix) {
    for (let index = 0; index < row.length; index += 1) {
      const cell = row[index] ?? '';
      if (!constructionOrderNo) {
        const inline = inlineValue(cell, CO_LABEL);
        if (inline) constructionOrderNo = inline;
        else if (CO_LABEL.test(cell)) {
          const next = row[index + 1]?.trim() ?? '';
          if (next && !CO_LABEL.test(next) && !PN_LABEL.test(next)) constructionOrderNo = next;
        }
      }
      if (!projectNumber) {
        const inline = inlineValue(cell, PN_LABEL);
        if (inline) projectNumber = inline;
        else if (PN_LABEL.test(cell)) {
          const next = row[index + 1]?.trim() ?? '';
          if (next && !CO_LABEL.test(next) && !PN_LABEL.test(next)) projectNumber = next;
        }
      }
    }
  }
  return { constructionOrderNo, projectNumber };
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

function rowFromCells(columns: MappedColumn[], cells: string[]): ParsedTrackerRow | null {
  const row: ParsedTrackerRow = {
    item: fieldValue(columns, cells, 'item', false),
    qty: fieldValue(columns, cells, 'qty', false),
    sizeInches: fieldValue(columns, cells, 'sizeInches', false),
    description: fieldValue(columns, cells, 'description', false),
    wallSdr: fieldValue(columns, cells, 'wallSdr', false),
    steelGrade: fieldValue(columns, cells, 'steelGrade', false),
    manufacturer: fieldValue(columns, cells, 'manufacturer', false),
    modelNumber: fieldValue(columns, cells, 'modelNumber', false),
    serialLotHeat: fieldValue(columns, cells, 'serialLotHeat', true),
    ansiPressureRating: fieldValue(columns, cells, 'ansiPressureRating', false),
  };
  if (normLabel(row.item) === 'item' || normLabel(row.description) === 'description') return null;
  if (!row.item && !row.qty && !row.description) return null;
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

export function parseTrackerMatrix(input: readonly (readonly unknown[])[]): ParsedTracker {
  const matrix = normalizeMatrix(input).filter((row) => row.some((cell) => cell.length > 0));
  const headerIndex = matrix.findIndex((row) => isHeaderRow(row));
  if (headerIndex < 0) {
    return {
      constructionOrderNo: '',
      projectNumber: '',
      rows: [],
      errors: [`Could not find tracker columns. Expected ${EXPECTED_COLUMNS}. Nothing was imported.`],
    };
  }
  const columns = headerMap(matrix[headerIndex]);
  const dataRows = matrix.slice(headerIndex + 1);
  const rows = dataRows
    .map((cells) => rowFromCells(columns, cells))
    .filter((row): row is ParsedTrackerRow => row !== null);
  if (rows.length === 0) {
    return {
      constructionOrderNo: '',
      projectNumber: '',
      rows: [],
      errors: ['The sheet has column headers and no material rows. Nothing was imported.'],
    };
  }
  const scanned = readMeta(matrix);
  const fromColumns = metaFromColumns(matrix[headerIndex], dataRows);
  return {
    constructionOrderNo: scanned.constructionOrderNo || fromColumns.constructionOrderNo,
    projectNumber: scanned.projectNumber || fromColumns.projectNumber,
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

export function importTrackerSheet(
  snapshot: AppSnapshot,
  parsed: ParsedTracker,
  meta: { fileName: string },
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[]; rowCount: number } {
  if (parsed.errors.length > 0) return { snapshot, errors: parsed.errors, rowCount: 0 };
  const importedAt = ctx.now.toISOString();
  const rows: TrackerRow[] = parsed.rows.map((row) => ({
    id: ctx.newId(),
    ...row,
    source: 'import',
    verificationStatus: blankReview('not_verified'),
    confidence: null,
    uncertain: false,
    reviewNote: 'Loaded from the tracking sheet. This is not an acceptance.',
    deliveryId: null,
    documentId: null,
  }));
  const tracker: TrackerSheet = {
    constructionOrderNo: parsed.constructionOrderNo,
    projectNumber: parsed.projectNumber,
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
  const tracker = snapshot.tracker?.rows ? snapshot.tracker : {
    constructionOrderNo: '',
    projectNumber: '',
    sourceFileName: '',
    importedAt: null,
    rows: [],
  };
  const rows: TrackerRow[] = proposals.map((proposal) => {
    const uncertain = proposalIsUncertain(proposal);
    return {
      id: ctx.newId(),
      item: proposal.item.trim(),
      qty: proposal.qty.trim(),
      sizeInches: proposal.sizeInches.trim(),
      description: proposal.description.trim(),
      wallSdr: proposal.wallSdr.trim(),
      steelGrade: proposal.steelGrade.trim(),
      manufacturer: proposal.manufacturer.trim(),
      modelNumber: proposal.modelNumber.trim(),
      serialLotHeat: proposal.serialLotHeat.trim(),
      ansiPressureRating: proposal.ansiPressureRating.trim(),
      source: 'ocr',
      verificationStatus: 'review_required',
      confidence: proposal.confidence,
      uncertain,
      reviewNote: uncertain
        ? 'OCR uncertain. REVIEW REQUIRED. Material was not accepted.'
        : 'Read from a packing slip on this device. REVIEW REQUIRED. Material was not accepted.',
      deliveryId: options.deliveryId,
      documentId: options.documentId,
    };
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
