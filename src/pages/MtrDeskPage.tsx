import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CoordinatorNav } from '../components/CoordinatorNav';
import { StoredImage } from '../components/StoredImage';
import { CaptureActions, VerificationBadge } from '../components/ui';
import { listMtrDesk } from '../domain/coordinator';
import { useApp } from '../state/AppState';

const PAPERWORK = {
  on_file: 'MTR ON FILE',
  not_provided: 'NOT PROVIDED',
  missing_documentation: 'MISSING DOCUMENTATION',
} as const;

export function MtrDeskPage() {
  const { snapshot, captureImage } = useApp();
  const [note, setNote] = useState('');
  if (!snapshot) return null;
  const rows = listMtrDesk(snapshot);
  const missing = rows.filter((row) => row.paperwork !== 'on_file').length;
  const onFile = rows.length - missing;

  return (
    <div className="space-y-4" data-testid="mtr-desk">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Coordinator</p>
        <h1 className="text-3xl font-black leading-none">MTRs</h1>
        <p className="mt-2 text-sm text-pmi-muted">
          Mill test report images stay on this device. Attaching a file does not accept the material.
        </p>
      </div>
      <CoordinatorNav />
      <Link to="/mtr-request" className="flex min-h-14 items-center justify-center border-2 border-pmi-border bg-pmi-card text-lg font-black">
        MTR request form
      </Link>
      <p className="font-bold">
        {onFile} on file · {missing} missing
      </p>
      {note ? (
        <p role="status" className="border-2 border-pmi-border bg-pmi-card p-3 font-bold">
          {note}
        </p>
      ) : null}
      {rows.length === 0 ? (
        <p className="border-2 border-pmi-border bg-pmi-card p-3 font-bold">
          No material received yet. Log a delivery on Daily receive, then attach MTRs here.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.materialId} className="border-2 border-pmi-border bg-pmi-card p-3">
              <p className="pmi-code font-black">{row.materialCode}</p>
              <p className="font-bold">{row.description}</p>
              <p className="text-sm">Heat {row.heatNumber || '—'} · {row.manufacturer || 'Manufacturer not entered'}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <VerificationBadge status={row.verificationStatus} />
                <span className={row.paperwork === 'on_file' ? 'pmi-chip' : 'pmi-chip pmi-chip-hold'}>{PAPERWORK[row.paperwork]}</span>
              </div>
              {row.documentId ? (
                <div className="mt-3">
                  <StoredImage documentId={row.documentId} alt="MTR photo" />
                </div>
              ) : null}
              <div className="mt-3">
                <CaptureActions
                  cameraLabel={`MTR camera ${row.materialCode}`}
                  uploadLabel={`Upload MTR photo ${row.materialCode}`}
                  onFile={(file) => {
                    void captureImage(file, {
                      docType: 'mtr',
                      subjectType: 'material',
                      subjectId: row.materialId,
                      role: 'mtr',
                      caption: `MTR ${row.heatNumber || row.materialCode}`,
                    }).then((id) => {
                      setNote(
                        id
                          ? 'MTR image stored on this device. Material was not marked acceptable.'
                          : 'Name the project on Home before storing an MTR.',
                      );
                    });
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      {snapshot.mtrRequests.length > 0 ? (
        <section aria-labelledby="mtr-requests">
          <h2 id="mtr-requests" className="pmi-sheet-title">
            MTR requests
          </h2>
          <ul className="mt-2 space-y-2">
            {snapshot.mtrRequests.map((request) => (
              <li key={request.id} className="border-2 border-pmi-border bg-pmi-card p-3 text-sm">
                <p className="font-bold">{request.vendor || 'Vendor not entered'}</p>
                <p>{request.statusNote}</p>
                <p>
                  {request.lines.length} line{request.lines.length === 1 ? '' : 's'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
