import { enqueue } from './sync';
import type {
  AppSnapshot,
  DocumentRecord,
  MaterialRecord,
  MtrRecord,
  PackingSlipRecord,
  PhotoRecord,
  VerificationStatus,
} from './types';

export interface RecordContext {
  now: Date;
  newId: () => string;
}

export interface PackingSlipInput {
  deliveryId: string | null;
  packingSlipNumber: string;
  bolNumber: string;
  shipmentNumberMrc: string;
  vendor: string;
  receivedOn: string;
  notes: string;
}

export interface CaptureInput {
  docType: DocumentRecord['docType'];
  subjectType: string;
  subjectId: string;
  role: PhotoRecord['role'];
  caption: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
}

export interface SlipPhotoRef {
  documentId: string;
  byteSize: number;
  fileName: string;
  mimeType: string;
}

export interface PackingSlipListItem {
  key: string;
  packingSlipNumber: string;
  bolNumber: string;
  shipmentNumberMrc: string;
  vendor: string;
  receivedOn: string | null;
  deliveryId: string | null;
  slipId: string | null;
  photos: SlipPhotoRef[];
}

export interface MtrDeskRow {
  materialId: string;
  materialCode: string;
  description: string;
  heatNumber: string;
  manufacturer: string;
  verificationStatus: VerificationStatus;
  paperwork: 'on_file' | 'not_provided' | 'missing_documentation';
  documentId: string | null;
}

function audit(
  snapshot: AppSnapshot,
  ctx: RecordContext,
  action: string,
  entityType: string,
  entityId: string,
  summary: string,
): AppSnapshot {
  const createdAt = ctx.now.toISOString();
  const withLog: AppSnapshot = {
    ...snapshot,
    auditLogs: [
      ...snapshot.auditLogs,
      {
        id: ctx.newId(),
        projectId: snapshot.project.id,
        action,
        entityType,
        entityId,
        summary,
        verificationStatus: null,
        createdAt,
      },
    ],
  };
  return {
    ...withLog,
    queue: enqueue(withLog.queue, {
      id: ctx.newId(),
      entityType,
      entityId,
      op: 'upsert',
      createdAt,
    }),
  };
}

export function addPackingSlip(
  snapshot: AppSnapshot,
  input: PackingSlipInput,
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[]; id?: string } {
  const packingSlipNumber = input.packingSlipNumber.trim();
  const deliveryId = input.deliveryId;
  if (!packingSlipNumber && !deliveryId) {
    return { snapshot, errors: ['Enter a packing slip # or choose a delivery. A number was not invented.'] };
  }
  const receivedOn = input.receivedOn.trim();
  if (receivedOn && !/^\d{4}-\d{2}-\d{2}$/.test(receivedOn)) {
    return { snapshot, errors: ['Received date must be a calendar date.'] };
  }
  const record: PackingSlipRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    deliveryId,
    packingSlipNumber,
    bolNumber: input.bolNumber.trim(),
    shipmentNumberMrc: input.shipmentNumberMrc.trim(),
    vendor: input.vendor.trim(),
    receivedOn,
    notes: input.notes.trim(),
    createdAt: ctx.now.toISOString(),
  };
  const next = audit(
    { ...snapshot, packingSlips: [...snapshot.packingSlips, record] },
    ctx,
    'packing_slip',
    'packing_slips',
    record.id,
    `Packing slip ${record.packingSlipNumber || 'delivery slip'} saved on this device.`,
  );
  return { snapshot: next, errors: [], id: record.id };
}

export function attachImageRecord(
  snapshot: AppSnapshot,
  input: CaptureInput,
  ctx: RecordContext,
): { snapshot: AppSnapshot; documentId: string } {
  const nowIso = ctx.now.toISOString();
  const id = ctx.newId();
  const document: DocumentRecord = {
    id,
    projectId: snapshot.project.id,
    docType: input.docType,
    title: input.caption.trim() || input.fileName,
    fileName: input.fileName,
    mimeType: input.mimeType || 'application/octet-stream',
    byteSize: input.byteSize,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    addedAt: nowIso,
    notes: 'Stored on this device. Material was not accepted.',
  };
  const photo: PhotoRecord = {
    id,
    projectId: snapshot.project.id,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    role: input.role,
    caption: input.caption,
    permissionStatus: 'granted',
    byteSize: input.byteSize,
    capturedAt: nowIso,
  };
  const withFiles: AppSnapshot = {
    ...snapshot,
    documents: [...snapshot.documents, document],
    photos: [...snapshot.photos, photo],
    materials: snapshot.materials,
  };
  return { snapshot: audit(withFiles, ctx, 'attach', 'documents', id, `Stored ${document.fileName} on this device.`), documentId: id };
}

function slipPhotos(snapshot: AppSnapshot, subjectType: string, subjectId: string): SlipPhotoRef[] {
  return snapshot.documents
    .filter(
      (document) =>
        document.subjectType === subjectType &&
        document.subjectId === subjectId &&
        (document.docType === 'packing_slip' || document.docType === 'bol') &&
        document.byteSize > 0,
    )
    .map((document) => ({
      documentId: document.id,
      byteSize: document.byteSize,
      fileName: document.fileName,
      mimeType: document.mimeType,
    }));
}

export function listPackingSlips(snapshot: AppSnapshot): PackingSlipListItem[] {
  const coveredDeliveries = new Set(
    snapshot.packingSlips.map((slip) => slip.deliveryId).filter((id): id is string => Boolean(id)),
  );
  const items: PackingSlipListItem[] = [];
  for (const delivery of snapshot.deliveries) {
    if (coveredDeliveries.has(delivery.id)) continue;
    const photos = slipPhotos(snapshot, 'delivery', delivery.id);
    if (!delivery.packingSlipNumber && !delivery.bolNumber && photos.length === 0) continue;
    items.push({
      key: `delivery-${delivery.id}`,
      packingSlipNumber: delivery.packingSlipNumber,
      bolNumber: delivery.bolNumber,
      shipmentNumberMrc: delivery.shipmentNumberMrc,
      vendor: delivery.vendor,
      receivedOn: delivery.receivedOn,
      deliveryId: delivery.id,
      slipId: null,
      photos,
    });
  }
  for (const slip of snapshot.packingSlips) {
    items.push({
      key: slip.id,
      packingSlipNumber: slip.packingSlipNumber,
      bolNumber: slip.bolNumber,
      shipmentNumberMrc: slip.shipmentNumberMrc,
      vendor: slip.vendor,
      receivedOn: slip.receivedOn || null,
      deliveryId: slip.deliveryId,
      slipId: slip.id,
      photos: slipPhotos(snapshot, 'packing_slip', slip.id),
    });
  }
  return items;
}

function heatKey(value: string): string {
  return value.trim().toLowerCase();
}

function mtrForMaterial(snapshot: AppSnapshot, material: MaterialRecord): MtrRecord | undefined {
  const link = snapshot.mtrLinks.find((item) => item.materialId === material.id);
  if (link) {
    const linked = snapshot.mtrs.find((mtr) => mtr.id === link.mtrId);
    if (linked) return linked;
  }
  const heat = heatKey(material.heatNumber);
  if (!heat) return undefined;
  return snapshot.mtrs.find((mtr) => heatKey(mtr.heatNumber) === heat);
}

function mtrDocument(snapshot: AppSnapshot, material: MaterialRecord, mtr: MtrRecord | undefined): string | null {
  const ids = new Set([material.id, mtr?.id].filter((id): id is string => Boolean(id)));
  const document = snapshot.documents.find(
    (item) => item.docType === 'mtr' && ids.has(item.subjectId) && item.byteSize > 0,
  );
  return document?.id ?? null;
}

export function listMtrDesk(snapshot: AppSnapshot): MtrDeskRow[] {
  return snapshot.materials.map((material) => {
    const mtr = mtrForMaterial(snapshot, material);
    const documentId = mtrDocument(snapshot, material, mtr);
    const onFile = Boolean(documentId) || mtr?.paperworkStatus === 'on_file';
    let paperwork: MtrDeskRow['paperwork'] = 'not_provided';
    if (onFile) paperwork = 'on_file';
    else if (material.verificationStatus === 'missing_documentation' || mtr?.paperworkStatus === 'missing_documentation') {
      paperwork = 'missing_documentation';
    }
    return {
      materialId: material.id,
      materialCode: material.materialCode,
      description: material.description,
      heatNumber: material.heatNumber,
      manufacturer: material.manufacturer,
      verificationStatus: material.verificationStatus,
      paperwork,
      documentId,
    };
  });
}
