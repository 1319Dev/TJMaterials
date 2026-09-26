import { expect, test } from 'vitest';
import type { RemoteDb } from '../domain/cloud-sync';
import { orderedPending, pushPending } from '../domain/cloud-sync';
import { emptySnapshot } from '../domain/empty';
import { applyRemoteSnapshot } from '../domain/rows';
import { buildDemoData } from '../domain/demo-data';
import { authRedirectTo } from '../data/supabase';

test('a new snapshot has no invented material', () => {
  const empty = emptySnapshot();
  expect(empty.project.name).toBe('');
  expect(empty.materials).toEqual([]);
  expect(empty.pipeJoints).toEqual([]);
  expect(empty.fittings).toEqual([]);
  expect(empty.flanges).toEqual([]);
  expect(empty.valves).toEqual([]);
  expect(empty.deliveries).toEqual([]);
});

test('uploads a delivery before its material', async () => {
  const snapshot = emptySnapshot();
  snapshot.project.name = 'Spread B';
  snapshot.deliveries = [
    {
      id: '00000000-0000-4000-8000-000000000201',
      projectId: snapshot.project.id,
      purchaseOrderId: null,
      receivedOn: '2026-09-26',
      scheduledOn: null,
      vendor: 'Yard',
      inspectorName: 'Alex',
      carrier: '',
      bolNumber: 'BOL-1',
      packingSlipNumber: '',
      shipmentNumberMrc: '',
      salesOrderOrCustomerPo: '',
      atmosProjectNumber: '',
      status: 'received',
      notes: '',
      latitude: null,
      longitude: null,
      gpsStatus: 'not_requested',
    },
  ];
  snapshot.materials = [
    {
      id: '00000000-0000-4000-8000-000000000202',
      projectId: snapshot.project.id,
      deliveryId: snapshot.deliveries[0].id,
      purchaseOrderId: null,
      materialCode: 'PMI-PIPE-000001',
      category: 'pipe',
      description: 'Pipe',
      diameter: '36',
      wallThickness: '0.500',
      grade: 'X52',
      specification: '',
      manufacturer: '',
      modelNumber: '',
      heatNumber: 'H1',
      serialOrLot: '',
      jointNumber: 'J-1',
      ansiPressureRating: '',
      quantity: 1,
      unit: 'ea',
      custodyStatus: 'received',
      verificationStatus: 'review_required',
      receivedOn: '2026-09-26',
      notes: '',
    },
  ];
  snapshot.queue = [
    {
      id: 'q-material',
      entityType: 'materials',
      entityId: snapshot.materials[0].id,
      op: 'upsert',
      createdAt: '2026-09-26T12:00:00.000Z',
      status: 'pending',
      ackedAt: null,
    },
    {
      id: 'q-delivery',
      entityType: 'deliveries',
      entityId: snapshot.deliveries[0].id,
      op: 'upsert',
      createdAt: '2026-09-26T12:00:01.000Z',
      status: 'pending',
      ackedAt: null,
    },
  ];
  const calls: string[] = [];
  const db: RemoteDb = {
    async upsert(table) {
      calls.push(table);
      return null;
    },
    async listProjects() {
      return { rows: [], error: null };
    },
    async selectProject() {
      return { row: null, error: null };
    },
    async selectChildren() {
      return { rows: [], error: null };
    },
    async selectAudits() {
      return { rows: [], error: null };
    },
  };
  expect(orderedPending(snapshot.queue).map((item) => item.entityType)).toEqual(['deliveries', 'materials']);
  const result = await pushPending(db, snapshot, '2026-09-26T18:00:00.000Z');
  expect(calls).toEqual(['deliveries', 'materials']);
  expect(result.error).toBeNull();
  expect(result.snapshot.queue.every((item) => item.status === 'complete')).toBe(true);
});

test('a sample project is not uploaded', async () => {
  const sample = buildDemoData('2026-09-26');
  sample.queue = [
    {
      id: 'q1',
      entityType: 'projects',
      entityId: sample.project.id,
      op: 'upsert',
      createdAt: '2026-09-26T12:00:00.000Z',
      status: 'pending',
      ackedAt: null,
    },
  ];
  let calls = 0;
  const db: RemoteDb = {
    async upsert() {
      calls += 1;
      return null;
    },
    async listProjects() {
      return { rows: [], error: null };
    },
    async selectProject() {
      return { row: null, error: null };
    },
    async selectChildren() {
      return { rows: [], error: null };
    },
    async selectAudits() {
      return { rows: [], error: null };
    },
  };
  const result = await pushPending(db, sample);
  expect(calls).toBe(0);
  expect(result.snapshot.queue[0]?.status).toBe('pending');
});

test('a pending local row wins over the remote copy', () => {
  const local = emptySnapshot();
  local.project.name = 'Spread B';
  local.materials = [
    {
      id: '00000000-0000-4000-8000-000000000301',
      projectId: local.project.id,
      deliveryId: null,
      purchaseOrderId: null,
      materialCode: 'PMI-PIPE-000009',
      category: 'pipe',
      description: 'Local pipe',
      diameter: '',
      wallThickness: '',
      grade: '',
      specification: '',
      manufacturer: '',
      modelNumber: '',
      heatNumber: 'LOCAL',
      serialOrLot: '',
      jointNumber: '',
      ansiPressureRating: '',
      quantity: 1,
      unit: 'ea',
      custodyStatus: 'received',
      verificationStatus: 'review_required',
      receivedOn: '2026-09-26',
      notes: '',
    },
  ];
  local.queue = [
    {
      id: 'q',
      entityType: 'materials',
      entityId: local.materials[0].id,
      op: 'upsert',
      createdAt: '2026-09-26T12:00:00.000Z',
      status: 'pending',
      ackedAt: null,
    },
  ];
  const merged = applyRemoteSnapshot(local, {
    project: {
      id: local.project.id,
      name: 'Spread B',
      project_number: '',
      construction_order_no: '',
      atmos_project_number: '',
      inspector_name: '',
      vendor: '',
      sales_order_or_customer_po: '',
      client_name: '',
      spread: '',
      location_name: '',
      notes: '',
      status: 'active',
    },
    tables: {
      materials: [
        {
          id: local.materials[0].id,
          project_id: local.project.id,
          material_code: 'PMI-PIPE-000009',
          category: 'pipe',
          description: 'Remote pipe',
          quantity: 1,
          unit: 'ea',
          custody_status: 'received',
          verification_status: 'review_required',
          heat_number: 'REMOTE',
        },
      ],
    },
  });
  expect(merged.materials[0]?.description).toBe('Local pipe');
  expect(merged.materials[0]?.heatNumber).toBe('LOCAL');
});

test('auth redirect targets the GitHub Pages callback', () => {
  expect(authRedirectTo()).toBe(`${window.location.origin}/TJMaterials/auth/callback`);
});
