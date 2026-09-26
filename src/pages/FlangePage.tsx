import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FLANGE_CLASSES, flangeClassLabel } from '../domain/grades';
import { FLANGE_TYPE_LABELS } from '../domain/labels';
import { blankFlangeInput, flangeInputFrom, type FlangeInput } from '../domain/specialty';
import type { FlangeType } from '../domain/types';
import { useApp } from '../state/AppState';
import {
  CustodySelect,
  DeliverySelect,
  FormErrors,
  GradeAlert,
  GradeSelect,
  PurchaseOrderSelect,
} from '../components/forms';
import { SheetHeader, VerificationBadge, codeControlClass, codeFieldProps, controlClass, Field } from '../components/ui';

export function FlangeListPage() {
  const { snapshot } = useApp();
  if (!snapshot) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Flanges</h1>
      <p className="text-sm text-pmi-muted">Classes 150, 300, 400, 600, 900, and 1500.</p>
      <Link
        to="/flanges/new"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text"
      >
        Receive flange
      </Link>
      {snapshot.flanges.length === 0 ? <p>No flanges on this device.</p> : null}
      <ul className="space-y-3">
        {snapshot.flanges.map((flange) => (
          <li key={flange.id}>
            <Link to={`/flanges/${flange.id}`} className="block rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="pmi-code text-lg font-black">{flange.materialCode}</p>
              <p>{flange.description}</p>
              <p className="text-sm text-pmi-muted">
                {FLANGE_TYPE_LABELS[flange.flangeType]}
                {flange.classRating ? ` · ${flangeClassLabel(flange.classRating)}` : ''}
                {flange.heatNumber ? ` · Heat ${flange.heatNumber}` : ''}
              </p>
              <div className="mt-2 space-y-2">
                <VerificationBadge status={flange.verificationStatus} />
                <GradeAlert expected={flange.expectedGrade} received={flange.grade} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FlangeFormPage() {
  const { flangeId = 'new' } = useParams();
  return <FlangeForm key={flangeId} flangeId={flangeId} />;
}

function FlangeForm({ flangeId }: { flangeId: string }) {
  const { snapshot, saveFlange } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const existing = flangeId === 'new' ? undefined : snapshot?.flanges.find((item) => item.id === flangeId);
  const [form, setForm] = useState<FlangeInput | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(() => Boolean((location.state as { saved?: boolean } | null)?.saved));
  if (!snapshot) return null;
  if (flangeId !== 'new' && !existing) return <p>That flange is not on this device.</p>;
  const active = form ?? (existing ? flangeInputFrom(existing) : blankFlangeInput());

  function update(patch: Partial<FlangeInput>) {
    setForm({ ...active, ...patch });
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = saveFlange(active);
    setErrors(result.errors);
    if (result.errors.length > 0 || !result.id) {
      setSaved(false);
      return;
    }
    setSaved(true);
    if (flangeId === 'new') navigate(`/flanges/${result.id}`, { replace: true, state: { saved: true } });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-black">{existing ? 'Edit flange' : 'Receive flange'}</h1>
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
      <SheetHeader>MARKINGS</SheetHeader>
      <Field label="Flange type">
        <select
          className={controlClass}
          value={active.flangeType}
          onChange={(event) => update({ flangeType: event.target.value as FlangeType })}
        >
          {(Object.entries(FLANGE_TYPE_LABELS) as Array<[FlangeType, string]>).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Class">
        <select className={controlClass} value={active.classRating} onChange={(event) => update({ classRating: event.target.value })}>
          <option value="">Not recorded</option>
          {FLANGE_CLASSES.map((rating) => (
            <option key={rating} value={rating}>
              Class {rating}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <input className={controlClass} value={active.description} onChange={(event) => update({ description: event.target.value })} />
      </Field>
      <Field label="Diameter">
        <input className={controlClass} value={active.diameter} onChange={(event) => update({ diameter: event.target.value })} />
      </Field>
      <Field label="Facing" hint="RF, RTJ, or FF if it is stamped. Leave blank if it was not read.">
        <input className={controlClass} value={active.facing} onChange={(event) => update({ facing: event.target.value })} />
      </Field>
      <GradeSelect
        label="Expected grade"
        hint="Leave blank if the order did not name a grade."
        value={active.expectedGrade}
        onChange={(expectedGrade) => update({ expectedGrade })}
      />
      <GradeSelect
        label="Received grade"
        hint="Grade on the stamp, including a WPHY grade when that is what was received."
        value={active.grade}
        onChange={(grade) => update({ grade })}
      />
      <Field label="Manufacturer">
        <input className={controlClass} value={active.manufacturer} onChange={(event) => update({ manufacturer: event.target.value })} />
      </Field>
      <Field label="Heat number">
        <input className={codeControlClass} {...codeFieldProps} value={active.heatNumber} onChange={(event) => update({ heatNumber: event.target.value })} />
      </Field>
      <Field label="Serial / lot">
        <input className={codeControlClass} {...codeFieldProps} value={active.serialOrLot} onChange={(event) => update({ serialOrLot: event.target.value })} />
      </Field>
      <Field label="Qty">
        <input className={codeControlClass} inputMode="decimal" value={active.quantity} onChange={(event) => update({ quantity: event.target.value })} />
      </Field>
      <SheetHeader>CONDITION</SheetHeader>
      <CustodySelect value={active.custodyStatus} onChange={(custodyStatus) => update({ custodyStatus })} />
      <SheetHeader>DELIVERY</SheetHeader>
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
        Save flange
      </button>
    </form>
  );
}
