import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProvider } from './state/AppState';
import './index.css';

const CLIENT_BUILD = 'pmi-field-4';

async function dropStaleAppCache() {
  try {
    if (localStorage.getItem('pmi-client-build') === CLIENT_BUILD) return;
    localStorage.setItem('pmi-client-build', CLIENT_BUILD);
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => !registration.active?.scriptURL.includes('sw-field-4.js'))
          .map((registration) => registration.unregister()),
      );
    }
  } catch {
    // A blocked cache still leaves the on-device project readable.
  }
}

void dropStaleAppCache();

const root = document.getElementById('root');
if (!root) throw new Error('Root element missing');

createRoot(root).render(
  <StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </StrictMode>,
);
