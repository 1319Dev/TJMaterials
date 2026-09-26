import { Link } from 'react-router-dom';
import { InstallGuide } from '../components/InstallGuide';
import { SpecialtyNav } from '../components/SpecialtyNav';
import { formatWhen } from '../domain/dates';
import { requestCameraStub, requestGpsStub } from '../domain/permissions';
import { SYNC_LABEL } from '../domain/sync';
import type { ThemeMode } from '../domain/types';
import { useApp } from '../state/AppState';

const themes: Array<{ id: ThemeMode; label: string }> = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'outdoor', label: 'Outdoor high-contrast' },
];

export function MorePage() {
  const {
    snapshot,
    setTheme,
    recordPermission,
    syncLabel,
    syncDetail,
    sessionEmail,
    remoteConfigured,
    signOut,
    requestSignIn,
    loadSampleProject,
    leaveSampleProject,
  } = useApp();
  if (!snapshot) return null;

  async function onCamera() {
    const note = await requestCameraStub();
    recordPermission('camera', note);
  }

  async function onGps() {
    const note = await requestGpsStub();
    recordPermission('gps', note);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black">More</h1>
      <section className="space-y-2" aria-labelledby="account-heading">
        <h2 id="account-heading" className="pmi-sheet-title">
          Account
        </h2>
        {sessionEmail ? <p className="pmi-code text-base font-bold">{sessionEmail}</p> : <p>Not signed in.</p>}
        <p className="text-sm text-pmi-muted">
          {remoteConfigured
            ? 'Signed-in records sync to the project database. Offline changes stay on this device until the connection returns.'
            : 'This build has no database connection. Records stay on this device. A connected build uses email sign-in and syncs.'}
        </p>
        {sessionEmail ? (
          <button type="button" className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={() => void signOut()}>
            Sign out
          </button>
        ) : remoteConfigured ? (
          <button type="button" className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={requestSignIn}>
            Sign in
          </button>
        ) : null}
        {snapshot.settings.sample ? (
          <button type="button" className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={leaveSampleProject}>
            Back to my project
          </button>
        ) : (
          <button type="button" className="min-h-14 w-full border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={loadSampleProject}>
            Load sample project
          </button>
        )}
        <p className="text-sm text-pmi-muted">The sample project is optional and is not uploaded.</p>
      </section>
      <InstallGuide />

      <section className="space-y-2" aria-labelledby="setup-links">
        <h2 id="setup-links" className="text-sm font-bold uppercase tracking-wide">
          Project
        </h2>
        <Link to="/project" className="flex min-h-14 items-center rounded-2xl border-2 border-pmi-border bg-pmi-card px-4 text-lg font-bold">
          Project setup
        </Link>
        <Link to="/mtr-request" className="flex min-h-14 items-center rounded-2xl border-2 border-pmi-border bg-pmi-card px-4 text-lg font-bold">
          MTR request
        </Link>
      </section>

      <section className="space-y-2" aria-labelledby="tally-links">
        <h2 id="tally-links" className="text-sm font-bold uppercase tracking-wide">
          Tally and components
        </h2>
        <SpecialtyNav />
      </section>

      <section className="space-y-2" aria-labelledby="appearance">
        <h2 id="appearance" className="text-sm font-bold uppercase tracking-wide">
          Appearance
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              aria-pressed={snapshot.settings.theme === theme.id}
              className={`min-h-14 rounded-2xl border-2 border-pmi-border px-4 text-left text-lg font-bold ${
                snapshot.settings.theme === theme.id ? 'bg-pmi-accent text-pmi-accent-text' : 'bg-pmi-card'
              }`}
              onClick={() => setTheme(theme.id)}
            >
              {theme.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2" aria-labelledby="permissions">
        <h2 id="permissions" className="text-sm font-bold uppercase tracking-wide">
          Device permissions
        </h2>
        <button type="button" className="min-h-14 w-full rounded-2xl border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={onCamera}>
          Camera permission
        </button>
        <button type="button" className="min-h-14 w-full rounded-2xl border-2 border-pmi-border bg-pmi-card text-lg font-bold" onClick={onGps}>
          GPS permission
        </button>
        {snapshot.settings.lastCamera ? <p className="text-sm">{snapshot.settings.lastCamera.message}</p> : null}
        {snapshot.settings.lastGps ? (
          <p className="text-sm">
            {snapshot.settings.lastGps.message}
            {snapshot.settings.lastGps.latitude !== null && snapshot.settings.lastGps.longitude !== null
              ? ` ${snapshot.settings.lastGps.latitude.toFixed(5)}, ${snapshot.settings.lastGps.longitude.toFixed(5)}`
              : ''}
          </p>
        ) : null}
      </section>

      <section className="space-y-2" aria-labelledby="sync-heading">
        <h2 id="sync-heading" className="text-sm font-bold uppercase tracking-wide">
          Sync queue
        </h2>
        <p className="font-bold uppercase">{syncLabel}</p>
        <p className="text-sm text-pmi-muted">{syncDetail}</p>
        <ul className="space-y-1 text-sm">
          <li>{SYNC_LABEL.offlineSaved} — this device is offline, or no database is connected.</li>
          <li>{SYNC_LABEL.saved} — the change is on this device and waiting to sync.</li>
          <li>{SYNC_LABEL.syncing} — a connected database is receiving the queue.</li>
          <li>{SYNC_LABEL.syncComplete} — the connected database acknowledged the queue.</li>
        </ul>
        {snapshot.queue.length === 0 ? (
          <p>No changes waiting.</p>
        ) : (
          <ul className="space-y-2">
            {snapshot.queue.map((item) => (
              <li key={item.id} className="rounded-2xl border-2 border-pmi-border bg-pmi-card p-3">
                <p className="font-bold">
                  {item.entityType} · {item.status}
                </p>
                <p className="text-sm text-pmi-muted">{formatWhen(item.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
