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
import { remoteDb } from '../data/remote';
import { authRedirectTo, getSupabase, isRemoteConfigured } from '../data/supabase';
import { runCloudSync } from '../domain/cloud-sync';
import { localIsoDate } from '../domain/dates';
import { buildDemoData } from '../domain/demo-data';
import { emptySnapshot } from '../domain/empty';
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
import { countPending, describeSync, lastAckAt } from '../domain/sync';
import { savePipeJoint as writePipeJoint, type PipeJointInput } from '../domain/tally';
import type { AppSnapshot, MtrRequestLine, PermissionNote, ProjectRecord, ThemeMode } from '../domain/types';

const DEVICE_KEY = 'pmi-device';
const NAME_FIRST = 'Name the project before adding material. Nothing was invented.';

interface AppContextValue {
  ready: boolean;
  error: string | null;
  snapshot: AppSnapshot | null;
  online: boolean;
  syncLabel: string;
  syncDetail: string;
  sessionEmail: string | null;
  remoteConfigured: boolean;
  locked: boolean;
  hasDeviceCopy: boolean;
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
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  signUpWithPassword: (email: string, password: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  continueOnDevice: () => void;
  requestSignIn: () => void;
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
  const remoteConfigured = isRemoteConfigured();
  const [snapshot, setSnapshot] = useState<AppSnapshot | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(!remoteConfigured);
  const [bypass, setBypass] = useState(() => sessionStorage.getItem(DEVICE_KEY) === '1');
  const dirty = useRef(false);
  const memoryBlobs = useRef(new Map<string, Blob>());
  const liveRef = useRef<AppSnapshot | null>(null);
  const pulledFor = useRef<string | null>(null);

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
    const client = getSupabase();
    if (!client) {
      setAuthReady(true);
      return;
    }
    let cancelled = false;
    void client.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSessionEmail(data.session?.user.email ?? null);
      setAuthReady(true);
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setSessionEmail(session?.user.email ?? null);
      setAuthReady(true);
      if (session) {
        sessionStorage.removeItem(DEVICE_KEY);
        setBypass(false);
      }
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const pendingKey = snapshot?.queue
    .filter((item) => item.status === 'pending')
    .map((item) => item.id)
    .join('|');
  const sampleMode = snapshot?.settings.sample ?? false;

  useEffect(() => {
    if (!persist || !snapshot || sampleMode || !online || !remoteConfigured || !sessionEmail) return;
    if (!pendingKey && pulledFor.current === snapshot.project.id && snapshot.project.name.trim()) return;
    const db = remoteDb();
    if (!db) return;
    let cancelled = false;
    setSyncing(true);
    void runCloudSync(db, snapshot)
      .then((result) => {
        if (cancelled) return;
        pulledFor.current = result.snapshot.project.id;
        setSyncError(result.error);
        if (result.snapshot !== snapshot) {
          dirty.current = true;
          setSnapshot(result.snapshot);
        }
      })
      .finally(() => {
        if (!cancelled) setSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [online, pendingKey, persist, remoteConfigured, sampleMode, sessionEmail, snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    document.documentElement.dataset.theme = snapshot.settings.theme;
    const themeColor =
      snapshot.settings.theme === 'outdoor' ? '#000000' : snapshot.settings.theme === 'dark' ? '#12161b' : '#2a3340';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themeColor);
  }, [snapshot]);

  const sync = useMemo(() => {
    return describeSync({
      online,
      pending: snapshot ? countPending(snapshot.queue) : 0,
      syncing,
      remoteConfigured,
      lastAckAt: snapshot ? lastAckAt(snapshot.queue) : null,
    });
  }, [online, remoteConfigured, snapshot, syncing]);

  function commit(next: AppSnapshot) {
    dirty.current = true;
    setSnapshot(next);
  }

  const locked = remoteConfigured && authReady && !sessionEmail && !bypass && !initial;

  const value = useMemo<AppContextValue>(() => {
    return {
      ready: Boolean(snapshot) || locked,
      error,
      snapshot,
      online,
      syncLabel: sync.label,
      syncDetail: syncError ? `${sync.detail} ${syncError}` : sync.detail,
      sessionEmail,
      remoteConfigured,
      locked,
      hasDeviceCopy: Boolean(snapshot && (snapshot.project.name.trim() || snapshot.materials.length > 0)),
      saveReceipt(input) {
        if (!snapshot) return null;
        if (!snapshot.project.name.trim()) return { snapshot, errors: [NAME_FIRST] };
        const result = createReceipt(snapshot, input, {
          now: new Date(),
          newId: () => crypto.randomUUID(),
        });
        if (result.errors.length === 0) commit(result.snapshot);
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
      async signInWithPassword(email, password) {
        const client = getSupabase();
        if (!client) return 'No project database is connected on this build.';
        const { error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        return authError?.message ?? null;
      },
      async signUpWithPassword(email, password) {
        const client = getSupabase();
        if (!client) return 'No project database is connected on this build.';
        const { error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: authRedirectTo() },
        });
        return authError?.message ?? null;
      },
      async sendMagicLink(email) {
        const client = getSupabase();
        if (!client) return 'No project database is connected on this build.';
        const { error: authError } = await client.auth.signInWithOtp({
          email: email.trim(),
          options: { emailRedirectTo: authRedirectTo(), shouldCreateUser: true },
        });
        return authError?.message ?? null;
      },
      async signOut() {
        const client = getSupabase();
        await client?.auth.signOut();
        setSessionEmail(null);
        sessionStorage.removeItem(DEVICE_KEY);
        setBypass(false);
      },
      continueOnDevice() {
        sessionStorage.setItem(DEVICE_KEY, '1');
        setBypass(true);
      },
      requestSignIn() {
        sessionStorage.removeItem(DEVICE_KEY);
        setBypass(false);
      },
      loadSampleProject() {
        if (!snapshot || snapshot.settings.sample) return;
        const live = snapshot;
        liveRef.current = live;
        const sample = buildDemoData(localIsoDate());
        sample.settings = { ...sample.settings, sample: true, guest: true, theme: live.settings.theme };
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
            settings: { ...live.settings, theme: theme ?? live.settings.theme, sample: false, guest: false },
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
  }, [error, locked, online, persist, remoteConfigured, sessionEmail, snapshot, sync.detail, sync.label, syncError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
