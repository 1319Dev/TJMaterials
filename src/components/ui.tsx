import type { CustodyStatus, VerificationStatus } from '../domain/types';
import { CUSTODY_LABELS, verificationLabel } from '../domain/labels';

export const controlClass =
  'mt-1 w-full min-h-12 rounded-sm border-2 border-pmi-border bg-pmi-card px-3 py-2 text-lg text-pmi-text';

export const codeControlClass = `${controlClass} pmi-code text-xl`;

export const codeFieldProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'characters',
  spellCheck: false,
} as const;

const yardVerification: Record<VerificationStatus, { label: string; tone: 'hold' | 'warn' | 'plain' }> = {
  review_required: { label: 'REVIEW REQUIRED', tone: 'warn' },
  missing_documentation: { label: 'PENDING DOCS', tone: 'warn' },
  not_provided: { label: 'PENDING DOCS', tone: 'warn' },
  difference_found: { label: 'DIFFERENCE FOUND', tone: 'warn' },
  match: { label: 'MATCH', tone: 'plain' },
  not_verified: { label: 'NOT VERIFIED', tone: 'plain' },
};

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-base font-black uppercase tracking-wide text-pmi-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-pmi-muted">{hint}</span> : null}
    </label>
  );
}

export function SheetHeader({ id, children }: { id?: string; children: string }) {
  return (
    <h2 id={id} className="pmi-sheet-title">
      {children}
    </h2>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const yard = yardVerification[status];
  return (
    <span title={verificationLabel(status)} className={`pmi-chip pmi-chip-${yard.tone}`}>
      {yard.label}
    </span>
  );
}

export function CustodyChip({ status }: { status: CustodyStatus }) {
  const hold = status === 'on_hold' || status === 'damaged';
  const label = status === 'on_hold' ? 'HOLD' : status === 'damaged' ? 'DAMAGED' : CUSTODY_LABELS[status];
  return (
    <span title={CUSTODY_LABELS[status]} className={`pmi-chip ${hold ? 'pmi-chip-hold' : ''}`}>
      {label}
    </span>
  );
}

export function PhotoSlot({
  caption,
  filled,
  detail,
  onCapture,
}: {
  caption: string;
  filled: boolean;
  detail: string;
  onCapture: () => void;
}) {
  return (
    <button type="button" className="pmi-photo-slot" onClick={onCapture}>
      <span className="pmi-photo-frame" aria-hidden="true">
        {filled ? 'NO BYTES' : 'CAM'}
      </span>
      <span>
        <span className="block text-base font-black tracking-wide">{caption}</span>
        <span className="mt-0.5 block text-sm leading-snug text-pmi-muted">{detail}</span>
      </span>
    </button>
  );
}

export function Disclaimer() {
  return (
    <p className="pmi-sheet-quiet text-sm leading-snug">
      Third-party materials documentation. Not an official Atmos Energy or TJ Inspection application.
      Status labels are records. This app does not decide that material is acceptable.
    </p>
  );
}
