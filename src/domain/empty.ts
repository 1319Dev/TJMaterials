import type { AppSettings, AppSnapshot, ThemeMode, TrackerSheet } from './types';

export function normalizeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const theme: ThemeMode = settings?.theme ?? 'light';
  return {
    theme,
    sample: settings?.sample ?? false,
    lastCamera: settings?.lastCamera ?? null,
    lastGps: settings?.lastGps ?? null,
  };
}

export function emptyTrackerSheet(): TrackerSheet {
  return {
    constructionOrderNo: '',
    projectNumber: '',
    projectName: '',
    sheetDate: '',
    inspector: '',
    sourceFileName: '',
    importedAt: null,
    rows: [],
  };
}

export function emptySnapshot(): AppSnapshot {
  return {
    project: {
      id: crypto.randomUUID(),
      name: '',
      projectNumber: '',
      constructionOrderNo: '',
      atmosProjectNumber: '',
      inspectorName: '',
      vendor: '',
      salesOrderOrCustomerPo: '',
      clientName: '',
      spread: '',
      locationName: '',
      notes: '',
      status: 'active',
    },
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
    packingSlips: [],
    tracker: emptyTrackerSheet(),
    auditLogs: [],
    queue: [],
    settings: normalizeSettings(null),
  };
}
