import type {
  AppSnapshot,
  AuditLogRecord,
  DamageReportRecord,
  DeliveryRecord,
  DiscrepancyRecord,
  DocumentRecord,
  FittingRecord,
  FlangeRecord,
  HoldRecord,
  MaterialRecord,
  MtrLinkRecord,
  MtrRecord,
  MtrRequestRecord,
  PhotoRecord,
  PipeJointRecord,
  ProjectRecord,
  PurchaseOrderRecord,
  ValveRecord,
} from './types';

export const SYNC_TABLES = [
  'projects',
  'purchase_orders',
  'deliveries',
  'materials',
  'pipe_joints',
  'fittings',
  'flanges',
  'valves',
  'documents',
  'photos',
  'mtrs',
  'material_mtr_links',
  'holds',
  'damage_reports',
  'discrepancies',
  'mtr_requests',
] as const;

export type SyncTable = (typeof SYNC_TABLES)[number];

type Row = Record<string, unknown>;

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function nullableId(value: string | null): string | null {
  return value ? value : null;
}

function num(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nullableNum(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateOrNull(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).slice(0, 10);
}

export function toRemoteRow(snapshot: AppSnapshot, entityType: string, entityId: string): Row | null {
  if (entityType === 'projects') {
    if (snapshot.project.id !== entityId || !snapshot.project.name.trim()) return null;
    return projectToRow(snapshot.project);
  }
  const list = listFor(snapshot, entityType);
  const found = list?.find((item) => item.id === entityId);
  if (!found) return null;
  return rowFor(entityType, found);
}

function listFor(snapshot: AppSnapshot, entityType: string): Array<{ id: string }> | null {
  switch (entityType) {
    case 'purchase_orders':
      return snapshot.purchaseOrders;
    case 'deliveries':
      return snapshot.deliveries;
    case 'materials':
      return snapshot.materials;
    case 'pipe_joints':
      return snapshot.pipeJoints;
    case 'fittings':
      return snapshot.fittings;
    case 'flanges':
      return snapshot.flanges;
    case 'valves':
      return snapshot.valves;
    case 'documents':
      return snapshot.documents;
    case 'photos':
      return snapshot.photos;
    case 'mtrs':
      return snapshot.mtrs;
    case 'material_mtr_links':
      return snapshot.mtrLinks;
    case 'holds':
      return snapshot.holds;
    case 'damage_reports':
      return snapshot.damageReports;
    case 'discrepancies':
      return snapshot.discrepancies;
    case 'mtr_requests':
      return snapshot.mtrRequests;
    default:
      return null;
  }
}

function rowFor(entityType: string, record: { id: string }): Row | null {
  switch (entityType) {
    case 'purchase_orders':
      return purchaseOrderToRow(record as PurchaseOrderRecord);
    case 'deliveries':
      return deliveryToRow(record as DeliveryRecord);
    case 'materials':
      return materialToRow(record as MaterialRecord);
    case 'pipe_joints':
      return pipeJointToRow(record as PipeJointRecord);
    case 'fittings':
      return fittingToRow(record as FittingRecord);
    case 'flanges':
      return flangeToRow(record as FlangeRecord);
    case 'valves':
      return valveToRow(record as ValveRecord);
    case 'documents':
      return documentToRow(record as DocumentRecord);
    case 'photos':
      return photoToRow(record as PhotoRecord);
    case 'mtrs':
      return mtrToRow(record as MtrRecord);
    case 'material_mtr_links':
      return mtrLinkToRow(record as MtrLinkRecord);
    case 'holds':
      return holdToRow(record as HoldRecord);
    case 'damage_reports':
      return damageToRow(record as DamageReportRecord);
    case 'discrepancies':
      return discrepancyToRow(record as DiscrepancyRecord);
    case 'mtr_requests':
      return mtrRequestToRow(record as MtrRequestRecord);
    default:
      return null;
  }
}

export function projectToRow(project: ProjectRecord): Row {
  return {
    id: project.id,
    name: project.name,
    project_number: project.projectNumber,
    construction_order_no: project.constructionOrderNo,
    atmos_project_number: project.atmosProjectNumber,
    inspector_name: project.inspectorName,
    vendor: project.vendor,
    sales_order_or_customer_po: project.salesOrderOrCustomerPo,
    client_name: project.clientName,
    spread: project.spread,
    location_name: project.locationName,
    notes: project.notes,
    status: project.status,
  };
}

function purchaseOrderToRow(record: PurchaseOrderRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    po_number: record.poNumber,
    vendor: record.vendor,
    sales_order_number: record.salesOrderNumber,
    issued_on: record.issuedOn,
    notes: record.notes,
    status: record.status,
  };
}

function deliveryToRow(record: DeliveryRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    purchase_order_id: nullableId(record.purchaseOrderId),
    received_on: record.receivedOn,
    scheduled_on: record.scheduledOn,
    vendor: record.vendor,
    inspector_name: record.inspectorName,
    carrier: record.carrier,
    bol_number: record.bolNumber,
    packing_slip_number: record.packingSlipNumber,
    shipment_number_mrc: record.shipmentNumberMrc,
    sales_order_or_customer_po: record.salesOrderOrCustomerPo,
    atmos_project_number: record.atmosProjectNumber,
    status: record.status,
    notes: record.notes,
    latitude: record.latitude,
    longitude: record.longitude,
    gps_status: record.gpsStatus,
  };
}

function materialToRow(record: MaterialRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    delivery_id: nullableId(record.deliveryId),
    purchase_order_id: nullableId(record.purchaseOrderId),
    material_code: record.materialCode,
    category: record.category,
    description: record.description,
    diameter: record.diameter,
    wall_thickness: record.wallThickness,
    grade: record.grade,
    specification: record.specification,
    manufacturer: record.manufacturer,
    model_number: record.modelNumber,
    heat_number: record.heatNumber,
    serial_or_lot: record.serialOrLot,
    joint_number: record.jointNumber,
    ansi_pressure_rating: record.ansiPressureRating,
    quantity: record.quantity,
    unit: record.unit,
    custody_status: record.custodyStatus,
    verification_status: record.verificationStatus,
    received_on: record.receivedOn,
    notes: record.notes,
  };
}

function pipeJointToRow(record: PipeJointRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: nullableId(record.materialId),
    delivery_id: nullableId(record.deliveryId),
    material_code: record.materialCode,
    joint_number: record.jointNumber,
    heat_number: record.heatNumber,
    manufacturer: record.manufacturer,
    diameter: record.diameter,
    wall_thickness: record.wallThickness,
    grade: record.grade,
    specification: record.specification,
    length_ft: record.lengthFt,
    expected_length_ft: record.expectedLengthFt,
    coating: record.coating,
    custody_status: record.custodyStatus,
    verification_status: record.verificationStatus,
    notes: record.notes,
  };
}

function fittingToRow(record: FittingRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: nullableId(record.materialId),
    delivery_id: nullableId(record.deliveryId),
    purchase_order_id: nullableId(record.purchaseOrderId),
    material_code: record.materialCode,
    fitting_type: record.fittingType,
    description: record.description,
    diameter: record.diameter,
    wall_thickness: record.wallThickness,
    grade: record.grade,
    expected_grade: record.expectedGrade,
    specification: record.specification,
    manufacturer: record.manufacturer,
    heat_number: record.heatNumber,
    angle_deg: record.angleDeg,
    quantity: record.quantity,
    custody_status: record.custodyStatus,
    verification_status: record.verificationStatus,
    notes: record.notes,
  };
}

function flangeToRow(record: FlangeRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: nullableId(record.materialId),
    delivery_id: nullableId(record.deliveryId),
    purchase_order_id: nullableId(record.purchaseOrderId),
    material_code: record.materialCode,
    flange_type: record.flangeType,
    description: record.description,
    diameter: record.diameter,
    class_rating: record.classRating,
    grade: record.grade,
    expected_grade: record.expectedGrade,
    facing: record.facing,
    manufacturer: record.manufacturer,
    heat_number: record.heatNumber,
    serial_or_lot: record.serialOrLot,
    quantity: record.quantity,
    custody_status: record.custodyStatus,
    verification_status: record.verificationStatus,
    notes: record.notes,
  };
}

function valveToRow(record: ValveRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: nullableId(record.materialId),
    delivery_id: nullableId(record.deliveryId),
    purchase_order_id: nullableId(record.purchaseOrderId),
    material_code: record.materialCode,
    valve_type: record.valveType,
    description: record.description,
    diameter: record.diameter,
    class_rating: record.classRating,
    grade: record.grade,
    expected_grade: record.expectedGrade,
    manufacturer: record.manufacturer,
    model_number: record.modelNumber,
    heat_number: record.heatNumber,
    serial_number: record.serialNumber,
    actuator_type: record.actuatorType,
    actuator_manufacturer: record.actuatorManufacturer,
    actuator_model: record.actuatorModel,
    actuator_serial: record.actuatorSerial,
    quantity: record.quantity,
    custody_status: record.custodyStatus,
    verification_status: record.verificationStatus,
    notes: record.notes,
  };
}

function documentToRow(record: DocumentRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    doc_type: record.docType,
    title: record.title,
    file_name: record.fileName || record.title || 'file',
    mime_type: record.mimeType,
    byte_size: record.byteSize,
    subject_type: record.subjectType || 'project',
    subject_id: nullableId(record.subjectId),
    notes: record.notes,
  };
}

function photoToRow(record: PhotoRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    subject_type: record.subjectType,
    subject_id: record.subjectId,
    role: record.role,
    caption: record.caption,
    byte_size: record.byteSize,
    captured_at: record.capturedAt,
    permission_status: record.permissionStatus,
    gps_status: 'not_requested',
  };
}

function mtrToRow(record: MtrRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    mtr_number: record.mtrNumber,
    heat_number: record.heatNumber,
    manufacturer: record.manufacturer,
    description: record.description,
    specification: record.specification,
    grade: record.grade,
    paperwork_status: record.paperworkStatus,
    notes: record.notes,
  };
}

function mtrLinkToRow(record: MtrLinkRecord): Row | null {
  if (!record.materialId) return null;
  return {
    id: record.id,
    project_id: record.projectId,
    mtr_id: record.mtrId,
    material_id: record.materialId,
    heat_number_on_item: record.heatNumberOnItem,
    heat_number_on_mtr: record.heatNumberOnMtr,
    verification_status: record.verificationStatus,
    notes: record.notes,
  };
}

function holdToRow(record: HoldRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: record.materialId,
    reason: record.reason,
    status: record.status,
    held_at: record.heldAt,
    released_at: record.status === 'released' ? record.heldAt : null,
  };
}

function damageToRow(record: DamageReportRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: record.materialId,
    description: record.description,
    severity: record.severity,
    status: record.status,
    reported_at: record.reportedAt,
    closed_at: record.status === 'closed' ? record.reportedAt : null,
  };
}

function discrepancyToRow(record: DiscrepancyRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    material_id: nullableId(record.materialId),
    delivery_id: nullableId(record.deliveryId),
    title: record.title,
    description: record.description,
    status: record.status,
    verification_status: record.verificationStatus,
    opened_at: record.openedAt,
    resolved_at: record.status === 'resolved' ? record.openedAt : null,
  };
}

function mtrRequestToRow(record: MtrRequestRecord): Row {
  return {
    id: record.id,
    project_id: record.projectId,
    inspector_name: record.inspectorName,
    vendor: record.vendor,
    atmos_project_number: record.atmosProjectNumber,
    sales_order_or_customer_po: record.salesOrderOrCustomerPo,
    shipment_number_mrc: record.shipmentNumberMrc,
    lines: record.lines,
    status_note: record.statusNote,
    created_at: record.createdAt,
  };
}

export function projectFromRow(row: Row): ProjectRecord {
  return {
    id: text(row.id),
    name: text(row.name),
    projectNumber: text(row.project_number),
    constructionOrderNo: text(row.construction_order_no),
    atmosProjectNumber: text(row.atmos_project_number),
    inspectorName: text(row.inspector_name),
    vendor: text(row.vendor),
    salesOrderOrCustomerPo: text(row.sales_order_or_customer_po),
    clientName: text(row.client_name),
    spread: text(row.spread),
    locationName: text(row.location_name),
    notes: text(row.notes),
    status: text(row.status) === 'archived' ? 'archived' : 'active',
  };
}

export function materialFromRow(row: Row): MaterialRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    deliveryId: text(row.delivery_id) || null,
    purchaseOrderId: text(row.purchase_order_id) || null,
    materialCode: text(row.material_code),
    category: text(row.category) as MaterialRecord['category'],
    description: text(row.description),
    diameter: text(row.diameter),
    wallThickness: text(row.wall_thickness),
    grade: text(row.grade),
    specification: text(row.specification),
    manufacturer: text(row.manufacturer),
    modelNumber: text(row.model_number),
    heatNumber: text(row.heat_number),
    serialOrLot: text(row.serial_or_lot),
    jointNumber: text(row.joint_number),
    ansiPressureRating: text(row.ansi_pressure_rating),
    quantity: num(row.quantity, 0),
    unit: text(row.unit) || 'ea',
    custodyStatus: text(row.custody_status) as MaterialRecord['custodyStatus'],
    verificationStatus: text(row.verification_status) as MaterialRecord['verificationStatus'],
    receivedOn: dateOrNull(row.received_on),
    notes: text(row.notes),
  };
}

export function pipeJointFromRow(row: Row): PipeJointRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id) || null,
    deliveryId: text(row.delivery_id) || null,
    materialCode: text(row.material_code),
    jointNumber: text(row.joint_number),
    heatNumber: text(row.heat_number),
    manufacturer: text(row.manufacturer),
    diameter: text(row.diameter),
    wallThickness: text(row.wall_thickness),
    grade: text(row.grade),
    specification: text(row.specification),
    lengthFt: nullableNum(row.length_ft),
    expectedLengthFt: nullableNum(row.expected_length_ft),
    coating: text(row.coating),
    custodyStatus: text(row.custody_status) as PipeJointRecord['custodyStatus'],
    verificationStatus: text(row.verification_status) as PipeJointRecord['verificationStatus'],
    notes: text(row.notes),
  };
}

function purchaseOrderFromRow(row: Row): PurchaseOrderRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    poNumber: text(row.po_number),
    vendor: text(row.vendor),
    salesOrderNumber: text(row.sales_order_number),
    issuedOn: dateOrNull(row.issued_on),
    notes: text(row.notes),
    status: text(row.status) as PurchaseOrderRecord['status'],
  };
}

function deliveryFromRow(row: Row): DeliveryRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    purchaseOrderId: text(row.purchase_order_id) || null,
    receivedOn: dateOrNull(row.received_on),
    scheduledOn: dateOrNull(row.scheduled_on),
    vendor: text(row.vendor),
    inspectorName: text(row.inspector_name),
    carrier: text(row.carrier),
    bolNumber: text(row.bol_number),
    packingSlipNumber: text(row.packing_slip_number),
    shipmentNumberMrc: text(row.shipment_number_mrc),
    salesOrderOrCustomerPo: text(row.sales_order_or_customer_po),
    atmosProjectNumber: text(row.atmos_project_number),
    status: text(row.status) as DeliveryRecord['status'],
    notes: text(row.notes),
    latitude: nullableNum(row.latitude),
    longitude: nullableNum(row.longitude),
    gpsStatus: text(row.gps_status) as DeliveryRecord['gpsStatus'],
  };
}

function fittingFromRow(row: Row): FittingRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id) || null,
    deliveryId: text(row.delivery_id) || null,
    purchaseOrderId: text(row.purchase_order_id) || null,
    materialCode: text(row.material_code),
    fittingType: text(row.fitting_type) as FittingRecord['fittingType'],
    description: text(row.description),
    diameter: text(row.diameter),
    wallThickness: text(row.wall_thickness),
    grade: text(row.grade),
    expectedGrade: text(row.expected_grade),
    specification: text(row.specification),
    manufacturer: text(row.manufacturer),
    heatNumber: text(row.heat_number),
    angleDeg: nullableNum(row.angle_deg),
    quantity: num(row.quantity, 0),
    custodyStatus: text(row.custody_status) as FittingRecord['custodyStatus'],
    verificationStatus: text(row.verification_status) as FittingRecord['verificationStatus'],
    notes: text(row.notes),
  };
}

function flangeFromRow(row: Row): FlangeRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id) || null,
    deliveryId: text(row.delivery_id) || null,
    purchaseOrderId: text(row.purchase_order_id) || null,
    materialCode: text(row.material_code),
    flangeType: text(row.flange_type) as FlangeRecord['flangeType'],
    description: text(row.description),
    diameter: text(row.diameter),
    classRating: text(row.class_rating),
    grade: text(row.grade),
    expectedGrade: text(row.expected_grade),
    facing: text(row.facing),
    manufacturer: text(row.manufacturer),
    heatNumber: text(row.heat_number),
    serialOrLot: text(row.serial_or_lot),
    quantity: num(row.quantity, 0),
    custodyStatus: text(row.custody_status) as FlangeRecord['custodyStatus'],
    verificationStatus: text(row.verification_status) as FlangeRecord['verificationStatus'],
    notes: text(row.notes),
  };
}

function valveFromRow(row: Row): ValveRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id) || null,
    deliveryId: text(row.delivery_id) || null,
    purchaseOrderId: text(row.purchase_order_id) || null,
    materialCode: text(row.material_code),
    valveType: text(row.valve_type) as ValveRecord['valveType'],
    description: text(row.description),
    diameter: text(row.diameter),
    classRating: text(row.class_rating),
    grade: text(row.grade),
    expectedGrade: text(row.expected_grade),
    manufacturer: text(row.manufacturer),
    modelNumber: text(row.model_number),
    heatNumber: text(row.heat_number),
    serialNumber: text(row.serial_number),
    actuatorType: text(row.actuator_type) as ValveRecord['actuatorType'],
    actuatorManufacturer: text(row.actuator_manufacturer),
    actuatorModel: text(row.actuator_model),
    actuatorSerial: text(row.actuator_serial),
    quantity: num(row.quantity, 0),
    custodyStatus: text(row.custody_status) as ValveRecord['custodyStatus'],
    verificationStatus: text(row.verification_status) as ValveRecord['verificationStatus'],
    notes: text(row.notes),
  };
}

function documentFromRow(row: Row): DocumentRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    docType: text(row.doc_type) as DocumentRecord['docType'],
    title: text(row.title),
    fileName: text(row.file_name),
    mimeType: text(row.mime_type),
    byteSize: num(row.byte_size, 0),
    subjectType: text(row.subject_type),
    subjectId: text(row.subject_id),
    addedAt: text(row.created_at),
    notes: text(row.notes),
  };
}

function photoFromRow(row: Row): PhotoRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    subjectType: text(row.subject_type),
    subjectId: text(row.subject_id),
    role: text(row.role) as PhotoRecord['role'],
    caption: text(row.caption),
    permissionStatus: text(row.permission_status) as PhotoRecord['permissionStatus'],
    byteSize: num(row.byte_size, 0),
    capturedAt: text(row.captured_at) || null,
  };
}

function mtrFromRow(row: Row): MtrRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    mtrNumber: text(row.mtr_number),
    heatNumber: text(row.heat_number),
    manufacturer: text(row.manufacturer),
    description: text(row.description),
    grade: text(row.grade),
    specification: text(row.specification),
    paperworkStatus: text(row.paperwork_status) as MtrRecord['paperworkStatus'],
    notes: text(row.notes),
  };
}

function mtrLinkFromRow(row: Row): MtrLinkRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    mtrId: text(row.mtr_id),
    materialId: text(row.material_id),
    heatNumberOnItem: text(row.heat_number_on_item),
    heatNumberOnMtr: text(row.heat_number_on_mtr),
    verificationStatus: text(row.verification_status) as MtrLinkRecord['verificationStatus'],
    notes: text(row.notes),
  };
}

function holdFromRow(row: Row): HoldRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id),
    reason: text(row.reason),
    status: text(row.status) === 'released' ? 'released' : 'open',
    heldAt: text(row.held_at),
  };
}

function damageFromRow(row: Row): DamageReportRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id),
    description: text(row.description),
    severity: text(row.severity) as DamageReportRecord['severity'],
    status: text(row.status) === 'closed' ? 'closed' : 'open',
    reportedAt: text(row.reported_at),
  };
}

function discrepancyFromRow(row: Row): DiscrepancyRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    materialId: text(row.material_id) || null,
    deliveryId: text(row.delivery_id) || null,
    title: text(row.title),
    description: text(row.description),
    status: text(row.status) === 'resolved' ? 'resolved' : 'open',
    verificationStatus: text(row.verification_status) as DiscrepancyRecord['verificationStatus'],
    openedAt: text(row.opened_at),
  };
}

function mtrRequestFromRow(row: Row): MtrRequestRecord {
  const lines = Array.isArray(row.lines) ? row.lines : [];
  return {
    id: text(row.id),
    projectId: text(row.project_id),
    inspectorName: text(row.inspector_name),
    vendor: text(row.vendor),
    atmosProjectNumber: text(row.atmos_project_number),
    salesOrderOrCustomerPo: text(row.sales_order_or_customer_po),
    shipmentNumberMrc: text(row.shipment_number_mrc),
    lines: lines.map((line) => {
      const item = line as Record<string, unknown>;
      return {
        materialDescription: text(item.materialDescription ?? item.material_description),
        diameter: text(item.diameter),
        wallThickness: text(item.wallThickness ?? item.wall_thickness),
        grade: text(item.grade),
        heatNumber: text(item.heatNumber ?? item.heat_number),
        manufacturer: text(item.manufacturer),
      };
    }),
    createdAt: text(row.created_at),
    statusNote: text(row.status_note),
  };
}

function auditFromRow(row: Row): AuditLogRecord {
  return {
    id: text(row.id),
    projectId: text(row.project_id) || null,
    action: text(row.action),
    entityType: text(row.entity_type),
    entityId: text(row.entity_id) || null,
    summary: `${text(row.action)} ${text(row.entity_type)}`.trim(),
    verificationStatus: null,
    createdAt: text(row.created_at),
  };
}

export interface RemoteBundle {
  project: Row | null;
  tables: Partial<Record<SyncTable, Row[]>>;
  audits?: Row[];
}

function pendingKey(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`;
}

function mergeRows<T extends { id: string }>(entityType: string, localRows: T[], remoteRows: T[], pending: Set<string>): T[] {
  const merged = new Map<string, T>();
  for (const row of remoteRows) merged.set(row.id, row);
  for (const row of localRows) {
    if (pending.has(pendingKey(entityType, row.id))) merged.set(row.id, row);
  }
  return [...merged.values()];
}

export function applyRemoteSnapshot(local: AppSnapshot, bundle: RemoteBundle): AppSnapshot {
  const pending = new Set(
    local.queue.filter((item) => item.status === 'pending').map((item) => pendingKey(item.entityType, item.entityId)),
  );
  const projectPending = pending.has(pendingKey('projects', local.project.id));
  const remoteProject = bundle.project ? projectFromRow(bundle.project) : null;
  const switching = remoteProject && remoteProject.id !== local.project.id && !projectPending && !local.project.name.trim();
  const project = projectPending || !remoteProject ? local.project : remoteProject;
  const base = switching
    ? {
        ...local,
        project,
        purchaseOrders: [],
        deliveries: [],
        materials: [],
        pipeJoints: [],
        fittings: [],
        flanges: [],
        valves: [],
        mtrs: [],
        mtrLinks: [],
        documents: [],
        photos: [],
        holds: [],
        damageReports: [],
        discrepancies: [],
        mtrRequests: [],
        auditLogs: [],
      }
    : { ...local, project };

  const tables = bundle.tables;
  const next: AppSnapshot = {
    ...base,
    purchaseOrders: mergeRows('purchase_orders', base.purchaseOrders, (tables.purchase_orders ?? []).map(purchaseOrderFromRow), pending),
    deliveries: mergeRows('deliveries', base.deliveries, (tables.deliveries ?? []).map(deliveryFromRow), pending),
    materials: mergeRows('materials', base.materials, (tables.materials ?? []).map(materialFromRow), pending),
    pipeJoints: mergeRows('pipe_joints', base.pipeJoints, (tables.pipe_joints ?? []).map(pipeJointFromRow), pending),
    fittings: mergeRows('fittings', base.fittings, (tables.fittings ?? []).map(fittingFromRow), pending),
    flanges: mergeRows('flanges', base.flanges, (tables.flanges ?? []).map(flangeFromRow), pending),
    valves: mergeRows('valves', base.valves, (tables.valves ?? []).map(valveFromRow), pending),
    documents: mergeRows('documents', base.documents, (tables.documents ?? []).map(documentFromRow), pending),
    photos: mergeRows('photos', base.photos, (tables.photos ?? []).map(photoFromRow), pending),
    mtrs: mergeRows('mtrs', base.mtrs, (tables.mtrs ?? []).map(mtrFromRow), pending),
    mtrLinks: mergeRows('material_mtr_links', base.mtrLinks, (tables.material_mtr_links ?? []).map(mtrLinkFromRow), pending),
    holds: mergeRows('holds', base.holds, (tables.holds ?? []).map(holdFromRow), pending),
    damageReports: mergeRows('damage_reports', base.damageReports, (tables.damage_reports ?? []).map(damageFromRow), pending),
    discrepancies: mergeRows('discrepancies', base.discrepancies, (tables.discrepancies ?? []).map(discrepancyFromRow), pending),
    mtrRequests: mergeRows('mtr_requests', base.mtrRequests, (tables.mtr_requests ?? []).map(mtrRequestFromRow), pending),
    auditLogs: mergeRows('audit_logs', base.auditLogs, (bundle.audits ?? []).map(auditFromRow), pending),
    settings: {
      ...local.settings,
      sample: false,
      guest: false,
    },
  };
  return next;
}
