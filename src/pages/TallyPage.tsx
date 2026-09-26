import { useMemo, useRef, useState } from 'react';
import { collectMaterialCodes, nextMaterialCode } from '../domain/ids';
import {
  blankPipeJointInput,
  formatFeet,
  tallyToCsv,
  tallyToExcel,
  tallyTotals,
  type PipeJointInput,
} from '../domain/tally';
import type { PipeJointRecord } from '../domain/types';
import { downloadTextFile } from '../lib/download';
import { useApp } from '../state/AppState';
import { CustodySelect, DeliverySelect, FormErrors } from '../components/forms';
import { CustodyChip, SheetHeader, VerificationBadge, codeControlClass, codeFieldProps, controlClass, Field } from '../components/ui';

interface Defaults {
  diameter: string;
  wallThickness: string;
  grade: string;
  specification: string;
  manufacturer: string;
  coating: string;
  deliveryId: string | null;
  expectedLengthFt: string;
  notes: string;
  custodyStatus: PipeJointInput['custodyStatus'];
}

function suggestedDefaults(joints: readonly PipeJointRecord[]): Defaults {
  const source = [...joints].reverse().find((joint) => joint.custodyStatus !== 'expected') ?? joints[0];
  return {
    diameter: source?.diameter ?? '',
    wallThickness: source?.wallThickness ?? '',
    grade: source?.grade ?? '',
    specification: source?.specification ?? '',
    manufacturer: source?.manufacturer ?? '',
    coating: source?.coating ?? '',
    deliveryId: source?.deliveryId ?? null,
    expectedLengthFt: '',
    notes: '',
    custodyStatus: 'received',
  };
}

function defaultsFromJoint(joint: PipeJointRecord): Defaults {
  return {
    diameter: joint.diameter,
    wallThickness: joint.wallThickness,
    grade: joint.grade,
    specification: joint.specification,
    manufacturer: joint.manufacturer,
    coating: joint.coating,
    deliveryId: joint.deliveryId,
    expectedLengthFt: joint.expectedLengthFt === null ? '' : String(joint.expectedLengthFt),
    notes: joint.notes,
    custodyStatus: joint.custodyStatus,
  };
}

export function TallyPage() {
  const { snapshot, savePipeJoint } = useApp();
  const [draft, setDraft] = useState({ jointNumber: '', heatNumber: '', lengthFt: '' });
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const jointRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const totals = useMemo(() => tallyTotals(snapshot?.pipeJoints ?? []), [snapshot]);
  if (!snapshot) return null;
  const loaded = snapshot;

  const activeDefaults = defaults ?? suggestedDefaults(snapshot.pipeJoints);
  const nextCode = nextMaterialCode('pipe', collectMaterialCodes(snapshot));
  const ordered = [...snapshot.pipeJoints].sort((a, b) =>
    a.jointNumber.localeCompare(b.jointNumber, undefined, { numeric: true }),
  );

  function patchDefaults(patch: Partial<Defaults>) {
    setDefaults({ ...activeDefaults, ...patch });
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input: PipeJointInput = {
      ...blankPipeJointInput(),
      ...activeDefaults,
      id: editingId ?? undefined,
      jointNumber: draft.jointNumber,
      heatNumber: draft.heatNumber,
      lengthFt: draft.lengthFt,
    };
    const nextErrors = savePipeJoint(input);
    setErrors(nextErrors);
    if (nextErrors.length > 0) {
      setNotice('');
      return;
    }
    const label = draft.jointNumber.trim();
    setNotice(editingId ? `${label} updated. REVIEW REQUIRED.` : `${label} added. REVIEW REQUIRED.`);
    setEditingId(null);
    setDraft({ jointNumber: '', heatNumber: draft.heatNumber, lengthFt: '' });
    setDefaults({ ...activeDefaults, expectedLengthFt: '', notes: '', custodyStatus: 'received' });
    window.setTimeout(() => jointRef.current?.focus(), 0);
  }

  function editJoint(joint: PipeJointRecord) {
    setEditingId(joint.id);
    setDraft({
      jointNumber: joint.jointNumber,
      heatNumber: joint.heatNumber,
      lengthFt: joint.lengthFt === null ? '' : String(joint.lengthFt),
    });
    setDefaults(defaultsFromJoint(joint));
    setErrors([]);
    setNotice('');
    window.setTimeout(() => {
      if (detailsRef.current) detailsRef.current.open = true;
      jointRef.current?.focus();
    }, 0);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft({ jointNumber: '', heatNumber: '', lengthFt: '' });
    setDefaults(suggestedDefaults(loaded.pipeJoints));
    setErrors([]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Pipe tally</h1>
        <p className="mt-1 text-sm text-pmi-muted">
          Joint number, heat, and length. Footage is added only from lengths you enter. Joint count skips rows still marked EXPECTED.
        </p>
      </div>

      <section aria-label="Tally totals" className="pmi-tally-bar">
        <Stat label="Joint count" testId="tally-joint-count" value={String(totals.jointCount)} />
        <Stat label="Total footage" testId="tally-total-footage" value={`${formatFeet(totals.totalFootage)} ft`} />
        <Stat
          label="Avg length"
          testId="tally-average-length"
          value={totals.averageLength === null ? '—' : `${formatFeet(totals.averageLength)} ft`}
        />
        <div>
          <span className="pmi-tally-label">Expected</span>
          <span data-testid="tally-expected-footage" className="pmi-tally-value pmi-code">
            {formatFeet(totals.expectedFootage)} ft
          </span>
        </div>
        <div>
          <span className="pmi-tally-label">Received</span>
          <span data-testid="tally-received-footage" className="pmi-tally-value pmi-code">
            {formatFeet(totals.receivedFootage)} ft
          </span>
        </div>
        <div>
          <span className="pmi-tally-label">Difference</span>
          <span data-testid="tally-footage-difference" className="pmi-tally-value pmi-code">
            {formatFeet(totals.footageDifference)} ft
          </span>
        </div>
      </section>
      <p className="text-sm text-pmi-muted">
        Received footage minus expected footage. REVIEW REQUIRED. This comparison does not accept the pipe.
      </p>

      <form className="space-y-3" onSubmit={onSubmit}>
        <SheetHeader>{editingId ? 'MARKINGS — EDIT JOINT' : 'MARKINGS'}</SheetHeader>
        <FormErrors errors={errors} />
        {notice ? (
          <p role="status" className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3 font-bold">
            {notice}
          </p>
        ) : null}
        <p className="pmi-code text-sm font-bold">Material ID {editingId ? ordered.find((joint) => joint.id === editingId)?.materialCode : nextCode}</p>
        <Field label="Joint number">
          <input
            ref={jointRef}
            className={`${codeControlClass} min-h-14 text-2xl`}
            inputMode="text"
            {...codeFieldProps}
            value={draft.jointNumber}
            onChange={(event) => setDraft({ ...draft, jointNumber: event.target.value })}
          />
        </Field>
        <Field label="Heat">
          <input
            className={`${codeControlClass} min-h-14 text-2xl`}
            {...codeFieldProps}
            value={draft.heatNumber}
            onChange={(event) => setDraft({ ...draft, heatNumber: event.target.value })}
          />
        </Field>
        <Field label="Length ft" hint="Feet. Leave no guess if the joint was not measured.">
          <input
            className={`${codeControlClass} min-h-14 text-2xl`}
            inputMode="decimal"
            value={draft.lengthFt}
            onChange={(event) => setDraft({ ...draft, lengthFt: event.target.value })}
          />
        </Field>
        <details ref={detailsRef} className="rounded-2xl border-2 border-pmi-border p-3">
          <summary className="min-h-12 cursor-pointer text-base font-bold">Diameter, wall, grade, and coating</summary>
          <div className="mt-3 space-y-3">
            <Field label="Diameter">
              <input className={controlClass} inputMode="decimal" value={activeDefaults.diameter} onChange={(event) => patchDefaults({ diameter: event.target.value })} />
            </Field>
            <Field label="Wall">
              <input
                className={controlClass}
                value={activeDefaults.wallThickness}
                onChange={(event) => patchDefaults({ wallThickness: event.target.value })}
              />
            </Field>
            <Field label="Grade">
              <input className={controlClass} value={activeDefaults.grade} onChange={(event) => patchDefaults({ grade: event.target.value })} />
            </Field>
            <Field label="Specification">
              <input
                className={controlClass}
                value={activeDefaults.specification}
                onChange={(event) => patchDefaults({ specification: event.target.value })}
              />
            </Field>
            <Field label="Manufacturer">
              <input
                className={controlClass}
                value={activeDefaults.manufacturer}
                onChange={(event) => patchDefaults({ manufacturer: event.target.value })}
              />
            </Field>
            <Field label="Coating">
              <input className={controlClass} value={activeDefaults.coating} onChange={(event) => patchDefaults({ coating: event.target.value })} />
            </Field>
            <Field label="Expected length ft">
              <input
                className={codeControlClass}
                inputMode="decimal"
                value={activeDefaults.expectedLengthFt}
                onChange={(event) => patchDefaults({ expectedLengthFt: event.target.value })}
              />
            </Field>
            <SheetHeader>DELIVERY</SheetHeader>
            <DeliverySelect
              deliveries={snapshot.deliveries}
              value={activeDefaults.deliveryId}
              onChange={(deliveryId) => patchDefaults({ deliveryId })}
            />
            {editingId ? (
              <>
                <SheetHeader>CONDITION</SheetHeader>
                <CustodySelect value={activeDefaults.custodyStatus} onChange={(custodyStatus) => patchDefaults({ custodyStatus })} />
              </>
            ) : null}
            <Field label="Notes">
              <textarea className={controlClass} rows={2} value={activeDefaults.notes} onChange={(event) => patchDefaults({ notes: event.target.value })} />
            </Field>
          </div>
        </details>
        <button type="submit" className="min-h-14 w-full rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text">
          {editingId ? 'Save joint' : 'Add joint'}
        </button>
        {editingId ? (
          <button type="button" className="min-h-14 w-full rounded-2xl border-2 border-pmi-border text-lg font-bold" onClick={cancelEdit}>
            Cancel edit
          </button>
        ) : null}
      </form>

      <FootageGroups title="Footage by heat" buckets={totals.byHeat} />
      <FootageGroups title="Footage by grade" buckets={totals.byGrade} />
      <FootageGroups title="Footage by wall" buckets={totals.byWall} />

      <section aria-labelledby="joint-list">
        <h2 id="joint-list" className="pmi-sheet-title">
          Joints
        </h2>
        <div className="pmi-tally-sheet mt-2">
          <div className="pmi-tally-head" aria-hidden="true">
            <span>JT</span>
            <span>HEAT</span>
            <span>FT</span>
          </div>
          <ul>
            {ordered.map((joint) => (
              <li key={joint.id}>
                <button type="button" className="pmi-tally-row" onClick={() => editJoint(joint)}>
                  <span className="pmi-code text-base font-black">{joint.jointNumber}</span>
                  <span className="pmi-code text-sm font-bold">{joint.heatNumber || '—'}</span>
                  <span className="pmi-code text-base font-black">
                    {joint.custodyStatus === 'expected' || joint.lengthFt === null ? '—' : formatFeet(joint.lengthFt)}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2 border-t border-pmi-border px-2 py-2">
                  <CustodyChip status={joint.custodyStatus} />
                  <VerificationBadge status={joint.verificationStatus} />
                  <span className="pmi-code text-xs text-pmi-muted">
                    {joint.materialCode}
                    {joint.grade ? ` · ${joint.grade}` : ''}
                    {joint.wallThickness ? ` · W ${joint.wallThickness}` : ''}
                    {joint.expectedLengthFt !== null ? ` · EXP ${formatFeet(joint.expectedLengthFt)}` : ''}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2">
        <button
          type="button"
          className="min-h-14 rounded-2xl border-2 border-pmi-border bg-pmi-card text-lg font-bold"
          onClick={() => downloadTextFile('pipe-tally.csv', 'text/csv;charset=utf-8', tallyToCsv(snapshot.pipeJoints))}
        >
          Export CSV
        </button>
        <button
          type="button"
          className="min-h-14 rounded-2xl border-2 border-pmi-border bg-pmi-card text-lg font-bold"
          onClick={() => downloadTextFile('pipe-tally.xls', 'application/vnd.ms-excel', tallyToExcel(snapshot.pipeJoints))}
        >
          Export Excel
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div>
      <span className="pmi-tally-label">{label}</span>
      <span data-testid={testId} className="pmi-tally-value pmi-code">
        {value}
      </span>
    </div>
  );
}

function FootageGroups({
  title,
  buckets,
}: {
  title: string;
  buckets: Array<{ label: string; jointCount: number; footage: number }>;
}) {
  const headingId = title.toLowerCase().replace(/\s+/g, '-');
  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className="pmi-sheet-title">
        {title}
      </h2>
      {buckets.length === 0 ? (
        <p className="mt-1 text-sm text-pmi-muted">No lengths recorded.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {buckets.map((bucket) => (
            <li key={bucket.label} className="flex min-h-12 items-center justify-between gap-3 border-2 border-pmi-border bg-pmi-card px-3">
              <span className="pmi-code font-bold">{bucket.label}</span>
              <span className="pmi-code">
                {formatFeet(bucket.footage)} ft · {bucket.jointCount}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
