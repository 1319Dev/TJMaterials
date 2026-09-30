import { useState } from 'react';
import { CoordinatorNav } from '../components/CoordinatorNav';
import { Field, VerificationBadge, controlClass } from '../components/ui';
import { parseTrackerMatrix, type ParsedTracker, type ParsedTrackerRow } from '../domain/tracker';
import type { TrackerRow } from '../domain/types';
import { readBlob } from '../lib/blob';
import { useApp } from '../state/AppState';

const COLUMNS: Array<[string, keyof ParsedTrackerRow]> = [
  ['Item', 'item'],
  ['QTY', 'qty'],
  ['Size (Inches)', 'sizeInches'],
  ['Description', 'description'],
  ['Wall/SDR', 'wallSdr'],
  ['Steel Grade', 'steelGrade'],
  ['Manufacturer', 'manufacturer'],
  ['Model Number', 'modelNumber'],
  ['Serial/Lot/Heat #', 'serialLotHeat'],
  ['ANSI/Pressure Rating', 'ansiPressureRating'],
];

function RowCard({ row, badge }: { row: ParsedTrackerRow; badge?: TrackerRow }) {
  return (
    <article className="border-2 border-pmi-border bg-pmi-card p-3">
      <p className="text-lg font-black">{row.description || 'No description'}</p>
      {badge ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <VerificationBadge status={badge.verificationStatus} />
          {badge.uncertain ? <span className="pmi-chip pmi-chip-hold">REVIEW REQUIRED</span> : null}
          <span className="pmi-chip">{badge.source === 'ocr' ? 'OCR' : badge.source === 'import' ? 'SHEET' : 'MANUAL'}</span>
          {badge.confidence !== null ? <span className="pmi-chip">{Math.round(badge.confidence * 100)}%</span> : null}
        </div>
      ) : null}
      <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {COLUMNS.map(([label, key]) => (
          <div key={label}>
            <dt className="font-black uppercase tracking-wide text-pmi-muted">{label}</dt>
            <dd className="font-bold">{row[key] || '—'}</dd>
          </div>
        ))}
      </dl>
      {badge?.reviewNote ? <p className="mt-2 text-sm">{badge.reviewNote}</p> : null}
    </article>
  );
}

export function TrackerPage() {
  const { snapshot, saveTracker, saveProject } = useApp();
  const [pending, setPending] = useState<ParsedTracker | null>(null);
  const [fileName, setFileName] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  if (!snapshot) return null;
  const tracker = snapshot.tracker;

  async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    setMessage('');
    if (!file) return;
    const { workbookToMatrix } = await import('../lib/spreadsheet');
    const matrix = workbookToMatrix(await readBlob(file));
    const parsed = parseTrackerMatrix(matrix);
    setFileName(file.name);
    setPending(parsed);
    setErrors(parsed.errors);
  }

  return (
    <div className="space-y-4" data-testid="tracker-sheet">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Coordinator</p>
        <h1 className="text-3xl font-black leading-none">Materials tracking sheet</h1>
        <p className="mt-2 text-sm text-pmi-muted">
          Upload the bill of materials workbook. It stays on this device and does not accept material.
        </p>
      </div>
      <CoordinatorNav />
      <Field label="Upload tracking sheet" hint="Excel or CSV. Columns: Item, QTY, Size (Inches), Description, Wall/SDR, Steel Grade, Manufacturer, Model Number, Serial/Lot/Heat #, ANSI/Pressure Rating.">
        <input
          className={controlClass}
          type="file"
          accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => void onFile(event)}
        />
      </Field>
      {errors.map((error) => (
        <p key={error} role="alert" className="pmi-flag">
          {error}
        </p>
      ))}
      {pending && pending.errors.length === 0 ? (
        <section className="space-y-3" aria-labelledby="tracker-preview">
          <h2 id="tracker-preview" className="pmi-sheet-title">
            Sheet preview
          </h2>
          <p className="font-bold">
            Construction Order No {pending.constructionOrderNo || '—'} · Project Number {pending.projectNumber || '—'}
          </p>
          <p className="text-sm">{fileName}</p>
          {tracker.rows.length > 0 ? (
            <p className="pmi-flag">Saving replaces the tracker rows on this device.</p>
          ) : null}
          <ul className="space-y-2">
            {pending.rows.map((row, index) => (
              <li key={`${row.item}-${index}`}>
                <RowCard row={row} />
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text"
            onClick={() => {
              const result = saveTracker(pending, fileName);
              setErrors(result.errors);
              if (result.errors.length === 0) {
                setMessage(`Saved on this device. ${result.rowCount} row${result.rowCount === 1 ? '' : 's'}. Material was not accepted.`);
                setPending(null);
              }
            }}
          >
            Save tracker on this device
          </button>
        </section>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      <section aria-labelledby="tracker-saved">
        <h2 id="tracker-saved" className="pmi-sheet-title">
          Job tracker
        </h2>
        <p className="mt-2 font-bold">
          Construction Order No {tracker.constructionOrderNo || '—'} · Project Number {tracker.projectNumber || '—'}
        </p>
        {tracker.sourceFileName ? <p className="text-sm">{tracker.sourceFileName}</p> : null}
        {(tracker.constructionOrderNo || tracker.projectNumber) && (
          <button
            type="button"
            className="mt-2 min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-black"
            onClick={() => {
              saveProject({
                ...snapshot.project,
                constructionOrderNo: tracker.constructionOrderNo || snapshot.project.constructionOrderNo,
                projectNumber: tracker.projectNumber || snapshot.project.projectNumber,
              });
              setMessage('Sheet header copied onto the project. Material was not accepted.');
            }}
          >
            Copy sheet header onto project
          </button>
        )}
        {tracker.rows.length === 0 ? (
          <p className="mt-2 border-2 border-pmi-border bg-pmi-card p-3 font-bold">No tracker rows on this device.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {tracker.rows.map((row) => (
              <li key={row.id}>
                <RowCard row={row} badge={row} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
