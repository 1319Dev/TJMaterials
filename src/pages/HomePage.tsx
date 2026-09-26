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
import { CUSTODY_LABELS } from '../domain/labels';
import { useApp } from '../state/AppState';
import { VerificationBadge } from '../components/ui';

type Drill = 'deliveries' | 'received' | 'holds' | 'mtrs' | 'damage' | 'discrepancies';

export function HomePage() {
  const { snapshot } = useApp();
  const [drill, setDrill] = useState<Drill | null>(null);
  if (!snapshot) return null;

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
    <div className="space-y-4">
      <section className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-4" aria-labelledby="project-heading">
        <h1 id="project-heading" className="text-xs font-bold uppercase tracking-wide text-pmi-muted">
          PROJECT
        </h1>
        <p className="mt-1 text-2xl font-black leading-tight">{summary.projectName}</p>
        <p className="mt-2 text-base">
          {snapshot.project.atmosProjectNumber} · {snapshot.project.inspectorName}
        </p>
        <p className="text-sm text-pmi-muted">
          Project Number {snapshot.project.projectNumber} · Construction Order No. {snapshot.project.constructionOrderNo}
        </p>
      </section>

      <section aria-label="Today">
        <div className="grid grid-cols-2 gap-3">
          {tiles.map((tile) => (
            <button
              key={tile.id}
              type="button"
              onClick={() => setDrill((current) => (current === tile.id ? null : tile.id))}
              aria-pressed={drill === tile.id}
              className="min-h-[5.75rem] rounded-2xl border-2 border-pmi-border bg-pmi-card px-3 py-3 text-left"
            >
              <span className="block text-xs font-bold uppercase leading-tight tracking-wide">{tile.label}</span>
              <span className="mt-2 block text-3xl font-black tabular-nums">{tile.value}</span>
            </button>
          ))}
        </div>
        {drill ? <DrillList drill={drill} today={today} /> : null}
      </section>

      <section aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-sm font-bold uppercase tracking-wide">
          RECENT INSPECTIONS
        </h2>
        <ul className="mt-2 space-y-2">
          {summary.recentInspections.map((entry) => (
            <li key={entry.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
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

      <div className="fixed inset-x-0 z-20 mx-auto max-w-lg px-4" style={{ bottom: 'calc(4.25rem + env(safe-area-inset-bottom))' }}>
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
        <li key={material.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
          <p className="font-bold">{material.materialCode}</p>
          <p className="text-sm">{material.description}</p>
          <p className="text-sm text-pmi-muted">
            {CUSTODY_LABELS[material.custodyStatus]}
            {material.heatNumber ? ` · Heat ${material.heatNumber}` : ''}
          </p>
          <div className="mt-2">
            <VerificationBadge status={material.verificationStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
}
