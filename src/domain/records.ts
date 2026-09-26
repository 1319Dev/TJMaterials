import { enqueue } from './sync';
import type { AppSnapshot, AuditLogRecord, DocumentRecord, MtrRequestLine, ProjectRecord } from './types';

export interface FileMetadataInput {
  fileName: string;
  mimeType: string;
  byteSize: number;
  lastModified: number;
}

export function fileMetadata(file: FileMetadataInput): {
  fileName: string;
  mimeType: string;
  byteSize: number;
  lastModified: string;
} {
  return {
    fileName: file.fileName.trim(),
    mimeType: file.mimeType.trim() || 'application/octet-stream',
    byteSize: file.byteSize,
    lastModified: new Date(file.lastModified).toISOString(),
  };
}

export interface RecordContext {
  now: Date;
  newId: () => string;
}

function appendAudit(snapshot: AppSnapshot, entry: AuditLogRecord): AppSnapshot {
  return { ...snapshot, auditLogs: [...snapshot.auditLogs, entry] };
}

export function updateProject(
  snapshot: AppSnapshot,
  patch: ProjectRecord,
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[] } {
  const name = patch.name.trim();
  if (!name) return { snapshot, errors: ['Project name is required.'] };
  const project: ProjectRecord = {
    ...patch,
    id: snapshot.project.id,
    name,
    projectNumber: patch.projectNumber.trim(),
    constructionOrderNo: patch.constructionOrderNo.trim(),
    atmosProjectNumber: patch.atmosProjectNumber.trim(),
    inspectorName: patch.inspectorName.trim(),
    vendor: patch.vendor.trim(),
    salesOrderOrCustomerPo: patch.salesOrderOrCustomerPo.trim(),
    clientName: patch.clientName.trim(),
    spread: patch.spread.trim(),
    locationName: patch.locationName.trim(),
    notes: patch.notes.trim(),
    status: patch.status,
  };
  const nowIso = ctx.now.toISOString();
  let next = appendAudit(
    { ...snapshot, project },
    {
      id: ctx.newId(),
      projectId: project.id,
      action: 'update',
      entityType: 'projects',
      entityId: project.id,
      summary: 'Project setup updated',
      verificationStatus: null,
      createdAt: nowIso,
    },
  );
  next = {
    ...next,
    queue: enqueue(next.queue, {
      id: ctx.newId(),
      entityType: 'projects',
      entityId: project.id,
      op: 'upsert',
      createdAt: nowIso,
    }),
  };
  return { snapshot: next, errors: [] };
}

export function addDocument(
  snapshot: AppSnapshot,
  input: {
    docType: DocumentRecord['docType'];
    title: string;
    fileName: string;
    mimeType: string;
    byteSize: number;
    subjectType: string;
    subjectId: string;
    notes: string;
  },
  ctx: RecordContext,
): { snapshot: AppSnapshot; document: DocumentRecord } {
  const nowIso = ctx.now.toISOString();
  const document: DocumentRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    docType: input.docType,
    title: input.title.trim() || input.fileName,
    fileName: input.fileName,
    mimeType: input.mimeType,
    byteSize: input.byteSize,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    addedAt: nowIso,
    notes: input.notes,
  };
  let next: AppSnapshot = {
    ...snapshot,
    documents: [...snapshot.documents, document],
  };
  next = appendAudit(next, {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    action: 'attach',
    entityType: 'documents',
    entityId: document.id,
    summary: `Attached ${document.fileName}`,
    verificationStatus: null,
    createdAt: nowIso,
  });
  next = {
    ...next,
    queue: enqueue(next.queue, {
      id: ctx.newId(),
      entityType: 'documents',
      entityId: document.id,
      op: 'upsert',
      createdAt: nowIso,
    }),
  };
  return { snapshot: next, document };
}

export function removeDocument(snapshot: AppSnapshot, documentId: string): AppSnapshot {
  return {
    ...snapshot,
    documents: snapshot.documents.filter((document) => document.id !== documentId),
  };
}

export function saveMtrRequest(
  snapshot: AppSnapshot,
  input: {
    inspectorName: string;
    vendor: string;
    atmosProjectNumber: string;
    salesOrderOrCustomerPo: string;
    shipmentNumberMrc: string;
    lines: MtrRequestLine[];
  },
  ctx: RecordContext,
): { snapshot: AppSnapshot; errors: string[] } {
  if (!input.inspectorName.trim()) {
    return { snapshot, errors: ['Inspector Name is required.'] };
  }
  const lines = input.lines
    .map((line) => ({
      materialDescription: line.materialDescription.trim(),
      diameter: line.diameter.trim(),
      wallThickness: line.wallThickness.trim(),
      grade: line.grade.trim(),
      heatNumber: line.heatNumber.trim(),
      manufacturer: line.manufacturer.trim(),
    }))
    .filter((line) => Object.values(line).some((value) => value.length > 0));

  const nowIso = ctx.now.toISOString();
  const request = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    inspectorName: input.inspectorName.trim(),
    vendor: input.vendor.trim(),
    atmosProjectNumber: input.atmosProjectNumber.trim(),
    salesOrderOrCustomerPo: input.salesOrderOrCustomerPo.trim(),
    shipmentNumberMrc: input.shipmentNumberMrc.trim(),
    lines,
    createdAt: nowIso,
    statusNote: 'Saved on this device. Not submitted. Material was not marked acceptable.',
  };
  let next: AppSnapshot = { ...snapshot, mtrRequests: [...snapshot.mtrRequests, request] };
  next = appendAudit(next, {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    action: 'mtr_request',
    entityType: 'mtr_requests',
    entityId: request.id,
    summary: 'MTR request draft saved locally',
    verificationStatus: 'not_verified',
    createdAt: nowIso,
  });
  next = {
    ...next,
    queue: enqueue(next.queue, {
      id: ctx.newId(),
      entityType: 'mtr_requests',
      entityId: request.id,
      op: 'upsert',
      createdAt: nowIso,
    }),
  };
  return { snapshot: next, errors: [] };
}
