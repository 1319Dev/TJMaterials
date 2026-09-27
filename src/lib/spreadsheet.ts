import * as XLSX from 'xlsx';

export function workbookToMatrix(data: ArrayBuffer | Uint8Array | string): string[][] {
  const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: false });
  const name = workbook.SheetNames[0];
  if (!name) return [];
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
    blankrows: false,
  });
  return rows.map((row) => (Array.isArray(row) ? row : []).map((cell) => (cell == null ? '' : String(cell).trim())));
}
