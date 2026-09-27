import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CoordinatorNav } from '../components/CoordinatorNav';
import { OcrPreview, type OcrDraft } from '../components/OcrPreview';
import { StoredImage } from '../components/StoredImage';
import { CaptureActions, Field, controlClass } from '../components/ui';
import { listPackingSlips, type PackingSlipInput } from '../domain/coordinator';
import { localIsoDate } from '../domain/dates';
import { parsePackingSlipText } from '../domain/packing-slip-ocr';
import { recognizePackingSlip } from '../lib/ocr';
import { useApp } from '../state/AppState';

export function PackingSlipsPage() {
  const { snapshot, savePackingSlip, applyOcrRows, openDocument } = useApp();
  const today = localIsoDate();
  const [deliveryId, setDeliveryId] = useState('');
  const [packingSlipNumber, setPackingSlipNumber] = useState('');
  const [bolNumber, setBolNumber] = useState('');
  const [shipmentNumberMrc, setShipmentNumberMrc] = useState('');
  const [vendor, setVendor] = useState(snapshot?.project.vendor ?? '');
  const [receivedOn, setReceivedOn] = useState(today);
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const [reading, setReading] = useState('');
  const [ocrError, setOcrError] = useState('');
  const [draft, setDraft] = useState<OcrDraft | null>(null);
  const [applied, setApplied] = useState('');

  const slips = useMemo(() => (snapshot ? listPackingSlips(snapshot) : []), [snapshot]);
  if (!snapshot) return null;

  function chooseDelivery(id: string) {
    setDeliveryId(id);
    const delivery = snapshot?.deliveries.find((item) => item.id === id);
    if (!delivery) return;
    setVendor(delivery.vendor);
    setPackingSlipNumber(delivery.packingSlipNumber);
    setBolNumber(delivery.bolNumber);
    setShipmentNumberMrc(delivery.shipmentNumberMrc);
    if (delivery.receivedOn) setReceivedOn(delivery.receivedOn);
  }

  function onPhoto(next: File) {
    setFile(next);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  }

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    const input: PackingSlipInput = {
      deliveryId: deliveryId || null,
      packingSlipNumber,
      bolNumber,
      shipmentNumberMrc,
      vendor,
      receivedOn,
      notes,
    };
    const result = await savePackingSlip(input, file);
    setErrors(result.errors);
    if (result.errors.length === 0) {
      setSaved('Packing slip stored on this device.');
      setFile(null);
      setPackingSlipNumber('');
      setNotes('');
    }
  }

  async function onRead(documentId: string, linkedDeliveryId: string | null) {
    setOcrError('');
    setApplied('');
    setReading(documentId);
    setDraft(null);
    try {
      const url = await openDocument(documentId);
      if (!url) {
        setOcrError('That photo is not on this device.');
        return;
      }
      const blob = await fetch(url).then((response) => response.blob());
      URL.revokeObjectURL(url);
      const recognized = await recognizePackingSlip(blob, (status) => setReading(`${documentId}:${status}`));
      const parsed = parsePackingSlipText(recognized.text, recognized.lines);
      setDraft({ ...parsed, documentId, deliveryId: linkedDeliveryId });
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : 'Could not read that photo on this device.');
    } finally {
      setReading('');
    }
  }

  return (
    <div className="space-y-4" data-testid="packing-slips">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Coordinator</p>
        <h1 className="text-3xl font-black leading-none">Packing slips</h1>
        <p className="mt-2 text-sm text-pmi-muted">
          Photos and slip numbers stay on this device. Reading a slip does not accept material.
        </p>
      </div>
      <CoordinatorNav />

      <form className="space-y-3" onSubmit={onSave}>
        <h2 className="pmi-sheet-title">New slip</h2>
        {errors.map((error) => (
          <p key={error} role="alert" className="pmi-flag">
            {error}
          </p>
        ))}
        {saved ? <p role="status">{saved}</p> : null}
        <Field label="Delivery">
          <select className={controlClass} value={deliveryId} onChange={(event) => chooseDelivery(event.target.value)}>
            <option value="">No delivery yet</option>
            {snapshot.deliveries.map((delivery) => (
              <option key={delivery.id} value={delivery.id}>
                {delivery.receivedOn || 'Undated'} · {delivery.vendor} · {delivery.bolNumber || delivery.packingSlipNumber || 'Delivery'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Packing slip #">
          <input className={controlClass} value={packingSlipNumber} onChange={(event) => setPackingSlipNumber(event.target.value)} />
        </Field>
        <Field label="BOL #">
          <input className={controlClass} value={bolNumber} onChange={(event) => setBolNumber(event.target.value)} />
        </Field>
        <Field label="Shipment # (MRC)">
          <input className={controlClass} value={shipmentNumberMrc} onChange={(event) => setShipmentNumberMrc(event.target.value)} />
        </Field>
        <Field label="Vendor">
          <input className={controlClass} value={vendor} onChange={(event) => setVendor(event.target.value)} />
        </Field>
        <Field label="Received date">
          <input className={controlClass} type="date" value={receivedOn} onChange={(event) => setReceivedOn(event.target.value)} />
        </Field>
        <Field label="Notes">
          <textarea className={controlClass} rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        <CaptureActions cameraLabel="Packing slip camera" uploadLabel="Upload packing slip photo" onFile={onPhoto} />
        {previewUrl ? <img src={previewUrl} alt="Packing slip photo" className="max-h-64 w-full border-2 border-pmi-border object-contain" /> : null}
        <button type="submit" className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text">
          Save packing slip
        </button>
      </form>

      <section aria-labelledby="slip-list">
        <h2 id="slip-list" className="pmi-sheet-title">
          On this device
        </h2>
        {slips.length === 0 ? (
          <p className="mt-2 border-2 border-pmi-border bg-pmi-card p-3 font-bold">No packing slips stored yet.</p>
        ) : (
          <ul className="mt-2 space-y-3">
            {slips.map((slip) => (
              <li key={slip.key} className="border-2 border-pmi-border bg-pmi-card p-3">
                <p className="text-lg font-black">{slip.vendor || 'Vendor not entered'}</p>
                <p className="pmi-code text-sm font-bold">
                  Slip {slip.packingSlipNumber || '—'} · BOL {slip.bolNumber || '—'}
                </p>
                <p className="text-sm">Shipment # (MRC) {slip.shipmentNumberMrc || '—'}</p>
                {slip.photos.length === 0 ? <p className="mt-2 text-sm font-bold">No photo stored for this slip.</p> : null}
                {slip.photos.map((photo) => (
                  <div key={photo.documentId} className="mt-3 space-y-2">
                    {photo.mimeType.startsWith('image/') ? (
                      <StoredImage documentId={photo.documentId} alt="Packing slip photo" />
                    ) : (
                      <p className="font-bold">
                        {photo.fileName} · {photo.byteSize} bytes
                      </p>
                    )}
                    <button
                      type="button"
                      className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-black"
                      onClick={() => void onRead(photo.documentId, slip.deliveryId)}
                    >
                      {reading.startsWith(photo.documentId) ? 'Reading on this device…' : 'Read this slip'}
                    </button>
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      {ocrError ? (
        <p role="alert" className="pmi-flag">
          {ocrError}
        </p>
      ) : null}
      {applied ? (
        <p role="status" className="border-2 border-pmi-border bg-pmi-card p-3 font-bold">
          {applied}{' '}
          <Link to="/tracker" className="underline">
            Open the tracker
          </Link>
        </p>
      ) : null}
      {draft ? (
        <OcrPreview
          draft={draft}
          onApply={(input) => {
            const result = applyOcrRows(input.proposals, {
              documentId: draft.documentId,
              deliveryId: draft.deliveryId,
              constructionOrderNo: input.constructionOrderNo,
              projectNumber: input.projectNumber,
            });
            if (result.errors.length > 0) {
              setOcrError(result.errors[0] ?? 'Nothing was written.');
              setApplied('');
              return;
            }
            setOcrError('');
            setApplied(`${result.applied} row${result.applied === 1 ? '' : 's'} added. REVIEW REQUIRED. Material was not accepted.`);
          }}
        />
      ) : null}
    </div>
  );
}
