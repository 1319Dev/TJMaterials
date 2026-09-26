import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FITTING_TYPE_LABELS } from '../domain/labels';
import {
  blankFittingInput,
  fittingInputFrom,
  type FittingInput,
} from '../domain/specialty';
import type { FittingType } from '../domain/types';
import { useApp } from '../state/AppState';
import {
  CustodySelect,
  DeliverySelect,
  FormErrors,
  GradeAlert,
  GradeSelect,
  PurchaseOrderSelect,
} from '../components/forms';
import { VerificationBadge, codeFieldProps, controlClass, Field } from '../components/ui';

export function FittingListPage() {
  const { snapshot } = useApp();
  if (!snapshot) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Fittings</h1>
      <p className="text-sm text-pmi-muted">Elbows, tees, reducers, caps, and other fittings. ASTM A860 WPHY grades are on the form.</p>
      <Link
        to="/fittings/new"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text"
      >
        Receive fitting
      </Link>
      {snapshot.fittings.length === 0 ? <p>No fittings on this device.</p> : null}
      <ul className="space-y-3">
        {snapshot.fittings.map((fitting) => (
          <li key={fitting.id}>
            <Link to={`/fittings/${fitting.id}`} className="block rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="text-lg font-black">{fitting.materialCode}</p>
              <p>{fitting.description}</p>
              <p className="text-sm text-pmi-muted">
                {FITTING_TYPE_LABELS[fitting.fittingType]}
                {fitting.heatNumber ? ` · Heat ${fitting.heatNumber}` : ''}
                {fitting.grade ? ` · Received ${fitting.grade}` : ''}
                {fitting.expectedGrade ? ` · Expected ${fitting.expectedGrade}` : ''}
              </p>
              <div className="mt-2 space-y-2">
                <VerificationBadge status={fitting.verificationStatus} />
                <GradeAlert expected={fitting.expectedGrade} received={fitting.grade} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FittingFormPage() {
  const { fittingId = 'new' } = useParams();
  return <FittingForm key={fittingId} fittingId={fittingId} />;
}

function FittingForm({ fittingId }: { fittingId: string }) {
  const { snapshot, saveFitting } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const existing = fittingId === 'new' ? undefined : snapshot?.fittings.find((item) => item.id === fittingId);
  const [form, setForm] = useState<FittingInput | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(() => Boolean((location.state as { saved?: boolean } | null)?.saved));
  if (!snapshot) return null;
  if (fittingId !== 'new' && !existing) return <p>That fitting is not on this device.</p>;
  const active = form ?? (existing ? fittingInputFrom(existing) : blankFittingInput());

  function update(patch: Partial<FittingInput>) {
    setForm({ ...active, ...patch });
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = saveFitting(active);
    setErrors(result.errors);
    if (result.errors.length > 0 || !result.id) {
      setSaved(false);
      return;
    }
    setSaved(true);
    if (fittingId === 'new') navigate(`/fittings/${result.id}`, { replace: true, state: { saved: true } });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-black">{existing ? 'Edit fitting' : 'Receive fitting'}</h1>
        <p className="mt-1 text-sm text-pmi-muted">
          {existing ? existing.materialCode : 'A Material ID is assigned when you save.'} This form does not mark material acceptable.
        </p>
      </div>
      <VerificationBadge status={existing?.verificationStatus ?? 'review_required'} />
      <FormErrors errors={errors} />
      {saved ? (
        <p role="status" className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3 font-bold">
          Saved on this device. REVIEW REQUIRED.
        </p>
      ) : null}
      <GradeAlert expected={active.expectedGrade} received={active.grade} />
      <Field label="Fitting type">
        <select
          className={controlClass}
          value={active.fittingType}
          onChange={(event) => update({ fittingType: event.target.value as FittingType })}
        >
          {(Object.entries(FITTING_TYPE_LABELS) as Array<[FittingType, string]>).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description" hint="Elbow, tee, reducer, cap, or another fitting.">
        <input className={controlClass} value={active.description} onChange={(event) => update({ description: event.target.value })} />
      </Field>
      <Field label="Diameter" hint="Use 36 x 24 for a reducer.">
        <input className={controlClass} value={active.diameter} onChange={(event) => update({ diameter: event.target.value })} />
      </Field>
      <Field label="Wall thickness">
        <input className={controlClass} value={active.wallThickness} onChange={(event) => update({ wallThickness: event.target.value })} />
      </Field>
      <Field label="Angle" hint="Degrees. 45 and 90 are common for elbows. Leave blank if there is no angle.">
        <input className={controlClass} inputMode="decimal" value={active.angleDeg} onChange={(event) => update({ angleDeg: event.target.value })} />
      </Field>
      <GradeSelect
        label="Expected grade"
        hint="ASTM A860 WPHY grade the order called for. Leave blank if it was not recorded."
        value={active.expectedGrade}
        onChange={(expectedGrade) => update({ expectedGrade })}
      />
      <GradeSelect
        label="Received grade"
        hint="Grade on the stamp. WPHY 52 and WPHY52 are the same grade. WPHY 70 is not."
        value={active.grade}
        onChange={(grade) => update({ grade })}
      />
      <Field label="Specification" hint="ASTM A860 / MSS SP-75 is the usual WPHY fitting spec. Clear it if the paperwork says something else.">
        <input className={controlClass} value={active.specification} onChange={(event) => update({ specification: event.target.value })} />
      </Field>
      <Field label="Manufacturer">
        <input className={controlClass} value={active.manufacturer} onChange={(event) => update({ manufacturer: event.target.value })} />
      </Field>
      <Field label="Heat number">
        <input className={controlClass} {...codeFieldProps} value={active.heatNumber} onChange={(event) => update({ heatNumber: event.target.value })} />
      </Field>
      <Field label="Qty">
        <input className={controlClass} inputMode="decimal" value={active.quantity} onChange={(event) => update({ quantity: event.target.value })} />
      </Field>
      <CustodySelect value={active.custodyStatus} onChange={(custodyStatus) => update({ custodyStatus })} />
      <DeliverySelect required={!existing} deliveries={snapshot.deliveries} value={active.deliveryId} onChange={(deliveryId) => update({ deliveryId })} />
      <PurchaseOrderSelect
        purchaseOrders={snapshot.purchaseOrders}
        value={active.purchaseOrderId}
        onChange={(purchaseOrderId) => update({ purchaseOrderId })}
      />
      <Field label="Notes">
        <textarea className={controlClass} rows={3} value={active.notes} onChange={(event) => update({ notes: event.target.value })} />
      </Field>
      <button type="submit" className="min-h-14 w-full rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text">
        Save fitting
      </button>
    </form>
  );
}
