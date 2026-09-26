import { describe, expect, test } from 'vitest';
import { buildDemoData } from '../domain/demo-data';
import { filterMaterials, summarizeDashboard } from '../domain/dashboard';
import { isMaterialCode, nextMaterialCode } from '../domain/ids';
import { fileMetadata, updateProject } from '../domain/records';
import { createReceipt, emptyReceiveLine } from '../domain/receive';
import { searchRecords } from '../domain/search';
import { SYNC_LABEL, applySyncResult, describeSync } from '../domain/sync';
import type { ReceiveInput } from '../domain/receive';

const today = '2026-09-26';
const demo = buildDemoData(today);

function ids() {
  let n = 0;
  return () => `10000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

describe('demo dashboard', () => {
  test('counts the guest spread for a fixed day', () => {
    const summary = summarizeDashboard(demo, today);
    expect(summary.projectName).toBe('Guest Demo Spread');
    expect(summary.todaysDeliveries).toBe(2);
    expect(summary.materialReceivedToday).toBe(9);
    expect(summary.materialOnHold).toBe(1);
    expect(summary.missingMtrs).toBe(3);
    expect(summary.damagedMaterial).toBe(1);
    expect(summary.openDiscrepancies).toBe(2);
    expect(summary.recentInspections).toHaveLength(5);
    expect(summary.recentInspections[0]?.verificationStatus).toBe('difference_found');
  });

  test('includes pipe, fittings, flanges, valves, and several heats', () => {
    const descriptions = demo.materials.map((material) => material.description).join('\n');
    expect(descriptions).toContain('36" API 5L X52 PSL2 line pipe');
    expect(descriptions).toContain('36" WPHY52 90° elbow');
    expect(descriptions).toContain('36" Class 600 WN flange');
    expect(descriptions).toContain('36" Class 600 trunnion ball valve');
    expect(new Set(demo.materials.map((material) => material.heatNumber)).size).toBeGreaterThan(4);
    expect(demo.materials.every((material) => isMaterialCode(material.materialCode))).toBe(true);
    expect(JSON.stringify(demo)).not.toMatch(/acceptable/i);
    expect(demo.materials.some((material) => material.verificationStatus === 'match')).toBe(false);
  });
});

describe('search', () => {
  test('finds heat, joint, serial, PO, BOL, manufacturer, and Material ID', () => {
    expect(searchRecords(demo, 'H52-18440').some((hit) => hit.title === 'PMI-PIPE-000001')).toBe(true);
    expect(searchRecords(demo, 'J-1108').some((hit) => hit.title === 'PMI-PIPE-000004')).toBe(true);
    expect(searchRecords(demo, 'VB-600-3391').some((hit) => hit.matchedOn.includes('Serial / lot'))).toBe(true);
    expect(searchRecords(demo, 'PO-45021').some((hit) => hit.kind === 'Purchase order')).toBe(true);
    expect(searchRecords(demo, 'BOL-88421').some((hit) => hit.kind === 'Delivery')).toBe(true);
    expect(searchRecords(demo, 'Calder').some((hit) => hit.title === 'PMI-VLV-000001')).toBe(true);
    expect(searchRecords(demo, 'PMI-FLG-000001').some((hit) => hit.matchedOn.includes('Material ID'))).toBe(true);
    expect(searchRecords(demo, 'z')).toEqual([]);
  });
});

describe('material ids', () => {
  test('increments within a category only', () => {
    const existing = demo.materials.map((material) => material.materialCode);
    expect(nextMaterialCode('pipe', existing)).toBe('PMI-PIPE-000006');
    expect(nextMaterialCode('fitting', existing)).toBe('PMI-FIT-000004');
    expect(nextMaterialCode('flange', ['PMI-PIPE-000009'])).toBe('PMI-FLG-000001');
  });
});

describe('receiving', () => {
  const input: ReceiveInput = {
    receivedOn: today,
    vendor: 'Northline Pipe Supply',
    inspectorName: 'Alex Rivera',
    shipmentNumberMrc: 'MRC-5700',
    salesOrderOrCustomerPo: 'SO-77821 / PO-45999',
    packingSlipNumber: '',
    bolNumber: 'BOL-TEST-1',
    carrier: 'Red Mesa Freight',
    poNumber: 'PO-45999',
    notes: '',
    lines: [
      {
        ...emptyReceiveLine(),
        description: '36" API 5L X52 PSL2 line pipe',
        diameter: '36',
        wallThickness: '0.500',
        grade: 'X52',
        heatNumber: '',
        manufacturer: 'Heartland Steel Mills',
        quantity: '1',
      },
    ],
    photoStubs: [{ role: 'bol', permissionStatus: 'granted', message: 'Camera permission granted. Phase 1 stores no photo bytes.' }],
    gps: { status: 'denied', latitude: null, longitude: null },
    documents: [],
  };

  test('saves a review-required line and does not invent a heat or a photo', () => {
    const before = demo.auditLogs.length;
    const result = createReceipt(demo, input, { now: new Date(`${today}T18:00:00.000Z`), newId: ids() });
    expect(result.errors).toEqual([]);
    expect(result.materialCodes).toEqual(['PMI-PIPE-000006']);
    const created = result.snapshot.materials.find((material) => material.materialCode === 'PMI-PIPE-000006');
    expect(created?.verificationStatus).toBe('review_required');
    expect(created?.heatNumber).toBe('');
    expect(created?.custodyStatus).toBe('received');
    const photo = result.snapshot.photos.at(-1);
    expect(photo?.byteSize).toBe(0);
    expect(photo?.capturedAt).toBeNull();
    expect(result.snapshot.deliveries.at(-1)?.gpsStatus).toBe('denied');
    expect(result.snapshot.deliveries.at(-1)?.latitude).toBeNull();
    expect(result.snapshot.purchaseOrders.some((po) => po.poNumber === 'PO-45999')).toBe(true);
    expect(result.snapshot.auditLogs.slice(0, before)).toEqual(demo.auditLogs);
    expect(result.snapshot.auditLogs.length).toBe(before + 1);
    expect(result.snapshot.queue.some((item) => item.status === 'pending')).toBe(true);
  });

  test('rejects a delivery with no paperwork instead of inventing a number', () => {
    const result = createReceipt(demo, { ...input, bolNumber: ' ', packingSlipNumber: '' }, {
      now: new Date(),
      newId: ids(),
    });
    expect(result.errors.join(' ')).toMatch(/BOL/);
    expect(result.snapshot).toBe(demo);
  });

  test('rejects out-of-range coordinates instead of clamping them', () => {
    const result = createReceipt(
      demo,
      { ...input, gps: { status: 'granted', latitude: 120, longitude: 10 } },
      { now: new Date(), newId: ids() },
    );
    expect(result.errors.join(' ')).toMatch(/out of range/);
  });
});

describe('sync states', () => {
  test('uses the three queue labels without claiming a remote ack', () => {
    expect(
      describeSync({ online: false, pending: 1, syncing: false, remoteConfigured: false, lastAckAt: null }).label,
    ).toBe(SYNC_LABEL.offlineSaved);
    expect(
      describeSync({ online: true, pending: 1, syncing: true, remoteConfigured: true, lastAckAt: null }).label,
    ).toBe(SYNC_LABEL.syncing);
    expect(
      describeSync({
        online: true,
        pending: 0,
        syncing: false,
        remoteConfigured: true,
        lastAckAt: '2026-09-26T18:00:00.000Z',
      }).label,
    ).toBe(SYNC_LABEL.syncComplete);
    expect(
      describeSync({ online: true, pending: 2, syncing: false, remoteConfigured: false, lastAckAt: null }).label,
    ).toBe(SYNC_LABEL.offlineSaved);
  });

  test('acks only when the transport says so', () => {
    const queue = [{ id: '1', entityType: 'deliveries', entityId: 'd', op: 'upsert' as const, createdAt: today, status: 'pending' as const, ackedAt: null }];
    expect(applySyncResult(queue, 'not_configured', '2026-09-26T18:00:00.000Z')[0]?.status).toBe('pending');
    expect(applySyncResult(queue, 'acked', '2026-09-26T18:00:00.000Z')[0]).toMatchObject({
      status: 'complete',
      ackedAt: '2026-09-26T18:00:00.000Z',
    });
  });
});

describe('project and files', () => {
  test('requires a project name and records file metadata as given', () => {
    const result = updateProject(demo, { ...demo.project, name: '  ' }, { now: new Date(), newId: ids() });
    expect(result.errors).toEqual(['Project name is required.']);
    expect(result.snapshot).toBe(demo);
    expect(
      fileMetadata({ fileName: ' spec.pdf ', mimeType: '', byteSize: 42, lastModified: Date.parse('2026-09-26T12:00:00.000Z') }),
    ).toEqual({
      fileName: 'spec.pdf',
      mimeType: 'application/octet-stream',
      byteSize: 42,
      lastModified: '2026-09-26T12:00:00.000Z',
    });
  });

  test('filters inventory groups', () => {
    expect(filterMaterials(demo, 'valve', today).every((material) => material.category === 'valve')).toBe(true);
    expect(filterMaterials(demo, 'damaged', today).map((material) => material.materialCode)).toEqual(['PMI-PIPE-000004']);
    expect(filterMaterials(demo, 'on-hold', today).map((material) => material.materialCode)).toEqual(['PMI-VLV-000001']);
  });
});
