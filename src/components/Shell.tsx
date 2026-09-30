import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { CLIENT_BUILD } from '../build-id';
import { useApp } from '../state/AppState';
import { BottomNav } from './BottomNav';
import { Disclaimer } from './ui';

export function Shell() {
  const { ready, error, syncLabel, syncDetail, snapshot } = useApp();
  const location = useLocation();
  const onInstallPage = location.pathname.endsWith('/more');
  const onHome = location.pathname === '/';

  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const syncKeyboard = () => {
      if (!viewport) return;
      const keyboardOpen = window.innerHeight - viewport.height > 140;
      root.classList.toggle('pmi-keyboard', keyboardOpen);
    };
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (!target.matches('input, textarea, select')) return;
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
      }, 280);
    };
    viewport?.addEventListener('resize', syncKeyboard);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      viewport?.removeEventListener('resize', syncKeyboard);
      document.removeEventListener('focusin', onFocusIn);
      root.classList.remove('pmi-keyboard');
    };
  }, []);

  return (
    <div className="pmi-shell mx-auto min-h-[100dvh] max-w-lg px-3 pb-[calc(7rem+env(safe-area-inset-bottom))]">
      <a href="#main" className="sr-only focus:not-sr-only">
        Skip to content
      </a>
      <header className="pmi-mast -mx-3 mb-3 space-y-2 pt-[max(0.7rem,env(safe-area-inset-top))]">
        <p className="text-sm font-black uppercase tracking-widest">Pipeline Material Inspector</p>
        <p className="text-xs font-bold" data-testid="client-build">
          Build {CLIENT_BUILD}
        </p>
        <p className="pmi-sync" role="status" aria-live="polite" data-testid="sync-status">
          <span className="block uppercase">{syncLabel}</span>
          <span className="pmi-sheet-quiet mt-0.5 block font-medium">{syncDetail}</span>
        </p>
        <Disclaimer />
        {onInstallPage ? null : (
          <Link to="/more#install" className="inline-flex min-h-12 items-center text-base font-bold underline">
            Add to Home Screen
          </Link>
        )}
      </header>
      <main id="main">
        {error ? (
          <p role="alert" className="rounded-2xl border-2 border-pmi-border p-4 text-lg">
            {error}
          </p>
        ) : null}
        {!ready && !error ? <p className="text-lg">Opening records stored on this device…</p> : null}
        {ready && snapshot?.settings.sample ? (
          <p className="mb-3 border-2 border-pmi-border bg-pmi-card px-3 py-2 text-sm font-bold">Sample project.</p>
        ) : null}
        {ready && !onHome && snapshot && !snapshot.settings.sample && !snapshot.project.name.trim() ? (
          <p className="mb-3 border-2 border-pmi-border bg-pmi-card px-3 py-2 text-sm font-bold">
            Name the project on Home before receiving material. Nothing is invented for you.
          </p>
        ) : null}
        {ready ? <Outlet /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
