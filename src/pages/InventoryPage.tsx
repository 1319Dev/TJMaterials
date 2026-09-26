import { useSearchParams } from 'react-router-dom';
import { filterMaterials, type InventoryFilter } from '../domain/dashboard';
import { localIsoDate } from '../domain/dates';
import { CATEGORY_LABELS, CUSTODY_LABELS } from '../domain/labels';
import { useApp } from '../state/AppState';
import { VerificationBadge } from '../components/ui';

const filters: Array<{ id: InventoryFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'pipe', label: 'Pipe' },
  { id: 'fitting', label: 'Fittings' },
  { id: 'flange', label: 'Flanges' },
  { id: 'valve', label: 'Valves' },
  { id: 'received-today', label: 'Received today' },
  { id: 'on-hold', label: 'On hold' },
  { id: 'missing-mtr', label: 'Missing MTRs' },
  { id: 'damaged', label: 'Damaged' },
];

function parseFilter(value: string | null): InventoryFilter {
  return filters.some((filter) => filter.id === value) ? (value as InventoryFilter) : 'all';
}

export function InventoryPage() {
  const { snapshot } = useApp();
  const [params, setParams] = useSearchParams();
  if (!snapshot) return null;
  const filter = parseFilter(params.get('filter'));
  const today = localIsoDate();
  const materials = filterMaterials(snapshot, filter, today);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">Inventory</h1>
      <div className="flex gap-2 overflow-x-auto pb-1" role="toolbar" aria-label="Inventory filters">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            className={`min-h-12 shrink-0 rounded-full border-2 border-pmi-border px-4 text-sm font-bold ${
              filter === item.id ? 'bg-pmi-accent text-pmi-accent-text' : 'bg-pmi-card'
            }`}
            onClick={() => setParams(item.id === 'all' ? {} : { filter: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-pmi-muted">{materials.length} records</p>
      <ul className="space-y-3">
        {materials.map((material) => {
          const po = snapshot.purchaseOrders.find((item) => item.id === material.purchaseOrderId);
          return (
            <li key={material.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
              <p className="text-lg font-black">{material.materialCode}</p>
              <p>{material.description}</p>
              <p className="text-sm text-pmi-muted">
                {CATEGORY_LABELS[material.category]} · {CUSTODY_LABELS[material.custodyStatus]}
                {material.heatNumber ? ` · Heat ${material.heatNumber}` : ''}
                {material.jointNumber ? ` · Joint ${material.jointNumber}` : ''}
                {material.serialOrLot ? ` · Serial ${material.serialOrLot}` : ''}
                {po ? ` · ${po.poNumber}` : ''}
              </p>
              <p className="text-sm">
                {material.manufacturer || 'Manufacturer not recorded'}
                {material.diameter ? ` · ${material.diameter}"` : ''}
                {material.grade ? ` · ${material.grade}` : ''}
              </p>
              <div className="mt-2">
                <VerificationBadge status={material.verificationStatus} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
