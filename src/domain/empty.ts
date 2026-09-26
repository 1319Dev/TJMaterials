import type { AppSettings, AppSnapshot, ThemeMode } from './types';

export function normalizeSettings(settings?: Partial<AppSettings> | null): AppSettings {
  const theme: ThemeMode = settings?.theme ?? 'light';
  return {
    theme,
    guest: settings?.guest ?? false,
    sample: settings?.sample ?? false,
    accountEmail: settings?.accountEmail ?? '',
    lastCamera: settings?.lastCamera ?? null,
    lastGps: settings?.lastGps ?? null,
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
    auditLogs: [],
    queue: [],
    settings: normalizeSettings(null),
  };
}
