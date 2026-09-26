import { useState } from 'react';
import { A860_WPHY_GRADES, gradeReview } from '../domain/grades';
import { CUSTODY_LABELS } from '../domain/labels';
import type { CustodyStatus, DeliveryRecord, PurchaseOrderRecord } from '../domain/types';
import { controlClass, Field } from './ui';

const knownGrades = new Set<string>(A860_WPHY_GRADES);

export function GradeSelect({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [custom, setCustom] = useState(value !== '' && !knownGrades.has(value));
  return (
    <>
      <Field label={label} hint={hint}>
        <select
          className={controlClass}
          value={custom ? 'other' : value}
          onChange={(event) => {
            const next = event.target.value;
            if (next === 'other') {
              setCustom(true);
              if (knownGrades.has(value)) onChange('');
              return;
            }
            setCustom(false);
            onChange(next);
          }}
        >
          <option value="">Not recorded</option>
          {A860_WPHY_GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
          <option value="other">Other grade</option>
        </select>
      </Field>
      {custom ? (
        <Field label={`${label} text`}>
          <input className={controlClass} value={value} onChange={(event) => onChange(event.target.value)} />
        </Field>
      ) : null}
    </>
  );
}

export function GradeAlert({ expected, received }: { expected: string; received: string }) {
  const message = gradeReview(expected, received);
  if (!message) return null;
  return (
    <p
      role="alert"
      data-testid="grade-mismatch"
      className="pmi-flag"
    >
      {message}
    </p>
  );
}

export function FormErrors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert" className="space-y-1 rounded-2xl border-2 border-pmi-border p-3">
      {errors.map((error) => (
        <li key={error}>{error}</li>
      ))}
    </ul>
  );
}

export function CustodySelect({
  value,
  onChange,
}: {
  value: CustodyStatus;
  onChange: (value: CustodyStatus) => void;
}) {
  return (
    <Field label="Custody">
      <select
        className={controlClass}
        value={value}
        onChange={(event) => onChange(event.target.value as CustodyStatus)}
      >
        {(Object.entries(CUSTODY_LABELS) as Array<[CustodyStatus, string]>).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function DeliverySelect({
  value,
  onChange,
  deliveries,
  required,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  deliveries: DeliveryRecord[];
  required?: boolean;
}) {
  return (
    <Field
      label="Delivery"
      hint={
        required
          ? 'Choose a delivery already on this device. A BOL number is not invented here.'
          : 'Optional. A BOL number is not invented here.'
      }
    >
      <select className={controlClass} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{required ? 'Choose a delivery' : 'Not linked'}</option>
        {deliveries.map((delivery) => (
          <option key={delivery.id} value={delivery.id}>
            {delivery.bolNumber || delivery.packingSlipNumber || 'Delivery'} · {delivery.vendor} ·{' '}
            {delivery.status === 'received' ? 'RECEIVED' : delivery.status === 'partial' ? 'PARTIAL' : 'EXPECTED'}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function PurchaseOrderSelect({
  value,
  onChange,
  purchaseOrders,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  purchaseOrders: PurchaseOrderRecord[];
}) {
  return (
    <Field label="PO number">
      <select className={controlClass} value={value ?? ''} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">Not linked</option>
        {purchaseOrders.map((po) => (
          <option key={po.id} value={po.id}>
            {po.poNumber} · {po.vendor}
          </option>
        ))}
      </select>
    </Field>
  );
}
