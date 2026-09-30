import * as XLSX from 'xlsx';

function masterSheetName(names: readonly string[]): string {
  return names.find((name) => name.trim().toLowerCase() === 'master list') ?? names[0] ?? '';
}

export function workbookToMatrix(data: ArrayBuffer | Uint8Array | string): string[][] {
  const workbook = XLSX.read(data, { type: typeof data === 'string' ? 'string' : 'array', cellDates: false });
  const name = masterSheetName(workbook.SheetNames);
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
