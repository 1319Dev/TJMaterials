import { useState } from 'react';
import type { MtrRequestLine } from '../domain/types';
import { useApp } from '../state/AppState';
import { controlClass, Field } from '../components/ui';

function emptyLine(): MtrRequestLine {
  return {
    materialDescription: '',
    diameter: '',
    wallThickness: '',
    grade: '',
    heatNumber: '',
    manufacturer: '',
  };
}

export function MtrRequestPage() {
  const { snapshot, saveRequest } = useApp();
  const [inspectorName, setInspectorName] = useState(snapshot?.project.inspectorName ?? '');
  const [vendor, setVendor] = useState(snapshot?.project.vendor ?? '');
  const [atmosProjectNumber, setAtmosProjectNumber] = useState(snapshot?.project.atmosProjectNumber ?? '');
  const [salesOrderOrCustomerPo, setSalesOrderOrCustomerPo] = useState(snapshot?.project.salesOrderOrCustomerPo ?? '');
  const [shipmentNumberMrc, setShipmentNumberMrc] = useState('');
  const [lines, setLines] = useState<MtrRequestLine[]>([emptyLine()]);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  if (!snapshot) return null;

  function updateLine(index: number, patch: Partial<MtrRequestLine>) {
    setLines((current) => current.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line)));
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const nextErrors = saveRequest({
      inspectorName,
      vendor,
      atmosProjectNumber,
      salesOrderOrCustomerPo,
      shipmentNumberMrc,
      lines,
    });
    setErrors(nextErrors);
    setMessage(nextErrors.length === 0 ? 'Saved on this device. Not submitted.' : '');
  }

  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <h1 className="text-2xl font-black">MTR request form</h1>
      <p className="text-sm text-pmi-muted">
        Draft only. Saving does not send this form to a vendor and does not change material status.
      </p>
      {errors.map((error) => (
        <p key={error} role="alert">
          {error}
        </p>
      ))}
      {message ? <p role="status">{message}</p> : null}

      <Field label="Inspector Name">
        <input className={controlClass} value={inspectorName} onChange={(event) => setInspectorName(event.target.value)} />
      </Field>
      <Field label="Vendor">
        <input className={controlClass} value={vendor} onChange={(event) => setVendor(event.target.value)} />
      </Field>
      <Field label="Atmos Project #">
        <input className={controlClass} value={atmosProjectNumber} onChange={(event) => setAtmosProjectNumber(event.target.value)} />
      </Field>
      <Field label="Sales Order# / Customer PO #">
        <input className={controlClass} value={salesOrderOrCustomerPo} onChange={(event) => setSalesOrderOrCustomerPo(event.target.value)} />
      </Field>
      <Field label="Shipment # (MRC)">
        <input className={controlClass} value={shipmentNumberMrc} onChange={(event) => setShipmentNumberMrc(event.target.value)} />
      </Field>

      {lines.map((line, index) => (
        <fieldset key={index} className="space-y-3 rounded-2xl border-2 border-pmi-border p-3">
          <legend className="px-1 font-bold">Line {index + 1}</legend>
          <Field label="Material Description">
            <input className={controlClass} value={line.materialDescription} onChange={(event) => updateLine(index, { materialDescription: event.target.value })} />
          </Field>
          <Field label="Diameter">
            <input className={controlClass} value={line.diameter} onChange={(event) => updateLine(index, { diameter: event.target.value })} />
          </Field>
          <Field label="Wall Thickness">
            <input className={controlClass} value={line.wallThickness} onChange={(event) => updateLine(index, { wallThickness: event.target.value })} />
          </Field>
          <Field label="Grade">
            <input className={controlClass} value={line.grade} onChange={(event) => updateLine(index, { grade: event.target.value })} />
          </Field>
          <Field label="Heat Number">
            <input className={controlClass} value={line.heatNumber} onChange={(event) => updateLine(index, { heatNumber: event.target.value })} />
          </Field>
          <Field label="Manufacturer">
            <input className={controlClass} value={line.manufacturer} onChange={(event) => updateLine(index, { manufacturer: event.target.value })} />
          </Field>
        </fieldset>
      ))}

      <button type="button" className="min-h-14 w-full rounded-2xl border-2 border-pmi-border bg-pmi-card font-bold" onClick={() => setLines((current) => [...current, emptyLine()])}>
        Add line
      </button>
      <button type="submit" className="min-h-14 w-full rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text">
        Save request on this device
      </button>

      {snapshot.mtrRequests.length > 0 ? (
        <section aria-labelledby="saved-requests">
          <h2 id="saved-requests" className="text-sm font-bold uppercase tracking-wide">
            Saved on this device
          </h2>
          <ul className="mt-2 space-y-2">
            {snapshot.mtrRequests.map((request) => (
              <li key={request.id} className="rounded-2xl border-2 border-pmi-border p-3 text-sm">
                <p className="font-bold">{request.vendor || 'Vendor not entered'}</p>
                <p>{request.statusNote}</p>
                <p>{request.lines.length} line{request.lines.length === 1 ? '' : 's'}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </form>
  );
}
