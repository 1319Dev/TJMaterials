import type { AppSnapshot, AuditLogRecord, DeliveryRecord, MaterialRecord } from './types';

export interface DashboardSummary {
  projectName: string;
  todaysDeliveries: number;
  materialReceivedToday: number;
  materialOnHold: number;
  missingMtrs: number;
  damagedMaterial: number;
  openDiscrepancies: number;
  recentInspections: AuditLogRecord[];
}

export function isOnHand(material: MaterialRecord): boolean {
  return material.custodyStatus !== 'expected';
}

export function deliveriesOnDate(snapshot: AppSnapshot, today: string): DeliveryRecord[] {
  return snapshot.deliveries.filter(
    (delivery) => delivery.receivedOn === today || delivery.scheduledOn === today,
  );
}

export function materialsReceivedOn(snapshot: AppSnapshot, today: string): MaterialRecord[] {
  return snapshot.materials.filter((material) => material.receivedOn === today);
}

export function missingMtrMaterials(snapshot: AppSnapshot): MaterialRecord[] {
  return snapshot.materials.filter(
    (material) =>
      isOnHand(material) &&
      (material.verificationStatus === 'missing_documentation' ||
        material.verificationStatus === 'not_provided'),
  );
}

export function heldMaterials(snapshot: AppSnapshot): MaterialRecord[] {
  const ids = new Set(
    snapshot.holds.filter((hold) => hold.status === 'open').map((hold) => hold.materialId),
  );
  return snapshot.materials.filter((material) => ids.has(material.id) || material.custodyStatus === 'on_hold');
}

export function damagedMaterials(snapshot: AppSnapshot): MaterialRecord[] {
  const ids = new Set(
    snapshot.damageReports
      .filter((report) => report.status === 'open')
      .map((report) => report.materialId),
  );
  return snapshot.materials.filter(
    (material) => ids.has(material.id) || material.custodyStatus === 'damaged',
  );
}

export function summarizeDashboard(snapshot: AppSnapshot, today: string): DashboardSummary {
  const recentInspections = snapshot.auditLogs
    .filter((entry) => entry.verificationStatus)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);

  return {
    projectName: snapshot.project.name,
    todaysDeliveries: deliveriesOnDate(snapshot, today).length,
    materialReceivedToday: materialsReceivedOn(snapshot, today).length,
    materialOnHold: snapshot.holds.filter((hold) => hold.status === 'open').length,
    missingMtrs: missingMtrMaterials(snapshot).length,
    damagedMaterial: snapshot.damageReports.filter((report) => report.status === 'open').length,
    openDiscrepancies: snapshot.discrepancies.filter((item) => item.status === 'open').length,
    recentInspections,
  };
}

export type InventoryFilter =
  | 'all'
  | 'pipe'
  | 'fitting'
  | 'flange'
  | 'valve'
  | 'received-today'
  | 'on-hold'
  | 'missing-mtr'
  | 'damaged';

export function filterMaterials(
  snapshot: AppSnapshot,
  filter: InventoryFilter,
  today: string,
): MaterialRecord[] {
  switch (filter) {
    case 'pipe':
    case 'fitting':
    case 'flange':
    case 'valve':
      return snapshot.materials.filter((material) => material.category === filter);
    case 'received-today':
      return materialsReceivedOn(snapshot, today);
    case 'on-hold':
      return heldMaterials(snapshot);
    case 'missing-mtr':
      return missingMtrMaterials(snapshot);
    case 'damaged':
      return damagedMaterials(snapshot);
    default:
      return snapshot.materials;
  }
}
