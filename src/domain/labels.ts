import type {
  ActuatorType,
  CustodyStatus,
  FittingType,
  FlangeType,
  ValveType,
  VerificationStatus,
} from './types';

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

export const FITTING_TYPE_LABELS: Record<FittingType, string> = {
  elbow: 'Elbow',
  tee: 'Tee',
  reducer: 'Reducer',
  cap: 'Cap',
  other: 'Other',
};

export const FLANGE_TYPE_LABELS: Record<FlangeType, string> = {
  wn: 'Weld neck (WN)',
  so: 'Slip-on (SO)',
  blind: 'Blind',
  lap_joint: 'Lap joint',
  threaded: 'Threaded',
  other: 'Other',
};

export const VALVE_TYPE_LABELS: Record<ValveType, string> = {
  ball: 'Ball',
  gate: 'Gate',
  plug: 'Plug',
  check: 'Check',
  other: 'Other',
};

export const ACTUATOR_TYPE_LABELS: Record<Exclude<ActuatorType, ''>, string> = {
  electric: 'Electric',
  pneumatic: 'Pneumatic',
  hydraulic: 'Hydraulic',
  manual_gear: 'Manual gear',
  other: 'Other',
};

export function verificationLabel(status: VerificationStatus): string {
  return VERIFICATION_LABELS[status];
}
