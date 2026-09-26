export const GRADE_MISMATCH_MESSAGE =
  'GRADE DOES NOT MATCH EXPECTED MATERIAL — ENGINEERING/OPERATOR REVIEW REQUIRED';

/** ASTM A860 high-strength butt-welding fitting grades (WPHY). */
export const A860_WPHY_GRADES = ['WPHY 42', 'WPHY 46', 'WPHY 52', 'WPHY 60', 'WPHY 65', 'WPHY 70'] as const;

export const FLANGE_CLASSES = ['150', '300', '400', '600', '900', '1500'] as const;

export type FlangeClass = (typeof FLANGE_CLASSES)[number];

export function normalizeGrade(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function gradesConflict(expected: string, received: string): boolean {
  const left = normalizeGrade(expected);
  const right = normalizeGrade(received);
  if (!left || !right) return false;
  return left !== right;
}

export function gradeReview(expected: string, received: string): string | null {
  if (!gradesConflict(expected, received)) return null;
  return GRADE_MISMATCH_MESSAGE;
}

export function isFlangeClass(value: string): value is FlangeClass {
  return (FLANGE_CLASSES as readonly string[]).includes(value);
}

export function flangeClassLabel(value: string): string {
  return value ? `Class ${value}` : '';
}
