import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../state/AppState';
import { BottomNav } from './BottomNav';
import { Disclaimer } from './ui';

export function Shell() {
  const { ready, error, syncLabel, syncDetail } = useApp();
  const location = useLocation();
  const onInstallPage = location.pathname.endsWith('/more');

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
    <div className="pmi-shell mx-auto min-h-[100dvh] max-w-lg px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))]">
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
        {ready ? <Outlet /> : null}
      </main>
      <BottomNav />
    </div>
  );
}
