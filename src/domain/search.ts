import type { AppSnapshot, VerificationStatus } from './types';

export interface SearchHit {
  id: string;
  kind: 'Material' | 'Pipe joint' | 'Fitting' | 'Flange' | 'Valve' | 'Delivery' | 'Purchase order' | 'MTR';
  title: string;
  subtitle: string;
  matchedOn: string;
  verificationStatus?: VerificationStatus;
}

function includes(value: string, query: string): boolean {
  return value.trim().toLowerCase().includes(query);
}

function poNumber(snapshot: AppSnapshot, purchaseOrderId: string | null): string {
  if (!purchaseOrderId) return '';
  return snapshot.purchaseOrders.find((po) => po.id === purchaseOrderId)?.poNumber ?? '';
}

export function searchRecords(snapshot: AppSnapshot, rawQuery: string): SearchHit[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];

  const hits: SearchHit[] = [];

  for (const material of snapshot.materials) {
    const fields: Array<[string, string]> = [
      ['Material ID', material.materialCode],
      ['Heat number', material.heatNumber],
      ['Joint', material.jointNumber],
      ['Serial / lot', material.serialOrLot],
      ['Manufacturer', material.manufacturer],
      ['PO', poNumber(snapshot, material.purchaseOrderId)],
      ['Description', material.description],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    const exactId = material.materialCode.toLowerCase() === query;
    hits.push({
      id: `${material.id}:${exactId ? '0' : '1'}`,
      kind: 'Material',
      title: material.materialCode,
      subtitle: [material.description, material.heatNumber, material.jointNumber].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
      verificationStatus: material.verificationStatus,
    });
  }

  for (const joint of snapshot.pipeJoints) {
    const fields: Array<[string, string]> = [
      ['Joint', joint.jointNumber],
      ['Heat number', joint.heatNumber],
      ['Material ID', joint.materialCode],
      ['Grade', joint.grade],
      ['Wall', joint.wallThickness],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: joint.id,
      kind: 'Pipe joint',
      title: joint.jointNumber,
      subtitle: [joint.materialCode, joint.heatNumber, joint.lengthFt === null ? 'Length not recorded' : `${joint.lengthFt} ft`]
        .filter(Boolean)
        .join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
      verificationStatus: joint.verificationStatus,
    });
  }

  for (const fitting of snapshot.fittings) {
    const fields: Array<[string, string]> = [
      ['Material ID', fitting.materialCode],
      ['Heat number', fitting.heatNumber],
      ['Description', fitting.description],
      ['Grade', fitting.grade],
      ['Expected grade', fitting.expectedGrade],
      ['Manufacturer', fitting.manufacturer],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: fitting.id,
      kind: 'Fitting',
      title: fitting.materialCode,
      subtitle: [fitting.description, fitting.heatNumber].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
      verificationStatus: fitting.verificationStatus,
    });
  }

  for (const flange of snapshot.flanges) {
    const fields: Array<[string, string]> = [
      ['Material ID', flange.materialCode],
      ['Heat number', flange.heatNumber],
      ['Description', flange.description],
      ['Class', flange.classRating],
      ['Serial / lot', flange.serialOrLot],
      ['Manufacturer', flange.manufacturer],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: flange.id,
      kind: 'Flange',
      title: flange.materialCode,
      subtitle: [flange.description, flange.classRating ? `Class ${flange.classRating}` : ''].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
      verificationStatus: flange.verificationStatus,
    });
  }

  for (const valve of snapshot.valves) {
    const fields: Array<[string, string]> = [
      ['Material ID', valve.materialCode],
      ['Heat number', valve.heatNumber],
      ['Serial / lot', valve.serialNumber],
      ['Actuator serial', valve.actuatorSerial],
      ['Manufacturer', valve.manufacturer],
      ['Model', valve.modelNumber],
      ['Description', valve.description],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: valve.id,
      kind: 'Valve',
      title: valve.materialCode,
      subtitle: [valve.description, valve.serialNumber, valve.actuatorSerial].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
      verificationStatus: valve.verificationStatus,
    });
  }

  for (const delivery of snapshot.deliveries) {
    const fields: Array<[string, string]> = [
      ['BOL', delivery.bolNumber],
      ['Packing slip', delivery.packingSlipNumber],
      ['Shipment # (MRC)', delivery.shipmentNumberMrc],
      ['Manufacturer', delivery.vendor],
      ['PO', poNumber(snapshot, delivery.purchaseOrderId)],
      ['Sales Order# / Customer PO #', delivery.salesOrderOrCustomerPo],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: delivery.id,
      kind: 'Delivery',
      title: delivery.bolNumber || delivery.packingSlipNumber || 'Delivery',
      subtitle: [delivery.vendor, delivery.shipmentNumberMrc].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
    });
  }

  for (const po of snapshot.purchaseOrders) {
    const fields: Array<[string, string]> = [
      ['PO', po.poNumber],
      ['Manufacturer', po.vendor],
      ['Sales Order# / Customer PO #', po.salesOrderNumber],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: po.id,
      kind: 'Purchase order',
      title: po.poNumber,
      subtitle: po.vendor,
      matchedOn: matched.map(([label]) => label).join(', '),
    });
  }

  for (const mtr of snapshot.mtrs) {
    const fields: Array<[string, string]> = [
      ['Heat number', mtr.heatNumber],
      ['Manufacturer', mtr.manufacturer],
      ['MTR number', mtr.mtrNumber],
    ];
    const matched = fields.filter(([, value]) => includes(value, query));
    if (matched.length === 0) continue;
    hits.push({
      id: mtr.id,
      kind: 'MTR',
      title: mtr.mtrNumber,
      subtitle: [mtr.heatNumber, mtr.manufacturer].filter(Boolean).join(' · '),
      matchedOn: matched.map(([label]) => label).join(', '),
    });
  }

  hits.sort((a, b) => a.id.localeCompare(b.id) || a.title.localeCompare(b.title));
  return hits;
}
