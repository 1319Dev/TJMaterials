import { addIsoDays } from './dates';
import type {
  AppSnapshot,
  AuditLogRecord,
  DamageReportRecord,
  DeliveryRecord,
  DiscrepancyRecord,
  DocumentRecord,
  HoldRecord,
  MaterialRecord,
  MtrLinkRecord,
  MtrRecord,
  PhotoRecord,
  ProjectRecord,
  PurchaseOrderRecord,
} from './types';

function id(n: number): string {
  return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export function buildDemoData(today: string): AppSnapshot {
  const tomorrow = addIsoDays(today, 1);
  const project: ProjectRecord = {
    id: id(1),
    name: 'Guest Demo Spread',
    projectNumber: 'PRJ-2044',
    constructionOrderNo: 'CO-7781',
    atmosProjectNumber: 'AP-44821',
    inspectorName: 'Alex Rivera',
    vendor: 'Northline Pipe Supply',
    salesOrderOrCustomerPo: 'SO-77821 / PO-45021',
    clientName: 'High Plains Transmission Demo',
    spread: 'Spread A',
    locationName: 'Laydown Yard 2',
    notes: 'Guest demo loaded on this device. Figures are sample records, not a live project.',
    status: 'active',
  };

  const purchaseOrders: PurchaseOrderRecord[] = [
    po(2, 'PO-45021', 'Northline Pipe Supply', 'SO-77821'),
    po(3, 'PO-45088', 'Redcedar Fittings Co.', 'SO-77840'),
    po(4, 'PO-45102', 'Plainspoke Flange', 'SO-77855'),
    po(5, 'PO-45110', 'Calder Valve Works', 'SO-77860'),
  ];

  const deliveries: DeliveryRecord[] = [
    {
      id: id(6),
      projectId: project.id,
      purchaseOrderId: id(2),
      receivedOn: today,
      scheduledOn: today,
      vendor: 'Northline Pipe Supply',
      inspectorName: 'Alex Rivera',
      carrier: 'Red Mesa Freight',
      bolNumber: 'BOL-88421',
      packingSlipNumber: 'PS-44190',
      shipmentNumberMrc: 'MRC-5521',
      salesOrderOrCustomerPo: 'SO-77821 / PO-45021',
      atmosProjectNumber: 'AP-44821',
      status: 'received',
      notes: 'Yard receipt. Verification was left at REVIEW REQUIRED.',
      latitude: null,
      longitude: null,
      gpsStatus: 'not_requested',
    },
    {
      id: id(7),
      projectId: project.id,
      purchaseOrderId: id(2),
      receivedOn: null,
      scheduledOn: today,
      vendor: 'Northline Pipe Supply',
      inspectorName: 'Alex Rivera',
      carrier: 'Red Mesa Freight',
      bolNumber: 'BOL-89002',
      packingSlipNumber: '',
      shipmentNumberMrc: 'MRC-5600',
      salesOrderOrCustomerPo: 'SO-77821 / PO-45021',
      atmosProjectNumber: 'AP-44821',
      status: 'expected',
      notes: 'Expected today. Not received.',
      latitude: null,
      longitude: null,
      gpsStatus: 'not_requested',
    },
    {
      id: id(8),
      projectId: project.id,
      purchaseOrderId: id(3),
      receivedOn: null,
      scheduledOn: tomorrow,
      vendor: 'Redcedar Fittings Co.',
      inspectorName: 'Alex Rivera',
      carrier: 'Red Mesa Freight',
      bolNumber: 'BOL-90110',
      packingSlipNumber: '',
      shipmentNumberMrc: 'MRC-5614',
      salesOrderOrCustomerPo: 'SO-77840 / PO-45088',
      atmosProjectNumber: 'AP-44821',
      status: 'expected',
      notes: 'Expected next calendar day.',
      latitude: null,
      longitude: null,
      gpsStatus: 'not_requested',
    },
  ];

  const materials: MaterialRecord[] = [
    material({
      n: 10,
      code: 'PMI-PIPE-000001',
      category: 'pipe',
      description: '36" API 5L X52 PSL2 line pipe',
      grade: 'X52',
      specification: 'API 5L PSL2',
      manufacturer: 'Heartland Steel Mills',
      heat: 'H52-18440',
      joint: 'J-1041',
      po: 2,
      delivery: 6,
      custody: 'received',
      verification: 'review_required',
      receivedOn: today,
    }),
    material({
      n: 11,
      code: 'PMI-PIPE-000002',
      category: 'pipe',
      description: '36" API 5L X52 PSL2 line pipe',
      grade: 'X52',
      specification: 'API 5L PSL2',
      manufacturer: 'Heartland Steel Mills',
      heat: 'H52-18440',
      joint: 'J-1042',
      po: 2,
      delivery: 6,
      custody: 'received',
      verification: 'review_required',
      receivedOn: today,
    }),
    material({
      n: 12,
      code: 'PMI-PIPE-000003',
      category: 'pipe',
      description: '36" API 5L X52 PSL2 line pipe',
      grade: 'X52',
      specification: 'API 5L PSL2',
      manufacturer: 'Heartland Steel Mills',
      heat: 'H52-18441',
      joint: 'J-1043',
      po: 2,
      delivery: 6,
      custody: 'received',
      verification: 'not_provided',
      receivedOn: today,
      notes: 'Mill test report was not in the package.',
    }),
    material({
      n: 13,
      code: 'PMI-PIPE-000004',
      category: 'pipe',
      description: '36" API 5L X52 PSL2 line pipe',
      grade: 'X52',
      specification: 'API 5L PSL2',
      manufacturer: 'Heartland Steel Mills',
      heat: 'H52-19002',
      joint: 'J-1108',
      po: 2,
      delivery: 6,
      custody: 'damaged',
      verification: 'review_required',
      receivedOn: today,
      notes: 'Dent noted at receiving.',
    }),
    material({
      n: 14,
      code: 'PMI-PIPE-000005',
      category: 'pipe',
      description: '36" API 5L X52 PSL2 line pipe',
      grade: 'X52',
      specification: 'API 5L PSL2',
      manufacturer: 'Heartland Steel Mills',
      heat: 'H52-19088',
      joint: 'J-1110',
      po: 2,
      delivery: 7,
      custody: 'expected',
      verification: 'not_provided',
      receivedOn: null,
      notes: 'Listed on the expected bill of lading. Not on the yard.',
    }),
    material({
      n: 15,
      code: 'PMI-FIT-000001',
      category: 'fitting',
      description: '36" WPHY52 90° elbow',
      grade: 'WPHY52',
      specification: 'MSS SP-75',
      manufacturer: 'Redcedar Fittings Co.',
      heat: 'W52-7710',
      joint: '',
      po: 3,
      delivery: 6,
      custody: 'received',
      verification: 'review_required',
      receivedOn: today,
      wall: '0.500',
    }),
    material({
      n: 16,
      code: 'PMI-FIT-000002',
      category: 'fitting',
      description: '36" WPHY52 tee',
      grade: 'WPHY52',
      specification: 'MSS SP-75',
      manufacturer: 'Redcedar Fittings Co.',
      heat: 'W52-7718',
      joint: '',
      po: 3,
      delivery: 6,
      custody: 'received',
      verification: 'missing_documentation',
      receivedOn: today,
      notes: 'MTR missing from the shipment file.',
    }),
    material({
      n: 17,
      code: 'PMI-FIT-000003',
      category: 'fitting',
      description: '36" WPHY52 45° elbow',
      grade: 'WPHY52',
      specification: 'MSS SP-75',
      manufacturer: 'Redcedar Fittings Co.',
      heat: 'W52-7801',
      joint: '',
      po: 3,
      delivery: 8,
      custody: 'expected',
      verification: 'not_provided',
      receivedOn: null,
    }),
    material({
      n: 18,
      code: 'PMI-FLG-000001',
      category: 'flange',
      description: '36" Class 600 WN flange',
      grade: 'A694 F52',
      specification: 'ASME B16.5',
      manufacturer: 'Plainspoke Flange',
      heat: 'F600-2201',
      joint: '',
      po: 4,
      delivery: 6,
      custody: 'received',
      verification: 'difference_found',
      receivedOn: today,
      ansi: 'Class 600',
      notes: 'Stamp heat F600-2201. MTR heat reads F600-2209.',
    }),
    material({
      n: 19,
      code: 'PMI-FLG-000002',
      category: 'flange',
      description: '36" Class 600 WN flange',
      grade: 'A694 F52',
      specification: 'ASME B16.5',
      manufacturer: 'Plainspoke Flange',
      heat: 'F600-2201',
      joint: '',
      po: 4,
      delivery: 6,
      custody: 'received',
      verification: 'review_required',
      receivedOn: today,
      ansi: 'Class 600',
    }),
    material({
      n: 20,
      code: 'PMI-FLG-000003',
      category: 'flange',
      description: '36" Class 600 WN flange',
      grade: 'A694 F52',
      specification: 'ASME B16.5',
      manufacturer: 'Plainspoke Flange',
      heat: 'F600-2290',
      joint: '',
      po: 4,
      delivery: 8,
      custody: 'expected',
      verification: 'not_provided',
      receivedOn: null,
      ansi: 'Class 600',
    }),
    material({
      n: 21,
      code: 'PMI-VLV-000001',
      category: 'valve',
      description: '36" Class 600 trunnion ball valve',
      grade: 'WCB',
      specification: 'API 6D',
      manufacturer: 'Calder Valve Works',
      heat: 'V52-088',
      joint: '',
      po: 5,
      delivery: 6,
      custody: 'on_hold',
      verification: 'not_provided',
      receivedOn: today,
      ansi: 'Class 600',
      serial: 'VB-600-3391',
      model: 'CB-600-36',
      notes: 'Hold: MTR not provided.',
    }),
    material({
      n: 22,
      code: 'PMI-VLV-000002',
      category: 'valve',
      description: '36" Class 600 trunnion ball valve',
      grade: 'WCB',
      specification: 'API 6D',
      manufacturer: 'Calder Valve Works',
      heat: 'V52-104',
      joint: '',
      po: 5,
      delivery: 8,
      custody: 'expected',
      verification: 'not_provided',
      receivedOn: null,
      ansi: 'Class 600',
      serial: 'VB-600-3402',
      model: 'CB-600-36',
    }),
  ];

  const mtrs: MtrRecord[] = [
    mtr(30, 'MTR-HSM-18440', 'H52-18440', 'Heartland Steel Mills', 'X52', 'API 5L PSL2', 'on_file'),
    mtr(31, 'MTR-HSM-19002', 'H52-19002', 'Heartland Steel Mills', 'X52', 'API 5L PSL2', 'on_file'),
    mtr(32, 'MTR-RCF-7710', 'W52-7710', 'Redcedar Fittings Co.', 'WPHY52', 'MSS SP-75', 'on_file'),
    mtr(33, 'MTR-PSF-2201', 'F600-2209', 'Plainspoke Flange', 'A694 F52', 'ASME B16.5', 'on_file', 'Document heat is F600-2209.'),
  ];

  const mtrLinks: MtrLinkRecord[] = [
    link(40, 30, 10, 'H52-18440', 'H52-18440', 'review_required'),
    link(41, 30, 11, 'H52-18440', 'H52-18440', 'review_required'),
    link(42, 31, 13, 'H52-19002', 'H52-19002', 'review_required'),
    link(43, 32, 15, 'W52-7710', 'W52-7710', 'review_required'),
    link(44, 33, 18, 'F600-2201', 'F600-2209', 'difference_found', 'Heat on the flange stamp does not match the MTR.'),
  ];

  const documents: DocumentRecord[] = [
    {
      id: id(50),
      projectId: project.id,
      docType: 'project_attachment',
      title: 'Laydown yard notes',
      fileName: 'laydown-yard-notes.txt',
      mimeType: 'text/plain',
      byteSize: 0,
      subjectType: 'project',
      subjectId: project.id,
      addedAt: `${today}T13:00:00.000Z`,
      notes: 'Metadata only. File bytes were not included in the demo seed.',
    },
    {
      id: id(51),
      projectId: project.id,
      docType: 'mtr',
      title: 'MTR-HSM-18440',
      fileName: 'MTR-HSM-18440.pdf',
      mimeType: 'application/pdf',
      byteSize: 0,
      subjectType: 'mtr',
      subjectId: id(30),
      addedAt: `${today}T13:05:00.000Z`,
      notes: 'Metadata only. The PDF was not bundled with the demo.',
    },
  ];

  const photos: PhotoRecord[] = [
    {
      id: id(52),
      projectId: project.id,
      subjectType: 'material',
      subjectId: id(13),
      role: 'damage',
      caption: 'Damage photo was not captured.',
      permissionStatus: 'not_provided',
      byteSize: 0,
      capturedAt: null,
    },
  ];

  const holds: HoldRecord[] = [
    {
      id: id(60),
      projectId: project.id,
      materialId: id(21),
      reason: 'MTR not provided for valve serial VB-600-3391. This hold does not clear the valve.',
      status: 'open',
      heldAt: `${today}T15:10:00.000Z`,
    },
  ];

  const damageReports: DamageReportRecord[] = [
    {
      id: id(61),
      projectId: project.id,
      materialId: id(13),
      description: 'Dent in the pipe body, noted near 3 o’clock at receiving. Documentation only.',
      severity: 'major',
      status: 'open',
      reportedAt: `${today}T15:20:00.000Z`,
    },
  ];

  const discrepancies: DiscrepancyRecord[] = [
    {
      id: id(62),
      projectId: project.id,
      materialId: id(18),
      deliveryId: id(6),
      title: 'Flange heat does not match MTR',
      description: 'PMI-FLG-000001 stamp heat F600-2201. MTR-PSF-2201 lists heat F600-2209.',
      status: 'open',
      verificationStatus: 'difference_found',
      openedAt: `${today}T15:30:00.000Z`,
    },
    {
      id: id(63),
      projectId: project.id,
      materialId: id(13),
      deliveryId: id(6),
      title: 'Damaged pipe joint J-1108',
      description: 'Joint J-1108 arrived with a dent. Left open for review.',
      status: 'open',
      verificationStatus: 'review_required',
      openedAt: `${today}T15:21:00.000Z`,
    },
  ];

  const auditLogs: AuditLogRecord[] = [
    audit(70, 'inspect', 18, 'Heat check PMI-FLG-000001', 'difference_found', `${today}T15:30:00.000Z`),
    audit(71, 'inspect', 13, 'Damage noted on PMI-PIPE-000004 joint J-1108', 'review_required', `${today}T15:20:00.000Z`),
    audit(72, 'inspect', 21, 'Serial check PMI-VLV-000001 VB-600-3391', 'not_verified', `${today}T15:12:00.000Z`),
    audit(73, 'inspect', 16, 'Paperwork check PMI-FIT-000002', 'missing_documentation', `${today}T15:05:00.000Z`),
    audit(74, 'receive', 10, 'Received PMI-PIPE-000001 heat H52-18440', 'review_required', `${today}T14:40:00.000Z`),
  ];

  return {
    project,
    purchaseOrders,
    deliveries,
    materials,
    mtrs,
    mtrLinks,
    documents,
    photos,
    holds,
    damageReports,
    discrepancies,
    mtrRequests: [],
    auditLogs,
    queue: [],
    settings: {
      theme: 'light',
      guest: true,
      lastCamera: null,
      lastGps: null,
    },
  };

  function po(n: number, poNumber: string, vendor: string, salesOrderNumber: string): PurchaseOrderRecord {
    return {
      id: id(n),
      projectId: project.id,
      poNumber,
      vendor,
      salesOrderNumber,
      issuedOn: addIsoDays(today, -20),
      notes: '',
      status: 'open',
    };
  }

  function material(input: {
    n: number;
    code: string;
    category: MaterialRecord['category'];
    description: string;
    grade: string;
    specification: string;
    manufacturer: string;
    heat: string;
    joint: string;
    po: number;
    delivery: number;
    custody: MaterialRecord['custodyStatus'];
    verification: MaterialRecord['verificationStatus'];
    receivedOn: string | null;
    notes?: string;
    wall?: string;
    ansi?: string;
    serial?: string;
    model?: string;
  }): MaterialRecord {
    return {
      id: id(input.n),
      projectId: project.id,
      deliveryId: id(input.delivery),
      purchaseOrderId: id(input.po),
      materialCode: input.code,
      category: input.category,
      description: input.description,
      diameter: '36',
      wallThickness: input.wall ?? '0.500',
      grade: input.grade,
      specification: input.specification,
      manufacturer: input.manufacturer,
      modelNumber: input.model ?? '',
      heatNumber: input.heat,
      serialOrLot: input.serial ?? '',
      jointNumber: input.joint,
      ansiPressureRating: input.ansi ?? '',
      quantity: 1,
      unit: 'ea',
      custodyStatus: input.custody,
      verificationStatus: input.verification,
      receivedOn: input.receivedOn,
      notes: input.notes ?? '',
    };
  }

  function mtr(
    n: number,
    mtrNumber: string,
    heatNumber: string,
    manufacturer: string,
    grade: string,
    specification: string,
    paperworkStatus: MtrRecord['paperworkStatus'],
    notes = '',
  ): MtrRecord {
    return {
      id: id(n),
      projectId: project.id,
      mtrNumber,
      heatNumber,
      manufacturer,
      description: '',
      grade,
      specification,
      paperworkStatus,
      notes,
    };
  }

  function link(
    n: number,
    mtrN: number,
    materialN: number,
    heatNumberOnItem: string,
    heatNumberOnMtr: string,
    verificationStatus: MtrLinkRecord['verificationStatus'],
    notes = '',
  ): MtrLinkRecord {
    return {
      id: id(n),
      projectId: project.id,
      mtrId: id(mtrN),
      materialId: id(materialN),
      heatNumberOnItem,
      heatNumberOnMtr,
      verificationStatus,
      notes,
    };
  }

  function audit(
    n: number,
    action: string,
    materialN: number,
    summary: string,
    verificationStatus: AuditLogRecord['verificationStatus'],
    createdAt: string,
  ): AuditLogRecord {
    return {
      id: id(n),
      projectId: project.id,
      action,
      entityType: 'materials',
      entityId: id(materialN),
      summary,
      verificationStatus,
      createdAt,
    };
  }
}
