import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  clearParkedSnapshot,
  createEmptySnapshot,
  deleteBlob,
  loadParkedSnapshot,
  loadSnapshot,
  parkLiveSnapshot,
  readBlob,
  saveBlob,
  saveSnapshot,
} from '../data/db';
import { localIsoDate } from '../domain/dates';
import { readBlob as readFileBytes } from '../lib/blob';
import { buildDemoData } from '../domain/demo-data';
import { emptySnapshot } from '../domain/empty';
import { createReceipt, type ReceiveInput, type ReceiveResult } from '../domain/receive';
import { addPackingSlip, attachImageRecord, type PackingSlipInput } from '../domain/coordinator';
import { addDocument, removeDocument, saveMtrRequest, updateProject } from '../domain/records';
import {
  applyTrackerProposals,
  importTrackerSheet,
  updateTrackerCell as writeTrackerCell,
  updateTrackerHeader as writeTrackerHeader,
  type OcrProposal,
  type ParsedTracker,
  type TrackerEditField,
} from '../domain/tracker';
import {
  saveFitting as writeFitting,
  saveFlange as writeFlange,
  saveValve as writeValve,
  type FittingInput,
  type FlangeInput,
  type ValveInput,
} from '../domain/specialty';
import { countPending, describeSync } from '../domain/sync';
import { savePipeJoint as writePipeJoint, type PipeJointInput } from '../domain/tally';
import type { AppSnapshot, DocumentRecord, MtrRequestLine, PermissionNote, PhotoRecord, ProjectRecord, ThemeMode, TrackerSheet } from '../domain/types';

const NAME_FIRST = 'Name the project before adding material. Nothing was invented.';

interface AppContextValue {
  ready: boolean;
  error: string | null;
  snapshot: AppSnapshot | null;
  syncLabel: string;
  syncDetail: string;
  saveReceipt: (input: ReceiveInput) => ReceiveResult | null;
  savePipeJoint: (input: PipeJointInput) => string[];
  saveFitting: (input: FittingInput) => { errors: string[]; id?: string };
  saveFlange: (input: FlangeInput) => { errors: string[]; id?: string };
  saveValve: (input: ValveInput) => { errors: string[]; id?: string };
  saveProject: (project: ProjectRecord) => string[];
  attachDocument: (file: File, subjectType: string, subjectId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  saveRequest: (input: {
    inspectorName: string;
    vendor: string;
    atmosProjectNumber: string;
    salesOrderOrCustomerPo: string;
    shipmentNumberMrc: string;
    lines: MtrRequestLine[];
  }) => string[];
  savePackingSlip: (input: PackingSlipInput, file: File | null) => Promise<{ errors: string[]; id?: string }>;
  captureImage: (
    file: File,
    input: {
      docType: DocumentRecord['docType'];
      subjectType: string;
      subjectId: string;
      role: PhotoRecord['role'];
      caption: string;
    },
  ) => Promise<string | null>;
  saveTracker: (parsed: ParsedTracker, fileName: string) => { errors: string[]; rowCount: number };
  updateTrackerCell: (rowId: string, field: TrackerEditField, value: string) => void;
  updateTrackerHeader: (patch: Partial<Pick<TrackerSheet, 'projectName' | 'projectNumber' | 'sheetDate' | 'inspector' | 'constructionOrderNo'>>) => void;
  applyOcrRows: (
    proposals: OcrProposal[],
    options: {
      documentId: string | null;
      deliveryId: string | null;
      constructionOrderNo?: string;
      projectNumber?: string;
    },
  ) => { errors: string[]; applied: number };
  setTheme: (theme: ThemeMode) => void;
  recordPermission: (kind: 'camera' | 'gps', note: PermissionNote) => void;
  openDocument: (documentId: string) => Promise<string | null>;
  loadSampleProject: () => void;
  leaveSampleProject: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({
  children,
  initial,
  persist = true,
}: {
  children: React.ReactNode;
  initial?: AppSnapshot;
  persist?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const dirty = useRef(false);
  const memoryBlobs = useRef(new Map<string, Blob>());
  const liveRef = useRef<AppSnapshot | null>(null);

  useEffect(() => {
    if (initial || !persist) return;
    let cancelled = false;
    loadSnapshot()
      .then(async (loaded) => {
        if (cancelled) return;
        const next = loaded ?? createEmptySnapshot();
        if (!loaded) await saveSnapshot(next);
        setSnapshot(next);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not open on-device storage. No records were invented to fill the gap.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initial, persist]);

  useEffect(() => {
    if (!persist || !snapshot || !dirty.current) return;
    void saveSnapshot(snapshot);
  }, [persist, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.dataset.theme = snapshot.settings.theme;
    const themeColor =
      snapshot.settings.theme === 'outdoor' ? '#000000' : snapshot.settings.theme === 'dark' ? '#12161b' : '#2a3340';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [snapshot]);

  const sync = useMemo(() => {
    return describeSync({
      pending: snapshot ? countPending(snapshot.queue) : 0,
    });
  }, [snapshot]);

  function commit(next: AppSnapshot) {
    dirty.current = true;
    setSnapshot(next);
  }

  const value = useMemo<AppContextValue>(() => {
    return {
      ready: Boolean(snapshot),
      error,
      snapshot,
      syncLabel: sync.label,
      syncDetail: sync.detail,
      saveReceipt(input) {
        if (!snapshot) return null;
        if (!snapshot.project.name.trim()) return { snapshot, errors: [NAME_FIRST] };
        const result = createReceipt(snapshot, input, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) {
          const created = result.snapshot.documents.slice(snapshot.documents.length);
          input.documents.forEach((document, index) => {
            const bytes = document.bytes;
            const stored = created[index];
            if (!bytes || !stored || bytes.byteLength === 0) return;
            const copy = new Uint8Array(bytes.byteLength);
            copy.set(bytes);
            memoryBlobs.current.set(stored.id, new Blob([copy], { type: stored.mimeType || 'application/octet-stream' }));
            if (persist) {
              void saveBlob({
                id: stored.id,
                bytes: copy,
                fileName: stored.fileName,
                mimeType: stored.mimeType,
                byteSize: stored.byteSize,
              });
            }
          });
          commit(result.snapshot);
        }
        return result;
      },
      savePipeJoint(input) {
        if (!snapshot) return ['Records are not loaded.'];
        if (!snapshot.project.name.trim()) return [NAME_FIRST];
        const result = writePipeJoint(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return result.errors;
      },
      saveFitting(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST] };
        const result = writeFitting(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, id: result.id };
      },
      saveFlange(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST] };
        const result = writeFlange(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, id: result.id };
      },
      saveValve(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST] };
        const result = writeValve(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, id: result.id };
      },
      saveProject(project) {
        if (!snapshot) return ['Records are not loaded.'];
        const result = updateProject(snapshot, project, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) commit(result.snapshot);
        return result.errors;
      },
      async attachDocument(file, subjectType, subjectId) {
        if (!snapshot) return;
        const result = addDocument(
          snapshot,
          {
            docType: subjectType === 'project' ? 'project_attachment' : 'other',
            title: file.name,
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            byteSize: file.size,
            subjectType,
            subjectId,
            notes: 'Stored on this device.',
          },
          { now: new Date(), newId: () => crypto.randomUUID() },
        );
        memoryBlobs.current.set(result.document.id, file);
        if (persist) {
          await saveBlob({
            id: result.document.id,
            bytes: new Uint8Array(await readFileBytes(file)),
            fileName: file.name,
            mimeType: file.type || 'application/octet-stream',
            byteSize: file.size,
          });
        }
        commit(result.snapshot);
      },
      async deleteDocument(documentId) {
        if (!snapshot) return;
        memoryBlobs.current.delete(documentId);
        if (persist) await deleteBlob(documentId);
        commit(removeDocument(snapshot, documentId));
      },
      async savePackingSlip(input, file) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST] };
        const ctx = { now: new Date(), newId: () => crypto.randomUUID() };
        const saved = addPackingSlip(snapshot, input, ctx);
        if (saved.errors.length > 0 || !saved.id) return { errors: saved.errors };
        let next = saved.snapshot;
        if (file) {
          const attached = attachImageRecord(
            next,
            {
              docType: 'packing_slip',
              subjectType: 'packing_slip',
              subjectId: saved.id,
              role: 'packing_slip',
              caption: input.packingSlipNumber.trim() || 'Packing slip',
              fileName: file.name || 'packing-slip.jpg',
              mimeType: file.type || 'image/jpeg',
              byteSize: file.size,
            },
            ctx,
          );
          const bytes = new Uint8Array(await readFileBytes(file));
          memoryBlobs.current.set(attached.documentId, file);
          if (persist) {
            await saveBlob({
              id: attached.documentId,
              bytes,
              fileName: file.name || 'packing-slip.jpg',
              mimeType: file.type || 'image/jpeg',
              byteSize: file.size,
            });
          }
          next = attached.snapshot;
        }
        commit(next);
        return { errors: [], id: saved.id };
      },
      async captureImage(file, input) {
        if (!snapshot) return null;
        if (!snapshot.project.name.trim()) return null;
        const ctx = { now: new Date(), newId: () => crypto.randomUUID() };
        const attached = attachImageRecord(
          snapshot,
          {
            ...input,
            fileName: file.name || 'photo.jpg',
            mimeType: file.type || 'image/jpeg',
            byteSize: file.size,
          },
          ctx,
        );
        const bytes = new Uint8Array(await readFileBytes(file));
        memoryBlobs.current.set(attached.documentId, file);
        if (persist) {
          await saveBlob({
            id: attached.documentId,
            bytes,
            fileName: file.name || 'photo.jpg',
            mimeType: file.type || 'image/jpeg',
            byteSize: file.size,
          });
        }
        commit(attached.snapshot);
        return attached.documentId;
      },
      saveTracker(parsed, fileName) {
        if (!snapshot) return { errors: ['Records are not loaded.'], rowCount: 0 };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST], rowCount: 0 };
        const result = importTrackerSheet(snapshot, parsed, { fileName }, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, rowCount: result.rowCount };
      },
      updateTrackerCell(rowId, field, value) {
        if (!snapshot) return;
        commit(writeTrackerCell(snapshot, rowId, field, value));
      },
      updateTrackerHeader(patch) {
        if (!snapshot) return;
        commit(writeTrackerHeader(snapshot, patch));
      },
      applyOcrRows(proposals, options) {
        if (!snapshot) return { errors: ['Records are not loaded.'], applied: 0 };
        if (!snapshot.project.name.trim()) return { errors: [NAME_FIRST], applied: 0 };
        const result = applyTrackerProposals(snapshot, proposals, options, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, applied: result.applied };
      },
      saveRequest(input) {
        if (!snapshot) return ['Records are not loaded.'];
        if (!snapshot.project.name.trim()) return [NAME_FIRST];
        const result = saveMtrRequest(snapshot, input, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) commit(result.snapshot);
        return result.errors;
      },
      setTheme(theme) {
        if (!snapshot) return;
        commit({ ...snapshot, settings: { ...snapshot.settings, theme } });
      },
      recordPermission(kind, note) {
        if (!snapshot) return;
        commit({
          ...snapshot,
          settings: {
            ...snapshot.settings,
            lastCamera: kind === 'camera' ? note : snapshot.settings.lastCamera,
            lastGps: kind === 'gps' ? note : snapshot.settings.lastGps,
          },
        });
      },
      async openDocument(documentId) {
        const memory = memoryBlobs.current.get(documentId);
        if (memory) return URL.createObjectURL(memory);
        if (!persist) return null;
        const stored = await readBlob(documentId);
        if (!stored) return null;
        const copy = new ArrayBuffer(stored.bytes.byteLength);
        new Uint8Array(copy).set(stored.bytes);
        const blob = new Blob([copy], { type: stored.mimeType || 'application/octet-stream' });
        return URL.createObjectURL(blob);
      },
      loadSampleProject() {
        if (!snapshot || snapshot.settings.sample) return;
        const live = snapshot;
        liveRef.current = live;
        const sample = buildDemoData(localIsoDate());
        sample.settings = { ...sample.settings, sample: true, theme: live.settings.theme };
        if (!persist) {
          commit(sample);
          return;
        }
        void parkLiveSnapshot(live).then(() => commit(sample));
      },
      leaveSampleProject() {
        const theme = snapshot?.settings.theme;
        const memory = liveRef.current && !liveRef.current.settings.sample ? liveRef.current : null;
        liveRef.current = null;
        const apply = (live: AppSnapshot) => {
          commit({
            ...live,
            settings: { ...live.settings, theme: theme ?? live.settings.theme, sample: false },
          });
        };
        if (memory) {
          if (persist) void clearParkedSnapshot();
          apply(memory);
          return;
        }
        if (!persist) {
          apply(emptySnapshot());
          return;
        }
        void loadParkedSnapshot().then((parked) => {
          void clearParkedSnapshot();
          apply(parked ?? emptySnapshot());
        });
      },
    };
  }, [error, persist, snapshot, sync.detail, sync.label]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
