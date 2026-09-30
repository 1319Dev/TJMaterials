import { Link } from 'react-router-dom';
import { CoordinatorNav } from '../components/CoordinatorNav';
import { VerificationBadge } from '../components/ui';
import { localIsoDate } from '../domain/dates';
import { deliveriesOnDate } from '../domain/dashboard';
import { useApp } from '../state/AppState';

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function DailyReceivePage() {
  const { snapshot } = useApp();
  if (!snapshot) return null;
  const today = localIsoDate();
  const deliveries = deliveriesOnDate(snapshot, today);

  return (
    <div className="space-y-4" data-testid="daily-receive">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.16em] text-pmi-muted">Coordinator</p>
        <h1 className="text-3xl font-black leading-none">Daily materials receive</h1>
        <p className="mt-2 text-lg font-bold">{formatDay(today)}</p>
        <p className="mt-1 text-sm text-pmi-muted">
          Today’s deliveries on this device. Logging a delivery uses the receive form and stays REVIEW REQUIRED.
        </p>
      </div>
      <CoordinatorNav />
      <Link
        to="/receive?from=daily"
        className="flex min-h-16 items-center justify-center bg-pmi-accent text-lg font-black text-pmi-accent-text"
      >
        Log today&apos;s delivery
      </Link>
      <section aria-labelledby="today-log">
        <h2 id="today-log" className="pmi-sheet-title">
          Today&apos;s log
        </h2>
        {deliveries.length === 0 ? (
          <p className="mt-2 border-2 border-pmi-border bg-pmi-card p-3 font-bold">No deliveries logged for today.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {deliveries.map((delivery) => {
              const lines = snapshot.materials.filter((material) => material.deliveryId === delivery.id);
              return (
                <li key={delivery.id} className="border-2 border-pmi-border bg-pmi-card p-3">
                  <p className="text-lg font-black">{delivery.vendor || 'Vendor not entered'}</p>
                  <p className="pmi-code mt-1 text-sm font-bold">
                    BOL {delivery.bolNumber || '—'} · Slip {delivery.packingSlipNumber || '—'}
                  </p>
                  <p className="text-sm">Shipment # (MRC) {delivery.shipmentNumberMrc || '—'}</p>
                  <p className="mt-1 text-sm font-bold">{delivery.status === 'received' ? 'RECEIVED' : 'EXPECTED'}</p>
                  <ul className="mt-2 space-y-2">
                    {lines.map((material) => (
                      <li key={material.id}>
                        <p className="font-bold">{material.description}</p>
                        <p className="pmi-code text-sm">{material.materialCode}</p>
                        <div className="mt-1">
                          <VerificationBadge status={material.verificationStatus} />
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Link to="/packing-slips" className="mt-3 inline-flex min-h-12 items-center text-base font-black underline">
                    Packing slip photos
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
