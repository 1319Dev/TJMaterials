import { localIsoDate } from './dates';
import { collectMaterialCodes, nextMaterialCode } from './ids';
import { CUSTODY_LABELS, VERIFICATION_LABELS } from './labels';
import type { RecordContext } from './records';
import { enqueue } from './sync';
import type {
  AppSnapshot,
  AuditLogRecord,
  CustodyStatus,
  MaterialRecord,
  PipeJointRecord,
  SyncQueueItem,
  VerificationStatus,
} from './types';

export interface PipeJointInput {
  id?: string;
  jointNumber: string;
  heatNumber: string;
  lengthFt: string;
  expectedLengthFt: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  specification: string;
  manufacturer: string;
  coating: string;
  deliveryId: string | null;
  custodyStatus: CustodyStatus;
  notes: string;
}

export interface FootageBucket {
  label: string;
  jointCount: number;
  footage: number;
}

export interface TallyTotals {
  jointCount: number;
  totalFootage: number;
  averageLength: number | null;
  byHeat: FootageBucket[];
  byGrade: FootageBucket[];
  byWall: FootageBucket[];
  expectedFootage: number;
  receivedFootage: number;
  footageDifference: number;
}

export interface PipeJointSaveResult {
  snapshot: AppSnapshot;
  errors: string[];
  id?: string;
  materialCode?: string;
}

function clean(value: string): string {
  return value.trim();
}

export function round3(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function formatFeet(value: number): string {
  return round3(value).toFixed(3);
}

function parseFeet(value: string, label: string, required: boolean): { error: string | null; value: number | null } {
  const trimmed = clean(value);
  if (!trimmed) {
    return required
      ? { error: `${label} is required. It was not estimated.`, value: null }
      : { error: null, value: null };
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    return { error: `${label} must be a number of feet, zero or greater.`, value: null };
  }
  return { error: null, value: Number(trimmed) };
}

export function countedJoints(joints: readonly PipeJointRecord[]): PipeJointRecord[] {
  return joints.filter((joint) => joint.lengthFt !== null && joint.custodyStatus !== 'expected');
}

function buckets(
  joints: readonly PipeJointRecord[],
  pick: (joint: PipeJointRecord) => string,
  emptyLabel: string,
): FootageBucket[] {
  const grouped = new Map<string, FootageBucket>();
  for (const joint of countedJoints(joints)) {
    const label = pick(joint).trim() || emptyLabel;
    const current = grouped.get(label) ?? { label, jointCount: 0, footage: 0 };
    current.jointCount += 1;
    current.footage += joint.lengthFt ?? 0;
    grouped.set(label, current);
  }
  return [...grouped.values()].sort((a, b) => b.footage - a.footage || a.label.localeCompare(b.label));
}

export function tallyTotals(joints: readonly PipeJointRecord[]): TallyTotals {
  const counted = countedJoints(joints);
  const totalFootage = counted.reduce((sum, joint) => sum + (joint.lengthFt ?? 0), 0);
  const expectedFootage = joints.reduce((sum, joint) => sum + (joint.expectedLengthFt ?? 0), 0);
  return {
    jointCount: counted.length,
    totalFootage,
    averageLength: counted.length > 0 ? totalFootage / counted.length : null,
    byHeat: buckets(joints, (joint) => joint.heatNumber, 'Heat not recorded'),
    byGrade: buckets(joints, (joint) => joint.grade, 'Grade not recorded'),
    byWall: buckets(joints, (joint) => joint.wallThickness, 'Wall not recorded'),
    expectedFootage,
    receivedFootage: totalFootage,
    footageDifference: totalFootage - expectedFootage,
  };
}

function keptStatus(existing: VerificationStatus | null): VerificationStatus {
  if (!existing || existing === 'match') return 'review_required';
  return existing;
}

export function savePipeJoint(
  snapshot: AppSnapshot,
  input: PipeJointInput,
  ctx: RecordContext,
): PipeJointSaveResult {
  const errors: string[] = [];
  const jointNumber = clean(input.jointNumber);
  const heatNumber = clean(input.heatNumber);
  if (!jointNumber) errors.push('Joint number is required.');

  const length = parseFeet(input.lengthFt, 'Length', true);
  if (length.error) errors.push(length.error);
  const expected = parseFeet(input.expectedLengthFt, 'Expected length', false);
  if (expected.error) errors.push(expected.error);

  const duplicate = snapshot.pipeJoints.some(
    (joint) => joint.id !== input.id && joint.jointNumber.trim().toLowerCase() === jointNumber.toLowerCase(),
  );
  if (jointNumber && duplicate) errors.push(`Joint ${jointNumber} is already on the pipe tally.`);

  let deliveryId: string | null = null;
  if (input.deliveryId) {
    if (!snapshot.deliveries.some((delivery) => delivery.id === input.deliveryId)) {
      errors.push('That delivery is not on this device.');
    } else {
      deliveryId = input.deliveryId;
    }
  }

  if (errors.length > 0) return { snapshot, errors };

  const existing = input.id ? snapshot.pipeJoints.find((joint) => joint.id === input.id) : undefined;
  if (input.id && !existing) return { snapshot, errors: ['That joint is not on this tally.'] };

  const nowIso = ctx.now.toISOString();
  const verificationStatus = keptStatus(existing?.verificationStatus ?? null);
  const materialCode = existing?.materialCode ?? nextMaterialCode('pipe', collectMaterialCodes(snapshot));
  const joint: PipeJointRecord = {
    id: existing?.id ?? ctx.newId(),
    projectId: snapshot.project.id,
    materialId: existing?.materialId ?? null,
    deliveryId,
    materialCode,
    jointNumber,
    heatNumber,
    manufacturer: clean(input.manufacturer),
    diameter: clean(input.diameter),
    wallThickness: clean(input.wallThickness),
    grade: clean(input.grade),
    specification: clean(input.specification),
    lengthFt: length.value,
    expectedLengthFt: expected.value,
    coating: clean(input.coating),
    custodyStatus: input.custodyStatus,
    verificationStatus,
    notes: clean(input.notes),
  };

  const linked = snapshot.materials.find((material) => material.id === joint.materialId);
  let materialId = joint.materialId;
  let materials = snapshot.materials;
  if (!linked) {
    const created: MaterialRecord = {
      id: ctx.newId(),
      projectId: snapshot.project.id,
      deliveryId,
      purchaseOrderId: null,
      materialCode,
      category: 'pipe',
      description: jointDescription(joint),
      diameter: joint.diameter,
      wallThickness: joint.wallThickness,
      grade: joint.grade,
      specification: joint.specification,
      manufacturer: joint.manufacturer,
      modelNumber: '',
      heatNumber: joint.heatNumber,
      serialOrLot: '',
      jointNumber: joint.jointNumber,
      ansiPressureRating: '',
      quantity: 1,
      unit: 'ea',
      custodyStatus: joint.custodyStatus,
      verificationStatus,
      receivedOn: joint.custodyStatus === 'expected' ? null : receivedOn(snapshot, deliveryId, ctx),
      notes: joint.notes,
    };
    materialId = created.id;
    materials = [...materials, created];
  } else {
    materials = materials.map((material) =>
      material.id === linked.id
        ? {
            ...material,
            deliveryId,
            diameter: joint.diameter,
            wallThickness: joint.wallThickness,
            grade: joint.grade,
            specification: joint.specification,
            manufacturer: joint.manufacturer,
            heatNumber: joint.heatNumber,
            jointNumber: joint.jointNumber,
            custodyStatus: joint.custodyStatus,
            notes: joint.notes || material.notes,
            receivedOn:
              joint.custodyStatus === 'expected' ? null : material.receivedOn ?? receivedOn(snapshot, deliveryId, ctx),
          }
        : material,
    );
  }

  const stored: PipeJointRecord = { ...joint, materialId };
  const pipeJoints = existing
    ? snapshot.pipeJoints.map((item) => (item.id === stored.id ? stored : item))
    : [...snapshot.pipeJoints, stored];

  const audit: AuditLogRecord = {
    id: ctx.newId(),
    projectId: snapshot.project.id,
    action: existing ? 'tally_update' : 'tally_add',
    entityType: 'pipe_joints',
    entityId: stored.id,
    summary: existing
      ? `Updated pipe tally joint ${stored.jointNumber}`
      : `Pipe tally joint ${stored.jointNumber}`,
    verificationStatus,
    createdAt: nowIso,
  };

  let queue: SyncQueueItem[] = snapshot.queue;
  const queued = [
    { entityType: 'pipe_joints', entityId: stored.id },
    ...(materialId ? [{ entityType: 'materials', entityId: materialId }] : []),
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
      materials,
      pipeJoints,
      auditLogs: [...snapshot.auditLogs, audit],
      queue,
    },
    errors: [],
    id: stored.id,
    materialCode,
  };
}

function jointDescription(joint: PipeJointRecord): string {
  const parts = [joint.diameter ? `${joint.diameter}"` : '', joint.grade, 'line pipe', joint.jointNumber]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.join(' ') || `Line pipe ${joint.jointNumber}`;
}

function receivedOn(snapshot: AppSnapshot, deliveryId: string | null, ctx: RecordContext): string {
  const delivery = snapshot.deliveries.find((item) => item.id === deliveryId);
  if (delivery?.receivedOn) return delivery.receivedOn;
  return localIsoDate(ctx.now);
}

export function pipeJointShell(material: MaterialRecord, id: string): PipeJointRecord {
  return {
    id,
    projectId: material.projectId,
    materialId: material.id,
    deliveryId: material.deliveryId,
    materialCode: material.materialCode,
    jointNumber: material.jointNumber,
    heatNumber: material.heatNumber,
    manufacturer: material.manufacturer,
    diameter: material.diameter,
    wallThickness: material.wallThickness,
    grade: material.grade,
    specification: material.specification,
    lengthFt: null,
    expectedLengthFt: null,
    coating: '',
    custodyStatus: material.custodyStatus,
    verificationStatus: material.verificationStatus === 'match' ? 'review_required' : material.verificationStatus,
    notes: '',
  };
}

function csvCell(value: string): string {
  const safe = /^[=+@]/.test(value) ? `'${value}` : value;
  if (/[",\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

function csvLine(values: Array<string | number | null>): string {
  return values.map((value) => csvCell(value === null ? '' : String(value))).join(',');
}

export function tallyToCsv(joints: readonly PipeJointRecord[]): string {
  const totals = tallyTotals(joints);
  const rows = [
    csvLine([
      'Joint number',
      'Heat number',
      'Length ft',
      'Expected length ft',
      'Diameter',
      'Wall thickness',
      'Grade',
      'Specification',
      'Manufacturer',
      'Coating',
      'Material ID',
      'Custody',
      'Verification',
    ]),
    ...[...joints]
      .sort((a, b) => a.jointNumber.localeCompare(b.jointNumber, undefined, { numeric: true }))
      .map((joint) =>
        csvLine([
          joint.jointNumber,
          joint.heatNumber,
          joint.lengthFt === null ? '' : formatFeet(joint.lengthFt),
          joint.expectedLengthFt === null ? '' : formatFeet(joint.expectedLengthFt),
          joint.diameter,
          joint.wallThickness,
          joint.grade,
          joint.specification,
          joint.manufacturer,
          joint.coating,
          joint.materialCode,
          CUSTODY_LABELS[joint.custodyStatus],
          VERIFICATION_LABELS[joint.verificationStatus],
        ]),
      ),
    '',
    csvLine(['Summary', '']),
    csvLine(['Joint count', totals.jointCount]),
    csvLine(['Total footage', formatFeet(totals.totalFootage)]),
    csvLine(['Average length', totals.averageLength === null ? '' : formatFeet(totals.averageLength)]),
    csvLine(['Expected footage', formatFeet(totals.expectedFootage)]),
    csvLine(['Received footage', formatFeet(totals.receivedFootage)]),
    csvLine(['Footage difference', formatFeet(totals.footageDifference)]),
    csvLine(['Note', 'REVIEW REQUIRED. This tally does not accept material.']),
    '',
    csvLine(['Footage by heat', 'Joints', 'Footage']),
    ...totals.byHeat.map((bucket) => csvLine([bucket.label, bucket.jointCount, formatFeet(bucket.footage)])),
    '',
    csvLine(['Footage by grade', 'Joints', 'Footage']),
    ...totals.byGrade.map((bucket) => csvLine([bucket.label, bucket.jointCount, formatFeet(bucket.footage)])),
    '',
    csvLine(['Footage by wall', 'Joints', 'Footage']),
    ...totals.byWall.map((bucket) => csvLine([bucket.label, bucket.jointCount, formatFeet(bucket.footage)])),
  ];
  return `\uFEFF${rows.join('\n')}\n`;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function xmlCell(value: string | number | null, numeric = false): string {
  if (value === null || value === '') return '<Cell><Data ss:Type="String"></Data></Cell>';
  if (numeric && typeof value === 'number') return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  return `<Cell><Data ss:Type="String">${xmlEscape(String(value))}</Data></Cell>`;
}

function xmlRow(values: Array<string | number | null>, numericAt: number[] = []): string {
  return `<Row>${values.map((value, index) => xmlCell(value, numericAt.includes(index))).join('')}</Row>`;
}

export function tallyToExcel(joints: readonly PipeJointRecord[]): string {
  const totals = tallyTotals(joints);
  const ordered = [...joints].sort((a, b) => a.jointNumber.localeCompare(b.jointNumber, undefined, { numeric: true }));
  const jointRows = [
    xmlRow([
      'Joint number',
      'Heat number',
      'Length ft',
      'Expected length ft',
      'Diameter',
      'Wall thickness',
      'Grade',
      'Specification',
      'Manufacturer',
      'Coating',
      'Material ID',
      'Custody',
      'Verification',
    ]),
    ...ordered.map((joint) =>
      xmlRow(
        [
          joint.jointNumber,
          joint.heatNumber,
          joint.lengthFt,
          joint.expectedLengthFt,
          joint.diameter,
          joint.wallThickness,
          joint.grade,
          joint.specification,
          joint.manufacturer,
          joint.coating,
          joint.materialCode,
          CUSTODY_LABELS[joint.custodyStatus],
          VERIFICATION_LABELS[joint.verificationStatus],
        ],
        [2, 3],
      ),
    ),
  ];
  const totalRows = [
    xmlRow(['REVIEW REQUIRED. This tally does not accept material.']),
    xmlRow(['Joint count', totals.jointCount], [1]),
    xmlRow(['Total footage', round3(totals.totalFootage)], [1]),
    xmlRow(['Average length', totals.averageLength === null ? '' : round3(totals.averageLength)], [1]),
    xmlRow(['Expected footage', round3(totals.expectedFootage)], [1]),
    xmlRow(['Received footage', round3(totals.receivedFootage)], [1]),
    xmlRow(['Footage difference (received minus expected)', round3(totals.footageDifference)], [1]),
    xmlRow(['Footage by heat', 'Joints', 'Footage']),
    ...totals.byHeat.map((bucket) => xmlRow([bucket.label, bucket.jointCount, round3(bucket.footage)], [1, 2])),
    xmlRow(['Footage by grade', 'Joints', 'Footage']),
    ...totals.byGrade.map((bucket) => xmlRow([bucket.label, bucket.jointCount, round3(bucket.footage)], [1, 2])),
    xmlRow(['Footage by wall', 'Joints', 'Footage']),
    ...totals.byWall.map((bucket) => xmlRow([bucket.label, bucket.jointCount, round3(bucket.footage)], [1, 2])),
  ];
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Worksheet ss:Name="Joints"><Table>${jointRows.join('')}</Table></Worksheet>
<Worksheet ss:Name="Totals"><Table>${totalRows.join('')}</Table></Worksheet>
</Workbook>`;
}

export function blankPipeJointInput(): PipeJointInput {
  return {
    jointNumber: '',
    heatNumber: '',
    lengthFt: '',
    expectedLengthFt: '',
    diameter: '',
    wallThickness: '',
    grade: '',
    specification: '',
    manufacturer: '',
    coating: '',
    deliveryId: null,
    custodyStatus: 'received',
    notes: '',
  };
}
