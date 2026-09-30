import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { downloadMasterList } from '../lib/master-list-file';
import { localIsoDate } from '../domain/dates';
import { readBlob } from '../lib/blob';
import { collectMaterialCodes, nextMaterialCode } from '../domain/ids';
import { CATEGORY_LABELS } from '../domain/labels';
import { requestCameraStub, requestGpsStub } from '../domain/permissions';
import { emptyReceiveLine, receiveDefaults, type PhotoStubInput, type ReceiveInput, type ReceiveLineInput } from '../domain/receive';
import type { MaterialCategory, TrackerSheet } from '../domain/types';
import { useApp } from '../state/AppState';
import { SpecialtyNav } from '../components/SpecialtyNav';
import { CaptureActions, PhotoSlot, SheetHeader, VerificationBadge, codeControlClass, codeFieldProps, controlClass, Field } from '../components/ui';

export function ReceivePage() {
  const { snapshot, saveReceipt, recordPermission } = useApp();
  const [params] = useSearchParams();
  const fromDaily = params.get('from') === 'daily';
  const today = localIsoDate();
  const [form, setForm] = useState<ReceiveInput | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState<{ codes: string[]; items: string[]; tracker: TrackerSheet } | null>(null);
  const [permissionNote, setPermissionNote] = useState('');

  const active = form ?? (snapshot ? receiveDefaults(snapshot, today) : null);
  const previewCodes = useMemo(() => {
    if (!snapshot || !active) return [];
    const codes = collectMaterialCodes(snapshot);
    const assigned: string[] = [];
    for (const line of active.lines) {
      const code = nextMaterialCode(line.category, [...codes, ...assigned]);
      assigned.push(code);
    }
    return assigned;
  }, [active, snapshot]);

  if (!snapshot || !active) return null;
  const loaded = snapshot;
  const formValue = active;

  function update(patch: Partial<ReceiveInput>) {
    setForm({ ...formValue, ...patch });
    setSaved(null);
  }

  function updateLine(index: number, patch: Partial<ReceiveLineInput>) {
    const lines = formValue.lines.map((line, lineIndex) => (lineIndex === index ? { ...line, ...patch } : line));
    update({ lines });
  }

  async function onCamera(role: PhotoStubInput['role'], caption: string) {
    const note = await requestCameraStub();
    recordPermission('camera', note);
    setPermissionNote(note.message);
    const stub: PhotoStubInput = {
      role,
      caption,
      permissionStatus: note.status,
      message: note.message,
    };
    update({ photoStubs: [...formValue.photoStubs, stub] });
  }

  async function onGps() {
    const note = await requestGpsStub();
    recordPermission('gps', note);
    setPermissionNote(note.message);
    update({
      gps: {
        status: note.status,
        latitude: note.latitude,
        longitude: note.longitude,
      },
    });
  }

  function rememberFile(file: File, docType: 'packing_slip' | 'bol', role: 'packing_slip' | 'bol', caption: string) {
    void readBlob(file).then((buffer) => {
      update({
        documents: [
          ...formValue.documents,
          {
            docType,
            title: file.name || caption,
            fileName: file.name || `${caption}.jpg`,
            mimeType: file.type || 'image/jpeg',
            byteSize: file.size,
            bytes: new Uint8Array(buffer),
          },
        ],
        photoStubs: [
          ...formValue.photoStubs,
          {
            role,
            caption,
            permissionStatus: 'granted',
            message: 'Photo stored on this device.',
            byteSize: file.size,
          },
        ],
      });
    });
  }

  function onFile(event: React.ChangeEvent<HTMLInputElement>, docType: 'packing_slip' | 'bol') {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    rememberFile(file, docType, docType, file.name);
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = saveReceipt(formValue);
    if (!result) return;
    if (result.errors.length > 0) {
      setErrors(result.errors);
      setSaved(null);
      return;
    }
    setErrors([]);
    setSaved({ codes: result.materialCodes ?? [], items: result.trackerItems ?? [], tracker: result.snapshot.tracker });
    setForm(receiveDefaults(loaded, today));
  }

  return (
    <form className="space-y-5" onSubmit={onSubmit}>
      <div>
        <h1 className="text-2xl font-black">Receive material</h1>
        {fromDaily ? (
          <p className="mt-2 border-l-8 border-l-pmi-hold bg-pmi-ink px-3 py-2 text-base font-black text-pmi-sheet-text">
            Daily materials receive. This receipt stays REVIEW REQUIRED. Each line is appended to the Master List.
          </p>
        ) : (
          <p className="mt-2 text-sm font-bold">Saving appends each line to the Master List as the next Item.</p>
        )}
        <p className="mt-1 text-sm text-pmi-muted">
          Saved on this device as REVIEW REQUIRED. Heat numbers, photos, and coordinates are stored only when you enter them.
        </p>
      </div>
      <SpecialtyNav />

      {errors.length > 0 ? (
        <ul role="alert" className="space-y-1 rounded-2xl border-2 border-pmi-border p-3">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      ) : null}

      {saved ? (
        <div role="status" className="space-y-2 rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
          <p className="font-bold">Saved on this device</p>
          <ul>
            {saved.codes.map((code) => (
              <li key={code} className="font-bold">
                {code}
              </li>
            ))}
          </ul>
          <p className="font-bold">Master List item {saved.items.join(', ')}. Material was not accepted.</p>
          <Link to="/tracker" className="flex min-h-12 items-center font-black underline">
            Open Master List
          </Link>
          <button type="button" className="min-h-12 w-full border-2 border-pmi-border font-black" onClick={() => downloadMasterList(saved.tracker)}>
            Download Master List
          </button>
          <VerificationBadge status="review_required" />
        </div>
      ) : null}

      <section className="space-y-3" aria-labelledby="delivery-header">
        <SheetHeader id="delivery-header">DELIVERY</SheetHeader>
        <Field label="Received date">
          <input className={controlClass} type="date" value={active.receivedOn} onChange={(event) => update({ receivedOn: event.target.value })} />
        </Field>
        <Field label="Vendor">
          <input className={controlClass} value={active.vendor} onChange={(event) => update({ vendor: event.target.value })} />
        </Field>
        <Field label="Inspector Name">
          <input className={controlClass} value={active.inspectorName} onChange={(event) => update({ inspectorName: event.target.value })} />
        </Field>
        <Field label="Shipment # (MRC)">
          <input className={controlClass} {...codeFieldProps} value={active.shipmentNumberMrc} onChange={(event) => update({ shipmentNumberMrc: event.target.value })} />
        </Field>
        <Field label="Sales Order# / Customer PO #">
          <input
            className={controlClass}
            value={active.salesOrderOrCustomerPo}
            onChange={(event) => update({ salesOrderOrCustomerPo: event.target.value })}
          />
        </Field>
        <Field label="PO number">
          <input className={controlClass} {...codeFieldProps} value={active.poNumber} onChange={(event) => update({ poNumber: event.target.value })} />
        </Field>
        <Field label="Carrier">
          <input className={controlClass} value={active.carrier} onChange={(event) => update({ carrier: event.target.value })} />
        </Field>
      </section>

      <section className="space-y-3" aria-labelledby="paper-header">
        <SheetHeader id="paper-header">MARKINGS</SheetHeader>
        <Field label="Packing slip #">
          <input className={codeControlClass} {...codeFieldProps} value={active.packingSlipNumber} onChange={(event) => update({ packingSlipNumber: event.target.value })} />
        </Field>
        <Field label="BOL #">
          <input className={codeControlClass} {...codeFieldProps} value={active.bolNumber} onChange={(event) => update({ bolNumber: event.target.value })} />
        </Field>
        <CaptureActions
          cameraLabel="Packing slip camera"
          uploadLabel="Upload packing slip photo"
          onFile={(file) => rememberFile(file, 'packing_slip', 'packing_slip', 'PACKING SLIP')}
        />
        <CaptureActions
          cameraLabel="BOL camera"
          uploadLabel="Upload BOL photo"
          onFile={(file) => rememberFile(file, 'bol', 'bol', 'BOL')}
        />
        {active.photoStubs.some((stub) => stub.byteSize && stub.byteSize > 0) ? (
          <p className="text-sm font-bold">Photo stored on this device. It is saved with the delivery.</p>
        ) : null}
        <Field label="Attach packing slip file" hint="The file stays on this device.">
          <input className={controlClass} type="file" onChange={(event) => onFile(event, 'packing_slip')} />
        </Field>
        <Field label="Attach BOL file">
          <input className={controlClass} type="file" onChange={(event) => onFile(event, 'bol')} />
        </Field>
        {active.documents.length > 0 ? (
          <ul className="text-sm">
            {active.documents.map((document) => (
              <li key={document.fileName}>
                {document.fileName} · {document.mimeType || 'unknown type'} · {document.byteSize} bytes
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="space-y-3" aria-labelledby="condition-header">
        <SheetHeader id="condition-header">CONDITION</SheetHeader>
        <div className="grid grid-cols-1 gap-2">
          {(
            [
              ['material', 'ENTIRE LOAD'],
              ['other', 'HEAT STAMP'],
              ['damage', 'DAMAGE'],
            ] as const
          ).map(([role, caption]) => {
            const stub = [...active.photoStubs].reverse().find((item) => item.caption === caption);
            return (
              <PhotoSlot
                key={caption}
                caption={caption}
                filled={Boolean(stub)}
                detail={stub ? `${stub.message} NO BYTES stored.` : 'Tap to open a capture slot. No photo bytes are stored.'}
                onCapture={() => onCamera(role, caption)}
              />
            );
          })}
        </div>
        <button type="button" className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-base font-bold" onClick={() => onGps()}>
          Capture GPS
        </button>
        {permissionNote ? <p className="text-sm">{permissionNote}</p> : null}
      </section>

      <section className="space-y-4" aria-labelledby="lines-header">
        <SheetHeader id="lines-header">LINE ITEMS</SheetHeader>
        {active.lines.map((line, index) => (
          <fieldset key={index} className="space-y-3 rounded-2xl border-2 border-pmi-border p-3">
            <legend className="px-1 font-bold">Line {index + 1}</legend>
            <p className="pmi-code text-sm font-bold">Material ID {previewCodes[index]}</p>
            <Field label="Category">
              <select
                className={controlClass}
                value={line.category}
                onChange={(event) => updateLine(index, { category: event.target.value as MaterialCategory })}
              >
                {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Material Type" hint="Master List column. Blank uses the category.">
              <input className={controlClass} value={line.materialType} onChange={(event) => updateLine(index, { materialType: event.target.value })} />
            </Field>
            <Field label="Material Description">
              <input className={controlClass} value={line.description} onChange={(event) => updateLine(index, { description: event.target.value })} />
            </Field>
            <Field label="Diameter" hint="Size (inches)">
              <input className={controlClass} inputMode="decimal" value={line.diameter} onChange={(event) => updateLine(index, { diameter: event.target.value })} />
            </Field>
            <Field label="Wall Thickness" hint="Wall / SDR">
              <input className={controlClass} value={line.wallThickness} onChange={(event) => updateLine(index, { wallThickness: event.target.value })} />
            </Field>
            <Field label="Grade">
              <input className={controlClass} value={line.grade} onChange={(event) => updateLine(index, { grade: event.target.value })} />
            </Field>
            <Field label="Heat Number">
              <input className={codeControlClass} {...codeFieldProps} value={line.heatNumber} onChange={(event) => updateLine(index, { heatNumber: event.target.value })} />
            </Field>
            <Field label="Manufacturer">
              <input className={controlClass} value={line.manufacturer} onChange={(event) => updateLine(index, { manufacturer: event.target.value })} />
            </Field>
            <Field label="Qty">
              <input className={controlClass} inputMode="decimal" value={line.quantity} onChange={(event) => updateLine(index, { quantity: event.target.value })} />
            </Field>
            <Field label="UOM">
              <select className={controlClass} value={line.uom} onChange={(event) => updateLine(index, { uom: event.target.value })}>
                <option value="Each">Each</option>
                <option value="Ft">Ft</option>
              </select>
            </Field>
            <Field label="Model Number">
              <input className={controlClass} value={line.modelNumber} onChange={(event) => updateLine(index, { modelNumber: event.target.value })} />
            </Field>
            <Field label="Serial / Lot">
              <input className={controlClass} {...codeFieldProps} value={line.serialOrLot} onChange={(event) => updateLine(index, { serialOrLot: event.target.value })} />
            </Field>
            <Field label="Joint">
              <input className={codeControlClass} {...codeFieldProps} value={line.jointNumber} onChange={(event) => updateLine(index, { jointNumber: event.target.value })} />
            </Field>
            <Field label="ANSI / Pressure Rating">
              <input
                className={controlClass}
                value={line.ansiPressureRating}
                onChange={(event) => updateLine(index, { ansiPressureRating: event.target.value })}
              />
            </Field>
            {active.lines.length > 1 ? (
              <button
                type="button"
                className="min-h-12 rounded-xl border-2 border-pmi-border px-3 font-bold"
                onClick={() => update({ lines: active.lines.filter((_, lineIndex) => lineIndex !== index) })}
              >
                Remove line
              </button>
            ) : null}
          </fieldset>
        ))}
        <button
          type="button"
          className="min-h-14 w-full rounded-2xl border-2 border-pmi-border bg-pmi-card text-base font-bold"
          onClick={() => update({ lines: [...active.lines, emptyReceiveLine()] })}
        >
          Add line
        </button>
      </section>

      <Field label="Notes">
        <textarea className={controlClass} rows={3} value={active.notes} onChange={(event) => update({ notes: event.target.value })} />
      </Field>

      <button type="submit" className="min-h-14 w-full rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text">
        Save delivery
      </button>
    </form>
  );
}
