import { Outlet } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { BottomNav } from './BottomNav';
import { Disclaimer } from './ui';

export function Shell() {
  const { ready, error, syncLabel, syncDetail } = useApp();

  return (
    <div className="mx-auto min-h-dvh max-w-lg px-4 pb-28 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="mb-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-wide">Pipeline Material Inspector</p>
          <span className="rounded-full border-2 border-pmi-border px-2 py-1 text-xs font-bold">Guest</span>
        </div>
        <p
          className="rounded-2xl border-2 border-pmi-border bg-pmi-card px-3 py-3 text-sm font-bold leading-snug"
          role="status"
          aria-live="polite"
          data-testid="sync-status"
        >
          <span className="block uppercase">{syncLabel}</span>
          <span className="mt-1 block font-medium text-pmi-muted">{syncDetail}</span>
        </p>
        <Disclaimer />
      </header>
      <main id="main">
        {error ? (
          <p role="alert" className="rounded-2xl border-2 border-pmi-border p-4 text-lg">
            {error}
          </p>
        ) : null}
        {!ready && !error ? <p className="text-lg">Opening records stored on this device…</p> : null}
        {ready ? <Outlet /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
