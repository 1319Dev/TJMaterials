import { localIsoDate } from './dates';
import { gradeReview, isFlangeClass } from './grades';
import { collectMaterialCodes, nextMaterialCode } from './ids';
import type { RecordContext } from './records';
import { enqueue } from './sync';
import type {
  ActuatorType,
  AppSnapshot,
  AuditLogRecord,
  CustodyStatus,
  FittingRecord,
  FittingType,
  FlangeRecord,
  FlangeType,
  MaterialCategory,
  MaterialRecord,
  SyncQueueItem,
  ValveRecord,
  ValveType,
  VerificationStatus,
} from './types';

const FITTING_TYPES: readonly FittingType[] = ['elbow', 'tee', 'reducer', 'cap', 'other'];
const FLANGE_TYPES: readonly FlangeType[] = ['wn', 'so', 'blind', 'lap_joint', 'threaded', 'other'];
const VALVE_TYPES: readonly ValveType[] = ['ball', 'gate', 'plug', 'check', 'other'];
const ACTUATOR_TYPES: readonly ActuatorType[] = ['', 'electric', 'pneumatic', 'hydraulic', 'manual_gear', 'other'];

export interface FittingInput {
  id?: string;
  fittingType: FittingType;
  description: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  expectedGrade: string;
  specification: string;
  manufacturer: string;
  heatNumber: string;
  angleDeg: string;
  quantity: string;
  custodyStatus: CustodyStatus;
  notes: string;
  deliveryId: string | null;
  purchaseOrderId: string | null;
}

export interface FlangeInput {
  id?: string;
  flangeType: FlangeType;
  description: string;
  diameter: string;
  classRating: string;
  grade: string;
  expectedGrade: string;
  facing: string;
  manufacturer: string;
  heatNumber: string;
  serialOrLot: string;
  quantity: string;
  custodyStatus: CustodyStatus;
  notes: string;
  deliveryId: string | null;
  purchaseOrderId: string | null;
}

export interface ValveInput {
  id?: string;
  valveType: ValveType;
  description: string;
  diameter: string;
  classRating: string;
  grade: string;
  expectedGrade: string;
  manufacturer: string;
  modelNumber: string;
  heatNumber: string;
  serialNumber: string;
  actuatorType: ActuatorType;
  actuatorManufacturer: string;
  actuatorModel: string;
  actuatorSerial: string;
  quantity: string;
  custodyStatus: CustodyStatus;
  notes: string;
  deliveryId: string | null;
  purchaseOrderId: string | null;
}

export interface SpecialtySaveResult {
  snapshot: AppSnapshot;
  errors: string[];
  id?: string;
  materialCode?: string;
}

function clean(value: string): string {
  return value.trim();
}

function keptStatus(existing: VerificationStatus | null): VerificationStatus {
  if (!existing || existing === 'match') return 'review_required';
  return existing;
}

function parseQuantity(value: string): { error: string | null; value: number } {
  const trimmed = clean(value);
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: 'Quantity must be a number greater than zero.', value: 0 };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { error: 'Quantity must be a number greater than zero.', value: 0 };
  }
  return { error: null, value: parsed };
}

function parseAngle(value: string): { error: string | null; value: number | null } {
  const trimmed = clean(value);
  if (!trimmed) return { error: null, value: null };
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return { error: 'Angle must be degrees, or left blank.', value: null };
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 180) {
    return { error: 'Angle must be between 0 and 180 degrees, or left blank.', value: null };
  }
  return { error: null, value: parsed };
}

function parseClass(value: string): { error: string | null; value: string } {
  const trimmed = clean(value);
  if (!trimmed) return { error: null, value: '' };
  if (!isFlangeClass(trimmed)) {
    return { error: 'Class must be 150, 300, 400, 600, 900, or 1500, or left blank.', value: '' };
  }
  return { error: null, value: trimmed };
}

function linkIds(
  snapshot: AppSnapshot,
  input: { id?: string; deliveryId: string | null; purchaseOrderId: string | null },
): { errors: string[]; deliveryId: string | null; purchaseOrderId: string | null } {
  const errors: string[] = [];
  let deliveryId: string | null = null;
  let purchaseOrderId: string | null = null;
  if (!input.deliveryId) {
    if (!input.id) errors.push('Choose the delivery. A BOL number was not invented.');
  } else if (!snapshot.deliveries.some((delivery) => delivery.id === input.deliveryId)) {
    errors.push('That delivery is not on this device.');
  } else {
    deliveryId = input.deliveryId;
  }
  if (input.purchaseOrderId) {
    if (!snapshot.purchaseOrders.some((po) => po.id === input.purchaseOrderId)) {
      errors.push('That purchase order is not on this device.');
    } else {
      purchaseOrderId = input.purchaseOrderId;
    }
  }
  return { errors, deliveryId, purchaseOrderId };
}

function receivedOn(snapshot: AppSnapshot, deliveryId: string | null, custody: CustodyStatus, ctx: RecordContext, previous: string | null): string | null {
  if (custody === 'expected') return null;
  if (previous) return previous;
  const delivery = snapshot.deliveries.find((item) => item.id === deliveryId);
  if (delivery?.receivedOn) return delivery.receivedOn;
  return localIsoDate(ctx.now);
}

function summaryFor(verb: string, code: string, expectedGrade: string, grade: string): string {
  const review = gradeReview(expectedGrade, grade);
  return review ? `${verb} ${code}. ${review}` : `${verb} ${code}`;
}

function commitSpecialty(
  snapshot: AppSnapshot,
  ctx: RecordContext,
  change: {
    materials: MaterialRecord[];
    fittings?: FittingRecord[];
    flanges?: FlangeRecord[];
    valves?: ValveRecord[];
    action: string;
    entityType: string;
    entityId: string;
    materialId: string;
    summary: string;
    verificationStatus: VerificationStatus;
  },
): AppSnapshot {
  const nowIso = ctx.now.toISOString();
  const audit: AuditLogRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    action: change.action,
    entityType: change.entityType,
    entityId: change.entityId,
    summary: change.summary,
    verificationStatus: change.verificationStatus,
    createdAt: nowIso,
  };
  let queue: SyncQueueItem[] = snapshot.queue;
  for (const item of [
    { entityType: change.entityType, entityId: change.entityId },
    { entityType: 'materials', entityId: change.materialId },
  ]) {
    queue = enqueue(queue, {
      id: ctx.newId(),
      entityType: item.entityType,
      entityId: item.entityId,
      op: 'upsert',
      createdAt: nowIso,
    });
  }
  return {
    ...snapshot,
    materials: change.materials,
    fittings: change.fittings ?? snapshot.fittings,
    flanges: change.flanges ?? snapshot.flanges,
    valves: change.valves ?? snapshot.valves,
    auditLogs: [...snapshot.auditLogs, audit],
    queue,
  };
}

function upsertMaterial(
  snapshot: AppSnapshot,
  existing: MaterialRecord | undefined,
  next: Omit<MaterialRecord, 'id' | 'projectId' | 'materialCode' | 'verificationStatus'> & {
    materialCode: string;
    verificationStatus: VerificationStatus;
  },
  ctx: RecordContext,
): { materials: MaterialRecord[]; material: MaterialRecord } {
  if (!existing) {
    const created: MaterialRecord = {
      ...next,
      id: ctx.newId(),
      projectId: snapshot.project.id,
    };
    return { materials: [...snapshot.materials, created], material: created };
  }
  const updated: MaterialRecord = {
    ...existing,
    ...next,
    id: existing.id,
    projectId: existing.projectId,
    materialCode: existing.materialCode,
    verificationStatus: existing.verificationStatus === 'match' ? 'review_required' : existing.verificationStatus,
  };
  return {
    materials: snapshot.materials.map((material) => (material.id === existing.id ? updated : material)),
    material: updated,
  };
}

export function saveFitting(snapshot: AppSnapshot, input: FittingInput, ctx: RecordContext): SpecialtySaveResult {
  const errors: string[] = [];
  const description = clean(input.description);
  if (!description) errors.push('Description is required.');
  if (!FITTING_TYPES.includes(input.fittingType)) errors.push('Choose a fitting type.');
  const quantity = parseQuantity(input.quantity);
  if (quantity.error) errors.push(quantity.error);
  const angle = parseAngle(input.angleDeg);
  if (angle.error) errors.push(angle.error);
  const links = linkIds(snapshot, input);
  errors.push(...links.errors);
  if (errors.length > 0) return { snapshot, errors };

  const existing = input.id ? snapshot.fittings.find((item) => item.id === input.id) : undefined;
  if (input.id && !existing) return { snapshot, errors: ['That fitting is not on this device.'] };

  const verificationStatus = keptStatus(existing?.verificationStatus ?? null);
  const grade = clean(input.grade);
  const expectedGrade = clean(input.expectedGrade);
  const materialCode = existing?.materialCode ?? nextMaterialCode('fitting', collectMaterialCodes(snapshot));
  const linked = snapshot.materials.find((material) => material.id === existing?.materialId);
  const materialDraft = materialDraftFrom(snapshot, ctx, {
    existing: linked,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode,
    category: 'fitting',
    description,
    diameter: clean(input.diameter),
    wallThickness: clean(input.wallThickness),
    grade,
    specification: clean(input.specification),
    manufacturer: clean(input.manufacturer),
    modelNumber: '',
    heatNumber: clean(input.heatNumber),
    serialOrLot: '',
    jointNumber: '',
    ansiPressureRating: '',
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus,
    notes: clean(input.notes),
  });
  const savedMaterial = upsertMaterial(snapshot, linked, materialDraft, ctx);
  const fitting: FittingRecord = {
    id: existing?.id ?? ctx.newId(),
    projectId: snapshot.project.id,
    materialId: savedMaterial.material.id,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode: savedMaterial.material.materialCode,
    fittingType: input.fittingType,
    description,
    diameter: clean(input.diameter),
    wallThickness: clean(input.wallThickness),
    grade,
    expectedGrade,
    specification: clean(input.specification),
    manufacturer: clean(input.manufacturer),
    heatNumber: clean(input.heatNumber),
    angleDeg: angle.value,
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus: savedMaterial.material.verificationStatus,
    notes: clean(input.notes),
  };
  const fittings = existing
    ? snapshot.fittings.map((item) => (item.id === fitting.id ? fitting : item))
    : [...snapshot.fittings, fitting];
  return {
    snapshot: commitSpecialty(snapshot, ctx, {
      materials: savedMaterial.materials,
      fittings,
      action: existing ? 'fitting_update' : 'fitting_receive',
      entityType: 'fittings',
      entityId: fitting.id,
      materialId: savedMaterial.material.id,
      summary: summaryFor(existing ? 'Updated fitting' : 'Received fitting', fitting.materialCode, expectedGrade, grade),
      verificationStatus: fitting.verificationStatus,
    }),
    errors: [],
    id: fitting.id,
    materialCode: fitting.materialCode,
  };
}

export function saveFlange(snapshot: AppSnapshot, input: FlangeInput, ctx: RecordContext): SpecialtySaveResult {
  const errors: string[] = [];
  const description = clean(input.description);
  if (!description) errors.push('Description is required.');
  if (!FLANGE_TYPES.includes(input.flangeType)) errors.push('Choose a flange type.');
  const quantity = parseQuantity(input.quantity);
  if (quantity.error) errors.push(quantity.error);
  const classRating = parseClass(input.classRating);
  if (classRating.error) errors.push(classRating.error);
  const links = linkIds(snapshot, input);
  errors.push(...links.errors);
  if (errors.length > 0) return { snapshot, errors };

  const existing = input.id ? snapshot.flanges.find((item) => item.id === input.id) : undefined;
  if (input.id && !existing) return { snapshot, errors: ['That flange is not on this device.'] };

  const verificationStatus = keptStatus(existing?.verificationStatus ?? null);
  const grade = clean(input.grade);
  const expectedGrade = clean(input.expectedGrade);
  const materialCode = existing?.materialCode ?? nextMaterialCode('flange', collectMaterialCodes(snapshot));
  const linked = snapshot.materials.find((material) => material.id === existing?.materialId);
  const ansi = classRating.value ? `Class ${classRating.value}` : '';
  const materialDraft = materialDraftFrom(snapshot, ctx, {
    existing: linked,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode,
    category: 'flange',
    description,
    diameter: clean(input.diameter),
    wallThickness: linked?.wallThickness ?? '',
    grade,
    specification: linked?.specification ?? '',
    manufacturer: clean(input.manufacturer),
    modelNumber: '',
    heatNumber: clean(input.heatNumber),
    serialOrLot: clean(input.serialOrLot),
    jointNumber: '',
    ansiPressureRating: ansi,
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus,
    notes: clean(input.notes),
  });
  const savedMaterial = upsertMaterial(snapshot, linked, materialDraft, ctx);
  const flange: FlangeRecord = {
    id: existing?.id ?? ctx.newId(),
    projectId: snapshot.project.id,
    materialId: savedMaterial.material.id,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode: savedMaterial.material.materialCode,
    flangeType: input.flangeType,
    description,
    diameter: clean(input.diameter),
    classRating: classRating.value,
    grade,
    expectedGrade,
    facing: clean(input.facing),
    manufacturer: clean(input.manufacturer),
    heatNumber: clean(input.heatNumber),
    serialOrLot: clean(input.serialOrLot),
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus: savedMaterial.material.verificationStatus,
    notes: clean(input.notes),
  };
  const flanges = existing
    ? snapshot.flanges.map((item) => (item.id === flange.id ? flange : item))
    : [...snapshot.flanges, flange];
  return {
    snapshot: commitSpecialty(snapshot, ctx, {
      materials: savedMaterial.materials,
      flanges,
      action: existing ? 'flange_update' : 'flange_receive',
      entityType: 'flanges',
      entityId: flange.id,
      materialId: savedMaterial.material.id,
      summary: summaryFor(existing ? 'Updated flange' : 'Received flange', flange.materialCode, expectedGrade, grade),
      verificationStatus: flange.verificationStatus,
    }),
    errors: [],
    id: flange.id,
    materialCode: flange.materialCode,
  };
}

export function saveValve(snapshot: AppSnapshot, input: ValveInput, ctx: RecordContext): SpecialtySaveResult {
  const errors: string[] = [];
  const description = clean(input.description);
  if (!description) errors.push('Description is required.');
  if (!VALVE_TYPES.includes(input.valveType)) errors.push('Choose a valve type.');
  if (!ACTUATOR_TYPES.includes(input.actuatorType)) errors.push('Choose an actuator type, or leave it blank.');
  const quantity = parseQuantity(input.quantity);
  if (quantity.error) errors.push(quantity.error);
  const classRating = parseClass(input.classRating);
  if (classRating.error) errors.push(classRating.error);
  const links = linkIds(snapshot, input);
  errors.push(...links.errors);
  if (errors.length > 0) return { snapshot, errors };

  const existing = input.id ? snapshot.valves.find((item) => item.id === input.id) : undefined;
  if (input.id && !existing) return { snapshot, errors: ['That valve is not on this device.'] };

  const verificationStatus = keptStatus(existing?.verificationStatus ?? null);
  const grade = clean(input.grade);
  const expectedGrade = clean(input.expectedGrade);
  const materialCode = existing?.materialCode ?? nextMaterialCode('valve', collectMaterialCodes(snapshot));
  const linked = snapshot.materials.find((material) => material.id === existing?.materialId);
  const ansi = classRating.value ? `Class ${classRating.value}` : '';
  const materialDraft = materialDraftFrom(snapshot, ctx, {
    existing: linked,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode,
    category: 'valve',
    description,
    diameter: clean(input.diameter),
    wallThickness: linked?.wallThickness ?? '',
    grade,
    specification: linked?.specification ?? '',
    manufacturer: clean(input.manufacturer),
    modelNumber: clean(input.modelNumber),
    heatNumber: clean(input.heatNumber),
    serialOrLot: clean(input.serialNumber),
    jointNumber: '',
    ansiPressureRating: ansi,
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus,
    notes: clean(input.notes),
  });
  const savedMaterial = upsertMaterial(snapshot, linked, materialDraft, ctx);
  const valve: ValveRecord = {
    id: existing?.id ?? ctx.newId(),
    projectId: snapshot.project.id,
    materialId: savedMaterial.material.id,
    deliveryId: links.deliveryId,
    purchaseOrderId: links.purchaseOrderId,
    materialCode: savedMaterial.material.materialCode,
    valveType: input.valveType,
    description,
    diameter: clean(input.diameter),
    classRating: classRating.value,
    grade,
    expectedGrade,
    manufacturer: clean(input.manufacturer),
    modelNumber: clean(input.modelNumber),
    heatNumber: clean(input.heatNumber),
    serialNumber: clean(input.serialNumber),
    actuatorType: input.actuatorType,
    actuatorManufacturer: clean(input.actuatorManufacturer),
    actuatorModel: clean(input.actuatorModel),
    actuatorSerial: clean(input.actuatorSerial),
    quantity: quantity.value,
    custodyStatus: input.custodyStatus,
    verificationStatus: savedMaterial.material.verificationStatus,
    notes: clean(input.notes),
  };
  const valves = existing ? snapshot.valves.map((item) => (item.id === valve.id ? valve : item)) : [...snapshot.valves, valve];
  return {
    snapshot: commitSpecialty(snapshot, ctx, {
      materials: savedMaterial.materials,
      valves,
      action: existing ? 'valve_update' : 'valve_receive',
      entityType: 'valves',
      entityId: valve.id,
      materialId: savedMaterial.material.id,
      summary: summaryFor(existing ? 'Updated valve' : 'Received valve', valve.materialCode, expectedGrade, grade),
      verificationStatus: valve.verificationStatus,
    }),
    errors: [],
    id: valve.id,
    materialCode: valve.materialCode,
  };
}

function materialDraftFrom(
  snapshot: AppSnapshot,
  ctx: RecordContext,
  input: {
    existing: MaterialRecord | undefined;
    deliveryId: string | null;
    purchaseOrderId: string | null;
    materialCode: string;
    category: MaterialCategory;
    description: string;
    diameter: string;
    wallThickness: string;
    grade: string;
    specification: string;
    manufacturer: string;
    modelNumber: string;
    heatNumber: string;
    serialOrLot: string;
    jointNumber: string;
    ansiPressureRating: string;
    quantity: number;
    custodyStatus: CustodyStatus;
    verificationStatus: VerificationStatus;
    notes: string;
  },
): Omit<MaterialRecord, 'id' | 'projectId'> {
  return {
    deliveryId: input.deliveryId,
    purchaseOrderId: input.purchaseOrderId,
    materialCode: input.materialCode,
    category: input.category,
    description: input.description,
    diameter: input.diameter,
    wallThickness: input.wallThickness,
    grade: input.grade,
    specification: input.specification,
    manufacturer: input.manufacturer,
    modelNumber: input.modelNumber,
    heatNumber: input.heatNumber,
    serialOrLot: input.serialOrLot,
    jointNumber: input.jointNumber,
    ansiPressureRating: input.ansiPressureRating,
    quantity: input.quantity,
    unit: 'ea',
    custodyStatus: input.custodyStatus,
    verificationStatus: input.verificationStatus,
    receivedOn: receivedOn(snapshot, input.deliveryId, input.custodyStatus, ctx, input.existing?.receivedOn ?? null),
    notes: input.notes,
  };
}

export function actuatorLinked(
  valve: Pick<ValveRecord, 'actuatorType' | 'actuatorManufacturer' | 'actuatorModel' | 'actuatorSerial'>,
): boolean {
  return Boolean(
    valve.actuatorType || valve.actuatorManufacturer.trim() || valve.actuatorModel.trim() || valve.actuatorSerial.trim(),
  );
}

export function blankFittingInput(): FittingInput {
  return {
    fittingType: 'elbow',
    description: '',
    diameter: '',
    wallThickness: '',
    grade: '',
    expectedGrade: '',
    specification: '',
    manufacturer: '',
    heatNumber: '',
    angleDeg: '',
    quantity: '1',
    custodyStatus: 'received',
    notes: '',
    deliveryId: null,
    purchaseOrderId: null,
  };
}

export function fittingInputFrom(record: FittingRecord): FittingInput {
  return {
    id: record.id,
    fittingType: record.fittingType,
    description: record.description,
    diameter: record.diameter,
    wallThickness: record.wallThickness,
    grade: record.grade,
    expectedGrade: record.expectedGrade,
    specification: record.specification,
    manufacturer: record.manufacturer,
    heatNumber: record.heatNumber,
    angleDeg: record.angleDeg === null ? '' : String(record.angleDeg),
    quantity: String(record.quantity),
    custodyStatus: record.custodyStatus,
    notes: record.notes,
    deliveryId: record.deliveryId,
    purchaseOrderId: record.purchaseOrderId,
  };
}

export function blankFlangeInput(): FlangeInput {
  return {
    flangeType: 'wn',
    description: '',
    diameter: '',
    classRating: '',
    grade: '',
    expectedGrade: '',
    facing: '',
    manufacturer: '',
    heatNumber: '',
    serialOrLot: '',
    quantity: '1',
    custodyStatus: 'received',
    notes: '',
    deliveryId: null,
    purchaseOrderId: null,
  };
}

export function flangeInputFrom(record: FlangeRecord): FlangeInput {
  return {
    id: record.id,
    flangeType: record.flangeType,
    description: record.description,
    diameter: record.diameter,
    classRating: record.classRating,
    grade: record.grade,
    expectedGrade: record.expectedGrade,
    facing: record.facing,
    manufacturer: record.manufacturer,
    heatNumber: record.heatNumber,
    serialOrLot: record.serialOrLot,
    quantity: String(record.quantity),
    custodyStatus: record.custodyStatus,
    notes: record.notes,
    deliveryId: record.deliveryId,
    purchaseOrderId: record.purchaseOrderId,
  };
}

export function blankValveInput(): ValveInput {
  return {
    valveType: 'ball',
    description: '',
    diameter: '',
    classRating: '',
    grade: '',
    expectedGrade: '',
    manufacturer: '',
    modelNumber: '',
    heatNumber: '',
    serialNumber: '',
    actuatorType: '',
    actuatorManufacturer: '',
    actuatorModel: '',
    actuatorSerial: '',
    quantity: '1',
    custodyStatus: 'received',
    notes: '',
    deliveryId: null,
    purchaseOrderId: null,
  };
}

export function valveInputFrom(record: ValveRecord): ValveInput {
  return {
    id: record.id,
    valveType: record.valveType,
    description: record.description,
    diameter: record.diameter,
    classRating: record.classRating,
    grade: record.grade,
    expectedGrade: record.expectedGrade,
    manufacturer: record.manufacturer,
    modelNumber: record.modelNumber,
    heatNumber: record.heatNumber,
    serialNumber: record.serialNumber,
    actuatorType: record.actuatorType,
    actuatorManufacturer: record.actuatorManufacturer,
    actuatorModel: record.actuatorModel,
    actuatorSerial: record.actuatorSerial,
    quantity: String(record.quantity),
    custodyStatus: record.custodyStatus,
    notes: record.notes,
    deliveryId: record.deliveryId,
    purchaseOrderId: record.purchaseOrderId,
  };
}
