import { useEffect, useState } from 'react';
import { CoordinatorNav } from '../components/CoordinatorNav';
import { Field, VerificationBadge, controlClass } from '../components/ui';
import {
  MASTER_LIST_LAYOUT,
  formatMasterFormula,
  orderedQty,
  receivedQty,
  type MasterField,
} from '../domain/master-list';
import { parseTrackerMatrix, type ParsedTracker, type ParsedTrackerRow, type TrackerEditField } from '../domain/tracker';
import type { TrackerRow, TrackerSheet } from '../domain/types';
import { readBlob } from '../lib/blob';
import { downloadMasterList } from '../lib/master-list-file';
import { useApp } from '../state/AppState';

const PREVIEW: Array<[string, keyof ParsedTrackerRow]> = [
  ['Item', 'item'],
  ['QTY-Ordered', 'qtyOrdered'],
  ['QTY-Received', 'qtyReceived'],
  ['Material Type', 'materialType'],
  ['Size (Inches)', 'sizeInches'],
  ['Material Description', 'description'],
  ['Wall / SDR', 'wallSdr'],
  ['Grade', 'steelGrade'],
  ['Manufacturer', 'manufacturer'],
  ['Model Number', 'modelNumber'],
  ['Serial / Lot / Heat #', 'serialLotHeat'],
  ['ANSI / Pressure Rating', 'ansiPressureRating'],
];

function formulaText(row: TrackerRow, field: MasterField): string {
  if (field === 'difference') return formatMasterFormula(receivedQty(row), orderedQty(row));
  if (field === 'remaining') return formatMasterFormula(receivedQty(row), row.qtyUsed);
  return '';
}

function cellValue(row: TrackerRow, field: MasterField): string {
  if (field === 'qtyOrdered') return orderedQty(row);
  if (field === 'qtyReceived') return receivedQty(row);
  if (field === 'difference' || field === 'remaining') return formulaText(row, field);
  return row[field];
}

function CellInput({
  value,
  label,
  wide,
  onCommit,
}: {
  value: string;
  label: string;
  wide?: boolean;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      className={wide ? 'pmi-master-wide' : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

function MasterTable({ rows }: { rows: TrackerRow[] }) {
  const { updateTrackerCell } = useApp();
  return (
    <div className="pmi-master" data-testid="master-list-table">
      <table>
        <thead>
          <tr>
            <th scope="col">Status</th>
            {MASTER_LIST_LAYOUT.map((column) => (
              <th key={column.header} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <VerificationBadge status={row.verificationStatus} />
                {row.uncertain ? <span className="pmi-chip pmi-chip-hold">REVIEW REQUIRED</span> : null}
              </td>
              {MASTER_LIST_LAYOUT.map((column) => {
                const label = `${column.header} item ${row.item}`;
                if (column.field === 'difference' || column.field === 'remaining') {
                  return <td key={column.header}>{formulaText(row, column.field)}</td>;
                }
                return (
                  <td key={column.header}>
                    <CellInput
                      value={cellValue(row, column.field)}
                      label={label}
                      wide={column.field === 'description' || column.field === 'notes'}
                      onCommit={(value) => updateTrackerCell(row.id, column.field as TrackerEditField, value)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HeaderFields({ tracker }: { tracker: TrackerSheet }) {
  const { updateTrackerHeader } = useApp();
  const fields: Array<[keyof Pick<TrackerSheet, 'projectName' | 'projectNumber' | 'sheetDate' | 'inspector'>, string]> = [
    ['projectName', 'Project Name'],
    ['projectNumber', 'Project #'],
    ['sheetDate', 'Date'],
    ['inspector', 'Inspector'],
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {fields.map(([key, label]) => (
        <Field key={key} label={label}>
          <input
            className={controlClass}
            defaultValue={tracker[key]}
            key={`${key}-${tracker[key]}`}
            onBlur={(event) => {
              if (event.target.value !== tracker[key]) updateTrackerHeader({ [key]: event.target.value });
            }}
          />
        </Field>
      ))}
    </div>
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
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Master List</p>
        <h1 className="text-3xl font-black leading-none">Material Handling Tracking</h1>
        <p className="mt-2 text-sm text-pmi-muted">
          Live tracker on this device. Receive material to append the next Item. Difference and Remaining follow the sheet formulas. Nothing here accepts material.
        </p>
      </div>
      <CoordinatorNav />
      <HeaderFields tracker={tracker} />
      <button
        type="button"
        className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text"
        onClick={() => downloadMasterList(tracker)}
      >
        Export Master List
      </button>
      <section aria-labelledby="tracker-saved">
        <h2 id="tracker-saved" className="pmi-sheet-title">
          Master List
        </h2>
        <p className="mt-2 font-bold">
          {tracker.rows.length} item{tracker.rows.length === 1 ? '' : 's'}
          {tracker.projectName ? ` · ${tracker.projectName}` : ''}
          {tracker.projectNumber ? ` · Project # ${tracker.projectNumber}` : ''}
        </p>
        {tracker.constructionOrderNo ? <p className="text-sm font-bold">Construction Order No {tracker.constructionOrderNo}</p> : null}
        {tracker.sourceFileName ? <p className="text-sm">{tracker.sourceFileName}</p> : null}
        {(tracker.projectName || tracker.projectNumber || tracker.inspector || tracker.constructionOrderNo) && (
          <button
            type="button"
            className="mt-2 min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-black"
            onClick={() => {
              saveProject({
                ...snapshot.project,
                name: tracker.projectName || snapshot.project.name,
                constructionOrderNo: tracker.constructionOrderNo || snapshot.project.constructionOrderNo,
                projectNumber: tracker.projectNumber || snapshot.project.projectNumber,
                inspectorName: tracker.inspector || snapshot.project.inspectorName,
              });
              setMessage('Sheet header copied onto the project. Material was not accepted.');
            }}
          >
            Copy sheet header onto project
          </button>
        )}
        {tracker.rows.length === 0 ? (
          <p className="mt-2 border-2 border-pmi-border bg-pmi-card p-3 font-bold">No Master List rows on this device.</p>
        ) : (
          <div className="mt-2">
            <MasterTable rows={tracker.rows} />
          </div>
        )}
      </section>
      <Field
        label="Upload tracking sheet"
        hint="Excel or CSV. A workbook with a Master List sheet is read from that sheet. Blank template rows are skipped. Saving replaces the rows on this device."
      >
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
            Project Name {pending.projectName || '—'} · Project # {pending.projectNumber || '—'} · Date {pending.sheetDate || '—'} · Inspector{' '}
            {pending.inspector || '—'}
          </p>
          {pending.constructionOrderNo ? <p className="font-bold">Construction Order No {pending.constructionOrderNo}</p> : null}
          <p className="text-sm">{fileName}</p>
          {tracker.rows.length > 0 ? <p className="pmi-flag">Saving replaces the tracker rows on this device.</p> : null}
          <ul className="space-y-2">
            {pending.rows.map((row, index) => (
              <li key={`${row.item}-${index}`}>
                <article className="border-2 border-pmi-border bg-pmi-card p-3">
                  <p className="text-lg font-black">{row.description || 'No description'}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    {PREVIEW.map(([label, key]) => (
                      <div key={label}>
                        <dt className="font-black uppercase tracking-wide text-pmi-muted">{label}</dt>
                        <dd className="font-bold">{row[key] || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </article>
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
    </div>
  );
}
