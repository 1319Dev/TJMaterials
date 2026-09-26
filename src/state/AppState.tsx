import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deleteBlob, loadSnapshot, readBlob, saveBlob, saveSnapshot } from '../data/db';
import { countPending, describeSync, lastAckAt, remoteConfigured } from '../domain/sync';
import { createReceipt, type ReceiveInput, type ReceiveResult } from '../domain/receive';
import { addDocument, removeDocument, saveMtrRequest, updateProject } from '../domain/records';
import {
  saveFitting as writeFitting,
  saveFlange as writeFlange,
  saveValve as writeValve,
  type FittingInput,
  type FlangeInput,
  type ValveInput,
} from '../domain/specialty';
import { savePipeJoint as writePipeJoint, type PipeJointInput } from '../domain/tally';
import type { AppSnapshot, MtrRequestLine, PermissionNote, ProjectRecord, ThemeMode } from '../domain/types';

interface AppContextValue {
  ready: boolean;
  error: string | null;
  snapshot: AppSnapshot | null;
  online: boolean;
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
  setTheme: (theme: ThemeMode) => void;
  recordPermission: (kind: 'camera' | 'gps', note: PermissionNote) => void;
  openDocument: (documentId: string) => Promise<string | null>;
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
  const [online, setOnline] = useState(() => navigator.onLine);
  const dirty = useRef(false);
  const memoryBlobs = useRef(new Map<string, Blob>());

  useEffect(() => {
    if (initial || !persist) return;
    let cancelled = false;
    loadSnapshot()
      .then((loaded) => {
        if (!cancelled) setSnapshot(loaded);
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
    const markOnline = () => setOnline(true);
    const markOffline = () => setOnline(false);
    window.addEventListener('online', markOnline);
    window.addEventListener('offline', markOffline);
    return () => {
      window.removeEventListener('online', markOnline);
      window.removeEventListener('offline', markOffline);
    };
  }, []);

  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.dataset.theme = snapshot.settings.theme;
    const themeColor =
      snapshot.settings.theme === 'outdoor' ? '#000000' : snapshot.settings.theme === 'dark' ? '#101614' : '#0c5c56';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [snapshot]);

  const sync = useMemo(() => {
    if (!snapshot) {
      return describeSync({
        online,
        pending: 0,
        syncing: false,
        remoteConfigured,
        lastAckAt: null,
      });
    }
    return describeSync({
      online,
      pending: countPending(snapshot.queue),
      syncing: false,
      remoteConfigured,
      lastAckAt: lastAckAt(snapshot.queue),
    });
  }, [online, snapshot]);

  function commit(next: AppSnapshot) {
    dirty.current = true;
    setSnapshot(next);
  }

  const value = useMemo<AppContextValue>(() => {
    return {
      ready: Boolean(snapshot),
      error,
      snapshot,
      online,
      syncLabel: sync.label,
      syncDetail: sync.detail,
      saveReceipt(input) {
        if (!snapshot) return null;
        const result = createReceipt(snapshot, input, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) commit(result.snapshot);
        return result;
      },
      savePipeJoint(input) {
        if (!snapshot) return ['Records are not loaded.'];
        const result = writePipeJoint(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return result.errors;
      },
      saveFitting(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        const result = writeFitting(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, id: result.id };
      },
      saveFlange(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
        const result = writeFlange(snapshot, input, { now: new Date(), newId: () => crypto.randomUUID() });
        if (result.errors.length === 0) commit(result.snapshot);
        return { errors: result.errors, id: result.id };
      },
      saveValve(input) {
        if (!snapshot) return { errors: ['Records are not loaded.'] };
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
            bytes: new Uint8Array(await file.arrayBuffer()),
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
      saveRequest(input) {
        if (!snapshot) return ['Records are not loaded.'];
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
    };
  }, [error, online, persist, snapshot, sync.detail, sync.label]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
