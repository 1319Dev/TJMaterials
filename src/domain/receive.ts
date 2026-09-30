import { collectMaterialCodes, nextMaterialCode } from './ids';
import { enqueue } from './sync';
import { pipeJointShell } from './tally';
import type {
  AppSnapshot,
  AuditLogRecord,
  DeliveryRecord,
  DocumentRecord,
  GpsStatus,
  MaterialCategory,
  MaterialRecord,
  PhotoRecord,
  PipeJointRecord,
  PurchaseOrderRecord,
  SyncQueueItem,
} from './types';

export interface ReceiveLineInput {
  category: MaterialCategory;
  description: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  heatNumber: string;
  manufacturer: string;
  quantity: string;
  modelNumber: string;
  serialOrLot: string;
  jointNumber: string;
  ansiPressureRating: string;
  specification: string;
}

export interface PhotoStubInput {
  role: 'packing_slip' | 'bol' | 'material' | 'damage' | 'other';
  permissionStatus: Exclude<GpsStatus, 'not_provided'>;
  message: string;
  caption?: string;
  byteSize?: number;
}

export interface GpsInput {
  status: Exclude<GpsStatus, 'not_provided'>;
  latitude: number | null;
  longitude: number | null;
}

export interface ReceiveInput {
  receivedOn: string;
  vendor: string;
  inspectorName: string;
  shipmentNumberMrc: string;
  salesOrderOrCustomerPo: string;
  packingSlipNumber: string;
  bolNumber: string;
  carrier: string;
  poNumber: string;
  notes: string;
  lines: ReceiveLineInput[];
  photoStubs: PhotoStubInput[];
  gps: GpsInput | null;
  documents: Array<{
    docType: 'packing_slip' | 'bol' | 'other';
    title: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    bytes?: Uint8Array;
  }>;
}

export interface ReceiveContext {
  now: Date;
  newId: () => string;
}

export interface ReceiveResult {
  snapshot: AppSnapshot;
  errors: string[];
  deliveryId?: string;
  materialCodes?: string[];
}

function blankLine(): ReceiveLineInput {
  return {
    category: 'pipe',
    description: '',
    diameter: '',
    wallThickness: '',
    grade: '',
    heatNumber: '',
    manufacturer: '',
    quantity: '1',
    modelNumber: '',
    serialOrLot: '',
    jointNumber: '',
    ansiPressureRating: '',
    specification: '',
  };
}

export function emptyReceiveLine(): ReceiveLineInput {
  return blankLine();
}

export function receiveDefaults(snapshot: AppSnapshot, today: string): ReceiveInput {
  return {
    receivedOn: today,
    vendor: snapshot.project.vendor,
    inspectorName: snapshot.project.inspectorName,
    shipmentNumberMrc: '',
    salesOrderOrCustomerPo: snapshot.project.salesOrderOrCustomerPo,
    packingSlipNumber: '',
    bolNumber: '',
    carrier: '',
    poNumber: '',
    notes: '',
    lines: [blankLine()],
    photoStubs: [],
    gps: null,
    documents: [],
  };
}

function clean(value: string): string {
  return value.trim();
}

export function createReceipt(
  snapshot: AppSnapshot,
  input: ReceiveInput,
  ctx: ReceiveContext,
): ReceiveResult {
  const errors: string[] = [];
  const vendor = clean(input.vendor);
  const bolNumber = clean(input.bolNumber);
  const packingSlipNumber = clean(input.packingSlipNumber);
  const receivedOn = clean(input.receivedOn);

  if (!vendor) errors.push('Vendor is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) errors.push('Received date must be a calendar date.');
  if (!bolNumber && !packingSlipNumber) {
    errors.push('Enter a BOL # or a packing slip #. A number was not invented.');
  }
  if (input.lines.length === 0) errors.push('Add at least one line item.');

  const lines = input.lines.map((line) => ({
    ...line,
    description: clean(line.description),
    quantity: clean(line.quantity),
  }));

  const seenJoints = new Set(snapshot.pipeJoints.map((joint) => joint.jointNumber.trim().toLowerCase()));
  lines.forEach((line, index) => {
    if (!line.description) errors.push(`Line ${index + 1} needs a material description.`);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      errors.push(`Line ${index + 1} quantity must be a number greater than zero.`);
    }
    if (line.category !== 'pipe') return;
    const jointNumber = clean(line.jointNumber);
    if (!jointNumber) return;
    const key = jointNumber.toLowerCase();
    if (seenJoints.has(key)) {
      errors.push(`Line ${index + 1} joint ${jointNumber} is already on the pipe tally.`);
    }
    seenJoints.add(key);
  });

  let latitude: number | null = null;
  let longitude: number | null = null;
  let gpsStatus: GpsStatus = 'not_requested';
  if (input.gps) {
    gpsStatus = input.gps.status;
    if (input.gps.status === 'granted') {
      if (input.gps.latitude === null || input.gps.longitude === null) {
        errors.push('Location was not provided.');
      } else if (
        input.gps.latitude < -90 ||
        input.gps.latitude > 90 ||
        input.gps.longitude < -180 ||
        input.gps.longitude > 180
      ) {
        errors.push('Location coordinates are out of range and were not adjusted.');
      } else {
        latitude = input.gps.latitude;
        longitude = input.gps.longitude;
      }
    }
  }

  if (errors.length > 0) return { snapshot, errors };

  const nowIso = ctx.now.toISOString();
  const codes = collectMaterialCodes(snapshot);
  const poNumber = clean(input.poNumber);
  let purchaseOrders = snapshot.purchaseOrders;
  let purchaseOrderId: string | null = null;
  if (poNumber) {
    const existing = purchaseOrders.find(
      (po) => po.projectId === snapshot.project.id && po.poNumber.toLowerCase() === poNumber.toLowerCase(),
    );
    if (existing) {
      purchaseOrderId = existing.id;
    } else {
      const created: PurchaseOrderRecord = {
        id: ctx.newId(),
        projectId: snapshot.project.id,
        poNumber,
        vendor,
        salesOrderNumber: clean(input.salesOrderOrCustomerPo),
        issuedOn: null,
        notes: 'Entered during receiving.',
        status: 'open',
      };
      purchaseOrders = [...purchaseOrders, created];
      purchaseOrderId = created.id;
    }
  }

  const delivery: DeliveryRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    purchaseOrderId,
    receivedOn,
    scheduledOn: receivedOn,
    vendor,
    inspectorName: clean(input.inspectorName),
    carrier: clean(input.carrier),
    bolNumber,
    packingSlipNumber,
    shipmentNumberMrc: clean(input.shipmentNumberMrc),
    salesOrderOrCustomerPo: clean(input.salesOrderOrCustomerPo),
    atmosProjectNumber: snapshot.project.atmosProjectNumber,
    status: 'received',
    notes: clean(input.notes),
    latitude,
    longitude,
    gpsStatus,
  };

  const materials: MaterialRecord[] = [];
  const materialCodes: string[] = [];
  const joints: PipeJointRecord[] = [];
  for (const line of lines) {
    const materialCode = nextMaterialCode(line.category, [...codes, ...materialCodes]);
    materialCodes.push(materialCode);
    materials.push({
      id: ctx.newId(),
      projectId: snapshot.project.id,
      deliveryId: delivery.id,
      purchaseOrderId,
      materialCode,
      category: line.category,
      description: line.description,
      diameter: clean(line.diameter),
      wallThickness: clean(line.wallThickness),
      grade: clean(line.grade),
      specification: clean(line.specification),
      manufacturer: clean(line.manufacturer),
      modelNumber: clean(line.modelNumber),
      heatNumber: clean(line.heatNumber),
      serialOrLot: clean(line.serialOrLot),
      jointNumber: clean(line.jointNumber),
      ansiPressureRating: clean(line.ansiPressureRating),
      quantity: Number(line.quantity),
      unit: 'ea',
      custodyStatus: 'received',
      verificationStatus: 'review_required',
      receivedOn,
      notes: '',
    });
    const created = materials[materials.length - 1];
    if (created.category === 'pipe' && created.jointNumber) {
      joints.push(pipeJointShell(created, ctx.newId()));
    }
  }

  const photos: PhotoRecord[] = input.photoStubs.map((stub) => {
    const byteSize = stub.byteSize && stub.byteSize > 0 ? stub.byteSize : 0;
    return {
      id: ctx.newId(),
      projectId: snapshot.project.id,
      subjectType: 'delivery',
      subjectId: delivery.id,
      role: stub.role,
      caption: [stub.caption, stub.message].filter(Boolean).join(' — '),
      permissionStatus: stub.permissionStatus,
      byteSize,
      capturedAt: byteSize > 0 ? nowIso : null,
    };
  });

  const documents: DocumentRecord[] = input.documents.map((document) => ({
    id: ctx.newId(),
    projectId: snapshot.project.id,
    docType: document.docType,
    title: document.title || document.fileName,
    fileName: document.fileName,
    mimeType: document.mimeType,
    byteSize: document.byteSize,
    subjectType: 'delivery',
    subjectId: delivery.id,
    addedAt: nowIso,
    notes: 'File metadata stored on this device.',
  }));

  const audit: AuditLogRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    action: 'receive',
    entityType: 'deliveries',
    entityId: delivery.id,
    summary: `Received ${materialCodes.join(', ')}`,
    verificationStatus: 'review_required',
    createdAt: nowIso,
  };

  let queue: SyncQueueItem[] = snapshot.queue;
  const queued = [
    { entityType: 'deliveries', entityId: delivery.id },
    ...materials.map((material) => ({ entityType: 'materials', entityId: material.id })),
    ...joints.map((joint) => ({ entityType: 'pipe_joints', entityId: joint.id })),
    ...documents.map((document) => ({ entityType: 'documents', entityId: document.id })),
  ];
  for (const item of queued) {
    queue = enqueue(queue, {
      id: ctx.newId(),
      entityType: item.entityType,
      entityId: item.entityId,
      op: 'upsert',
      createdAt: nowIso,
    });
  }

  return {
    snapshot: {
      ...snapshot,
      purchaseOrders,
      deliveries: [...snapshot.deliveries, delivery],
      materials: [...snapshot.materials, ...materials],
      pipeJoints: joints.length > 0 ? [...snapshot.pipeJoints, ...joints] : snapshot.pipeJoints,
      photos: [...snapshot.photos, ...photos],
      documents: [...snapshot.documents, ...documents],
      auditLogs: [...snapshot.auditLogs, audit],
      queue,
    },
    errors: [],
    deliveryId: delivery.id,
    materialCodes,
  };
}
