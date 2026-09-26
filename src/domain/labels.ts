import type { CustodyStatus, VerificationStatus } from './types';

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  match: 'MATCH',
  difference_found: 'DIFFERENCE FOUND',
  review_required: 'REVIEW REQUIRED',
  not_provided: 'NOT PROVIDED',
  not_verified: 'NOT VERIFIED',
  missing_documentation: 'MISSING DOCUMENTATION',
};

export const CUSTODY_LABELS: Record<CustodyStatus, string> = {
  expected: 'EXPECTED',
  received: 'RECEIVED',
  on_hold: 'ON HOLD',
  damaged: 'DAMAGED',
  installed: 'INSTALLED',
};

export const DELIVERY_STATUS_LABELS = {
  expected: 'EXPECTED',
  received: 'RECEIVED',
  partial: 'PARTIAL',
} as const;

export const CATEGORY_LABELS = {
  pipe: 'Pipe',
  fitting: 'Fitting',
  flange: 'Flange',
  valve: 'Valve',
  other: 'Other',
} as const;

export function verificationLabel(status: VerificationStatus): string {
  return VERIFICATION_LABELS[status];
}
