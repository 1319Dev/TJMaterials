import type { VerificationStatus } from '../domain/types';
import { verificationLabel } from '../domain/labels';

export const controlClass =
  'mt-1 w-full min-h-12 rounded-xl border-2 border-pmi-border bg-pmi-card px-3 py-2 text-lg text-pmi-text';

export const codeFieldProps = {
  autoComplete: 'off',
  autoCorrect: 'off',
  autoCapitalize: 'characters',
  spellCheck: false,
} as const;

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
      <span className="block text-sm font-bold uppercase tracking-wide text-pmi-muted">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-sm text-pmi-muted">{hint}</span> : null}
    </label>
  );
}

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-lg border-2 border-pmi-border px-2 py-1 text-xs font-bold uppercase tracking-wide">
      {verificationLabel(status)}
    </span>
  );
}

export function Disclaimer() {
  return (
    <p className="text-sm leading-snug text-pmi-muted">
      Third-party materials documentation. Not an official Atmos Energy or TJ Inspection application.
      Status labels are records. This app does not decide that material is acceptable.
    </p>
  );
}
