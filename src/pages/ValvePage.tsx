import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { FLANGE_CLASSES, flangeClassLabel } from '../domain/grades';
import { ACTUATOR_TYPE_LABELS, VALVE_TYPE_LABELS } from '../domain/labels';
import { actuatorLinked, blankValveInput, valveInputFrom, type ValveInput } from '../domain/specialty';
import type { ActuatorType, ValveType } from '../domain/types';
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

export function ValveListPage() {
  const { snapshot } = useApp();
  if (!snapshot) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Valves</h1>
      <p className="text-sm text-pmi-muted">Link an actuator when one is on the valve. A blank actuator means none was recorded.</p>
      <Link
        to="/valves/new"
        className="flex min-h-14 items-center justify-center rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text"
      >
        Receive valve
      </Link>
      {snapshot.valves.length === 0 ? <p>No valves on this device.</p> : null}
      <ul className="space-y-3">
        {snapshot.valves.map((valve) => (
          <li key={valve.id}>
            <Link to={`/valves/${valve.id}`} className="block rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="pmi-code text-lg font-black">{valve.materialCode}</p>
              <p>{valve.description}</p>
              <p className="text-sm text-pmi-muted">
                {VALVE_TYPE_LABELS[valve.valveType]}
                {valve.classRating ? ` · ${flangeClassLabel(valve.classRating)}` : ''}
                {valve.serialNumber ? ` · Serial ${valve.serialNumber}` : ''}
              </p>
              <p className="text-sm">{actuatorLinked(valve) ? `Actuator linked ${valve.actuatorSerial}` : 'No actuator linked'}</p>
              <div className="mt-2 space-y-2">
                <VerificationBadge status={valve.verificationStatus} />
                <GradeAlert expected={valve.expectedGrade} received={valve.grade} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ValveFormPage() {
  const { valveId = 'new' } = useParams();
  return <ValveForm key={valveId} valveId={valveId} />;
}

function ValveForm({ valveId }: { valveId: string }) {
  const { snapshot, saveValve } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const existing = valveId === 'new' ? undefined : snapshot?.valves.find((item) => item.id === valveId);
  const [form, setForm] = useState<ValveInput | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(() => Boolean((location.state as { saved?: boolean } | null)?.saved));
  if (!snapshot) return null;
  if (valveId !== 'new' && !existing) return <p>That valve is not on this device.</p>;
  const active = form ?? (existing ? valveInputFrom(existing) : blankValveInput());
  const linked = actuatorLinked({
    actuatorType: active.actuatorType,
    actuatorManufacturer: active.actuatorManufacturer,
    actuatorModel: active.actuatorModel,
    actuatorSerial: active.actuatorSerial,
  });

  function update(patch: Partial<ValveInput>) {
    setForm({ ...active, ...patch });
    setSaved(false);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = saveValve(active);
    setErrors(result.errors);
    if (result.errors.length > 0 || !result.id) {
      setSaved(false);
      return;
    }
    setSaved(true);
    if (valveId === 'new') navigate(`/valves/${result.id}`, { replace: true, state: { saved: true } });
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-black">{existing ? 'Edit valve' : 'Receive valve'}</h1>
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
      <Field label="Valve type">
        <select
          className={controlClass}
          value={active.valveType}
          onChange={(event) => update({ valveType: event.target.value as ValveType })}
        >
          {(Object.entries(VALVE_TYPE_LABELS) as Array<[ValveType, string]>).map(([value, label]) => (
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
      <GradeSelect
        label="Expected grade"
        hint="Leave blank if the order did not name a grade."
        value={active.expectedGrade}
        onChange={(expectedGrade) => update({ expectedGrade })}
      />
      <GradeSelect
        label="Received grade"
        hint="Grade on the body or paperwork."
        value={active.grade}
        onChange={(grade) => update({ grade })}
      />
      <Field label="Manufacturer">
        <input className={controlClass} value={active.manufacturer} onChange={(event) => update({ manufacturer: event.target.value })} />
      </Field>
      <Field label="Model number">
        <input className={controlClass} value={active.modelNumber} onChange={(event) => update({ modelNumber: event.target.value })} />
      </Field>
      <Field label="Heat number">
        <input className={codeControlClass} {...codeFieldProps} value={active.heatNumber} onChange={(event) => update({ heatNumber: event.target.value })} />
      </Field>
      <Field label="Serial number">
        <input className={codeControlClass} {...codeFieldProps} value={active.serialNumber} onChange={(event) => update({ serialNumber: event.target.value })} />
      </Field>
      <fieldset className="space-y-3 border-2 border-pmi-border p-3">
        <legend className="px-1">
          <span className="pmi-sheet-title">ACTUATOR</span>
        </legend>
        <p className="text-sm font-bold">{linked ? 'Actuator linked' : 'No actuator linked'}</p>
        <Field label="Actuator type">
          <select
            className={controlClass}
            value={active.actuatorType}
            onChange={(event) => update({ actuatorType: event.target.value as ActuatorType })}
          >
            <option value="">Not linked</option>
            {(Object.entries(ACTUATOR_TYPE_LABELS) as Array<[Exclude<ActuatorType, ''>, string]>).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Actuator manufacturer">
          <input
            className={controlClass}
            value={active.actuatorManufacturer}
            onChange={(event) => update({ actuatorManufacturer: event.target.value })}
          />
        </Field>
        <Field label="Actuator model">
          <input className={controlClass} value={active.actuatorModel} onChange={(event) => update({ actuatorModel: event.target.value })} />
        </Field>
        <Field label="Actuator serial">
          <input
            className={codeControlClass}
            {...codeFieldProps}
            value={active.actuatorSerial}
            onChange={(event) => update({ actuatorSerial: event.target.value })}
          />
        </Field>
      </fieldset>
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
        Save valve
      </button>
    </form>
  );
}
