import type { MaterialCategory } from './types';

const CATEGORY_PREFIX: Record<MaterialCategory, string> = {
  pipe: 'PIPE',
  fitting: 'FIT',
  flange: 'FLG',
  valve: 'VLV',
  other: 'MAT',
};

export function materialPrefix(category: MaterialCategory): string {
  return `PMI-${CATEGORY_PREFIX[category]}-`;
}

export function nextMaterialCode(category: MaterialCategory, existingCodes: readonly string[]): string {
  const prefix = materialPrefix(category);
  let max = 0;
  for (const code of existingCodes) {
    if (!code.startsWith(prefix)) continue;
    const parsed = Number(code.slice(prefix.length));
    if (Number.isInteger(parsed) && parsed > max) max = parsed;
  }
  return `${prefix}${String(max + 1).padStart(6, '0')}`;
}

export function isMaterialCode(value: string): boolean {
  return /^PMI-[A-Z]+-\d{6}$/.test(value);
}
