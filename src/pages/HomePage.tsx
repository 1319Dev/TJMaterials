import { useState } from 'react';
import { Link } from 'react-router-dom';
import { localIsoDate, formatWhen } from '../domain/dates';
import {
  damagedMaterials,
  deliveriesOnDate,
  heldMaterials,
  materialsReceivedOn,
  missingMtrMaterials,
  summarizeDashboard,
} from '../domain/dashboard';
import { useApp } from '../state/AppState';
import { SpecialtyNav } from '../components/SpecialtyNav';
import { CustodyChip, Field, VerificationBadge, controlClass } from '../components/ui';

type Drill = 'deliveries' | 'received' | 'holds' | 'mtrs' | 'damage' | 'discrepancies';

export function HomePage() {
  const { snapshot, saveProject } = useApp();
  const [drill, setDrill] = useState<Drill | null>(null);
  const [name, setName] = useState('');
  const [projectNumber, setProjectNumber] = useState('');
  const [nameError, setNameError] = useState('');
  if (!snapshot) return null;
  if (!snapshot.project.name.trim()) {
    return (
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const errors = saveProject({ ...snapshot.project, name, projectNumber });
          setNameError(errors[0] ?? '');
        }}
      >
        <h1 className="text-2xl font-black">Start a project</h1>
        <p className="text-sm text-pmi-muted">
          The project starts empty. Joints, fittings, flanges, and valves appear only after you receive them.
        </p>
        {nameError ? (
          <p role="alert" className="pmi-flag">
            {nameError}
          </p>
        ) : null}
        <Field label="Project name">
          <input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Project number">
          <input className={`${controlClass} pmi-code`} value={projectNumber} onChange={(event) => setProjectNumber(event.target.value)} />
        </Field>
        <button type="submit" className="min-h-14 w-full bg-pmi-accent text-lg font-black text-pmi-accent-text">
          Save project
        </button>
      </form>
    );
  }

  const today = localIsoDate();
  const summary = summarizeDashboard(snapshot, today);
  const tiles: Array<{ id: Drill; label: string; value: number }> = [
    { id: 'deliveries', label: "TODAY'S DELIVERIES", value: summary.todaysDeliveries },
    { id: 'received', label: 'MATERIAL RECEIVED TODAY', value: summary.materialReceivedToday },
    { id: 'holds', label: 'MATERIAL ON HOLD', value: summary.materialOnHold },
    { id: 'mtrs', label: 'MISSING MTRs', value: summary.missingMtrs },
    { id: 'damage', label: 'DAMAGED MATERIAL', value: summary.damagedMaterial },
    { id: 'discrepancies', label: 'OPEN DISCREPANCIES', value: summary.openDiscrepancies },
  ];

  return (
    <div className="space-y-3">
      <section className="border-2 border-pmi-border border-l-[6px] border-l-pmi-ink bg-pmi-card px-3 py-3" aria-labelledby="project-heading">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Project</p>
        <h1 id="project-heading" className="mt-1 text-3xl font-black leading-none tracking-tight">
          {summary.projectName}
        </h1>
        <p className="pmi-code mt-2 text-xl font-bold">{snapshot.project.projectNumber}</p>
        <p className="mt-1 text-sm font-bold">
          {snapshot.project.atmosProjectNumber} · CO {snapshot.project.constructionOrderNo}
        </p>
        <p className="text-sm text-pmi-muted">{snapshot.project.inspectorName}</p>
        {snapshot.materials.length === 0 && !snapshot.settings.sample ? (
          <p className="mt-2 text-sm font-bold">No material received yet.</p>
        ) : null}
      </section>

      <SpecialtyNav />

      <section aria-label="Today">
        <div className="grid grid-cols-2 gap-2">
          {tiles.map((tile) => {
            const alert = tile.id === 'holds' || tile.id === 'damage' || tile.id === 'discrepancies' || tile.id === 'mtrs';
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => setDrill((current) => (current === tile.id ? null : tile.id))}
                aria-pressed={drill === tile.id}
                className={`pmi-stat ${alert ? 'pmi-stat-alert' : ''}`}
              >
                <span className="block text-xs font-black uppercase leading-tight tracking-wide">{tile.label}</span>
                <span className="pmi-code mt-1 block text-3xl font-black">{tile.value}</span>
              </button>
            );
          })}
        </div>
        {drill ? <DrillList drill={drill} today={today} /> : null}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="pmi-sheet-title">
          RECENT INSPECTIONS
        </h2>
        <ul className="mt-2 space-y-1">
          {summary.recentInspections.map((entry) => (
            <li key={entry.id} className="border-2 border-pmi-border bg-pmi-card px-3 py-2">
              <p className="text-base font-semibold">{entry.summary}</p>
              <p className="mt-1 text-sm text-pmi-muted">{formatWhen(entry.createdAt)}</p>
              {entry.verificationStatus ? (
                <div className="mt-2">
                  <VerificationBadge status={entry.verificationStatus} />
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="pmi-dock fixed inset-x-0 z-20 mx-auto max-w-lg px-4" style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom))' }}>
        <Link
          to="/receive"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-pmi-accent text-lg font-black text-pmi-accent-text"
        >
          + RECEIVE MATERIAL
        </Link>
      </div>
    </div>
  );
}

function DrillList({ drill, today }: { drill: Drill; today: string }) {
  const { snapshot } = useApp();
  if (!snapshot) return null;

  if (drill === 'deliveries') {
    const rows = deliveriesOnDate(snapshot, today);
    return (
      <ul className="mt-3 space-y-2" aria-label="Today’s deliveries">
        {rows.map((delivery) => (
          <li key={delivery.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
            <p className="font-bold">{delivery.bolNumber || delivery.packingSlipNumber || 'No bill of lading number'}</p>
            <p className="text-sm">
              {delivery.vendor} · {delivery.status === 'received' ? 'RECEIVED' : 'EXPECTED'} · Shipment # (MRC){' '}
              {delivery.shipmentNumberMrc || '—'}
            </p>
          </li>
        ))}
      </ul>
    );
  }

  if (drill === 'discrepancies') {
    const rows = snapshot.discrepancies.filter((item) => item.status === 'open');
    return (
      <ul className="mt-3 space-y-2" aria-label="Open discrepancies">
        {rows.map((item) => (
          <li key={item.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
            <p className="font-bold">{item.title}</p>
            <p className="text-sm">{item.description}</p>
            <div className="mt-2">
              <VerificationBadge status={item.verificationStatus} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const materials =
    drill === 'received'
      ? materialsReceivedOn(snapshot, today)
      : drill === 'holds'
        ? heldMaterials(snapshot)
        : drill === 'mtrs'
          ? missingMtrMaterials(snapshot)
          : damagedMaterials(snapshot);

  return (
    <ul className="mt-3 space-y-2" aria-label="Matching material">
      {materials.map((material) => (
          <li key={material.id} className="border-2 border-pmi-border bg-pmi-card px-3 py-2">
          <p className="pmi-code font-bold">{material.materialCode}</p>
          <p className="text-sm">{material.description}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
            <CustodyChip status={material.custodyStatus} />
            {material.heatNumber ? <span className="pmi-code">Heat {material.heatNumber}</span> : null}
          </p>
          <div className="mt-2">
            <VerificationBadge status={material.verificationStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
}
