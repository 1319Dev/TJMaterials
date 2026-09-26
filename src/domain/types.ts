export type VerificationStatus =
  | 'match'
  | 'difference_found'
  | 'review_required'
  | 'not_provided'
  | 'not_verified'
  | 'missing_documentation';

export type MaterialCategory = 'pipe' | 'fitting' | 'flange' | 'valve' | 'other';

export type FittingType = 'elbow' | 'tee' | 'reducer' | 'cap' | 'other';

export type FlangeType = 'wn' | 'so' | 'blind' | 'lap_joint' | 'threaded' | 'other';

export type ValveType = 'ball' | 'gate' | 'plug' | 'check' | 'other';

export type ActuatorType = '' | 'electric' | 'pneumatic' | 'hydraulic' | 'manual_gear' | 'other';

export type CustodyStatus = 'expected' | 'received' | 'on_hold' | 'damaged' | 'installed';

export type ThemeMode = 'light' | 'dark' | 'outdoor';

export type GpsStatus = 'not_requested' | 'granted' | 'denied' | 'unavailable' | 'not_provided';

export interface ProjectRecord {
  id: string;
  name: string;
  projectNumber: string;
  constructionOrderNo: string;
  atmosProjectNumber: string;
  inspectorName: string;
  vendor: string;
  salesOrderOrCustomerPo: string;
  clientName: string;
  spread: string;
  locationName: string;
  notes: string;
  status: 'active' | 'archived';
}

export interface PurchaseOrderRecord {
  id: string;
  projectId: string;
  poNumber: string;
  vendor: string;
  salesOrderNumber: string;
  issuedOn: string | null;
  notes: string;
  status: 'open' | 'closed' | 'void';
}

export interface DeliveryRecord {
  id: string;
  projectId: string;
  purchaseOrderId: string | null;
  receivedOn: string | null;
  scheduledOn: string | null;
  vendor: string;
  inspectorName: string;
  carrier: string;
  bolNumber: string;
  packingSlipNumber: string;
  shipmentNumberMrc: string;
  salesOrderOrCustomerPo: string;
  atmosProjectNumber: string;
  status: 'expected' | 'received' | 'partial';
  notes: string;
  latitude: number | null;
  longitude: number | null;
  gpsStatus: GpsStatus;
}

export interface MaterialRecord {
  id: string;
  projectId: string;
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
  unit: string;
  custodyStatus: CustodyStatus;
  verificationStatus: VerificationStatus;
  receivedOn: string | null;
  notes: string;
}

export interface PipeJointRecord {
  id: string;
  projectId: string;
  materialId: string | null;
  deliveryId: string | null;
  materialCode: string;
  jointNumber: string;
  heatNumber: string;
  manufacturer: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  specification: string;
  lengthFt: number | null;
  expectedLengthFt: number | null;
  coating: string;
  custodyStatus: CustodyStatus;
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface FittingRecord {
  id: string;
  projectId: string;
  materialId: string | null;
  deliveryId: string | null;
  purchaseOrderId: string | null;
  materialCode: string;
  fittingType: FittingType;
  description: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  expectedGrade: string;
  specification: string;
  manufacturer: string;
  heatNumber: string;
  angleDeg: number | null;
  quantity: number;
  custodyStatus: CustodyStatus;
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface FlangeRecord {
  id: string;
  projectId: string;
  materialId: string | null;
  deliveryId: string | null;
  purchaseOrderId: string | null;
  materialCode: string;
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
  quantity: number;
  custodyStatus: CustodyStatus;
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface ValveRecord {
  id: string;
  projectId: string;
  materialId: string | null;
  deliveryId: string | null;
  purchaseOrderId: string | null;
  materialCode: string;
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
  quantity: number;
  custodyStatus: CustodyStatus;
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface MtrRecord {
  id: string;
  projectId: string;
  mtrNumber: string;
  heatNumber: string;
  manufacturer: string;
  description: string;
  grade: string;
  specification: string;
  paperworkStatus: 'not_provided' | 'on_file' | 'missing_documentation';
  notes: string;
}

export interface MtrLinkRecord {
  id: string;
  projectId: string;
  mtrId: string;
  materialId: string;
  heatNumberOnItem: string;
  heatNumberOnMtr: string;
  verificationStatus: VerificationStatus;
  notes: string;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  docType:
    | 'project_attachment'
    | 'packing_slip'
    | 'bol'
    | 'mtr'
    | 'mtr_request'
    | 'specification'
    | 'other';
  title: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  subjectType: string;
  subjectId: string;
  addedAt: string;
  notes: string;
}

export interface PhotoRecord {
  id: string;
  projectId: string;
  subjectType: string;
  subjectId: string;
  role: 'packing_slip' | 'bol' | 'material' | 'damage' | 'other';
  caption: string;
  permissionStatus: GpsStatus;
  byteSize: number;
  capturedAt: string | null;
}

export interface HoldRecord {
  id: string;
  projectId: string;
  materialId: string;
  reason: string;
  status: 'open' | 'released';
  heldAt: string;
}

export interface DamageReportRecord {
  id: string;
  projectId: string;
  materialId: string;
  description: string;
  severity: 'minor' | 'major' | 'unknown';
  status: 'open' | 'closed';
  reportedAt: string;
}

export interface DiscrepancyRecord {
  id: string;
  projectId: string;
  materialId: string | null;
  deliveryId: string | null;
  title: string;
  description: string;
  status: 'open' | 'resolved';
  verificationStatus: VerificationStatus;
  openedAt: string;
}

export interface AuditLogRecord {
  id: string;
  projectId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  verificationStatus: VerificationStatus | null;
  createdAt: string;
}

export interface MtrRequestLine {
  materialDescription: string;
  diameter: string;
  wallThickness: string;
  grade: string;
  heatNumber: string;
  manufacturer: string;
}

export interface MtrRequestRecord {
  id: string;
  projectId: string;
  inspectorName: string;
  vendor: string;
  atmosProjectNumber: string;
  salesOrderOrCustomerPo: string;
  shipmentNumberMrc: string;
  lines: MtrRequestLine[];
  createdAt: string;
  statusNote: string;
}

export interface SyncQueueItem {
  id: string;
  entityType: string;
  entityId: string;
  op: 'upsert';
  createdAt: string;
  status: 'pending' | 'complete';
  ackedAt: string | null;
}

export interface PermissionNote {
  status: 'granted' | 'denied' | 'unavailable';
  message: string;
  latitude: number | null;
  longitude: number | null;
  recordedAt: string;
}

export interface AppSettings {
  theme: ThemeMode;
  guest: boolean;
  sample: boolean;
  accountEmail: string;
  lastCamera: PermissionNote | null;
  lastGps: PermissionNote | null;
}

export interface AppSnapshot {
  project: ProjectRecord;
  purchaseOrders: PurchaseOrderRecord[];
  deliveries: DeliveryRecord[];
  materials: MaterialRecord[];
  pipeJoints: PipeJointRecord[];
  fittings: FittingRecord[];
  flanges: FlangeRecord[];
  valves: ValveRecord[];
  mtrs: MtrRecord[];
  mtrLinks: MtrLinkRecord[];
  documents: DocumentRecord[];
  photos: PhotoRecord[];
  holds: HoldRecord[];
  damageReports: DamageReportRecord[];
  discrepancies: DiscrepancyRecord[];
  mtrRequests: MtrRequestRecord[];
  auditLogs: AuditLogRecord[];
  queue: SyncQueueItem[];
  settings: AppSettings;
}
