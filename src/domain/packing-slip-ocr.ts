import { normLabel, type OcrProposal, type ParsedTrackerRow } from './tracker';

export interface OcrTextLine {
  text: string;
  confidence: number;
}

export interface PackingSlipParse {
  constructionOrderNo: string;
  projectNumber: string;
  packingSlipNumber: string;
  text: string;
  proposals: OcrProposal[];
}

const CO_RE = /construction order\s+(?:no|number)\.?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9./-]*)/i;
const PN_RE = /project\s+(?:number|no)\.?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9./-]*)/i;
const PS_RE = /packing\s+slip(?:\s*(?:#|number|no\.?))?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9./-]*)/i;

const FIELD_ALIASES: Record<keyof ParsedTrackerRow, string[]> = {
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

function splitCells(line: string): string[] {
  if (line.includes('\t')) return line.split('\t').map((cell) => cell.trim());
  if (line.includes('|')) {
    return line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, index, all) => cell.length > 0 || (index > 0 && index < all.length - 1));
  }
  return line
    .split(/\s{2,}/)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);
}

function matchField(label: string): keyof ParsedTrackerRow | null {
  const norm = normLabel(label);
  let best: { field: keyof ParsedTrackerRow; score: number } | null = null;
  for (const field of Object.keys(FIELD_ALIASES) as (keyof ParsedTrackerRow)[]) {
    for (const alias of FIELD_ALIASES[field]) {
      if (norm === alias && (!best || alias.length > best.score)) best = { field, score: alias.length };
    }
  }
  return best?.field ?? null;
}

function grab(text: string, pattern: RegExp): string {
  return text.match(pattern)?.[1]?.trim() ?? '';
}

function lineConfidence(line: string, lines: readonly OcrTextLine[] | undefined): number | null {
  if (!lines || lines.length === 0) return null;
  const norm = line.trim();
  const hit = lines.find((entry) => entry.text.trim() === norm);
  return hit ? hit.confidence : null;
}

function looksMarked(value: string): boolean {
  return /\?{2,}|illegible|unreadable|\[unclear\]/i.test(value) || /^\?+$/.test(value.trim());
}

function blankRow(): ParsedTrackerRow {
  return {
    item: '',
    qty: '',
    sizeInches: '',
    description: '',
    wallSdr: '',
    steelGrade: '',
    manufacturer: '',
    modelNumber: '',
    serialLotHeat: '',
    ansiPressureRating: '',
  };
}

function fromLoose(line: string): ParsedTrackerRow | null {
  const match = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
  if (!match) return null;
  const row = blankRow();
  row.item = match[1];
  row.qty = match[2];
  row.sizeInches = match[3];
  row.description = match[4].trim();
  return row;
}

export function parsePackingSlipText(text: string, lines?: readonly OcrTextLine[]): PackingSlipParse {
  const source = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rawLines = source.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  let headerIndex = -1;
  let headerFields: Array<keyof ParsedTrackerRow | null> = [];
  rawLines.forEach((line, index) => {
    if (headerIndex >= 0) return;
    const cells = splitCells(line);
    const fields = cells.map((cell) => matchField(cell));
    const named = fields.filter((field): field is keyof ParsedTrackerRow => field !== null);
    const unique = new Set(named);
    if (unique.size >= 3 && (unique.has('description') || unique.has('item'))) {
      headerIndex = index;
      const used = new Set<keyof ParsedTrackerRow>();
      headerFields = fields.map((field) => {
        if (!field || used.has(field)) return null;
        used.add(field);
        return field;
      });
    }
  });

  const proposals: OcrProposal[] = [];
  const body = headerIndex >= 0 ? rawLines.slice(headerIndex + 1) : rawLines;
  body.forEach((line) => {
    if (CO_RE.test(line) || PN_RE.test(line) || PS_RE.test(line)) return;
    const cells = splitCells(line);
    const row = blankRow();
    let loose = headerIndex < 0;
    if (headerIndex >= 0 && cells.length > 0) {
      headerFields.forEach((field, index) => {
        if (!field) return;
        const value = cells[index]?.trim() ?? '';
        if (!value) return;
        row[field] = row[field] ? `${row[field]} / ${value}` : value;
      });
      if (!row.item && !row.qty && !row.description) {
        const fallback = fromLoose(line);
        if (!fallback) return;
        Object.assign(row, fallback);
        loose = true;
      }
    } else {
      const fallback = fromLoose(line);
      if (!fallback) return;
      Object.assign(row, fallback);
      loose = true;
    }
    if (normLabel(row.item) === 'item') return;
    const scored = lineConfidence(line, lines);
    const marked = looksMarked(line) || Object.values(row).some((value) => looksMarked(value));
    const qtyOk = /^\d+(?:\.\d+)?$/.test(row.qty.trim());
    const descOk = row.description.trim().length > 1 && !/^\?+$/.test(row.description.trim());
    let confidence = scored ?? (qtyOk && descOk && !loose ? 0.86 : 0.48);
    if (marked) confidence = Math.min(confidence, 0.4);
    if (!qtyOk) confidence = Math.min(confidence, 0.45);
    if (!descOk) confidence = Math.min(confidence, 0.35);
    if (loose) confidence = Math.min(confidence, 0.55);
    const uncertain = marked || loose || !qtyOk || !descOk || confidence < 0.7;
    proposals.push({
      key: `line-${proposals.length + 1}`,
      ...row,
      confidence,
      uncertain,
      rawText: line,
    });
  });

  return {
    constructionOrderNo: grab(source, CO_RE),
    projectNumber: grab(source, PN_RE),
    packingSlipNumber: grab(source, PS_RE),
    text: source.trim(),
    proposals,
  };
}
