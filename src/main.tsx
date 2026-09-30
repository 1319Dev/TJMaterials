import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { CLIENT_BUILD, SERVICE_WORKER_FILENAME } from './build-id';
import { AppProvider } from './state/AppState';
import './index.css';

function keepsCurrentWorker(registration: ServiceWorkerRegistration): boolean {
  return [registration.active, registration.waiting, registration.installing].some((worker) =>
    worker?.scriptURL.includes(SERVICE_WORKER_FILENAME),
  );
}

async function dropStaleAppCache() {
  try {
    if (localStorage.getItem('pmi-client-build') !== CLIENT_BUILD) {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
      }
      localStorage.setItem('pmi-client-build', CLIENT_BUILD);
    }
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations
          .filter((registration) => !keepsCurrentWorker(registration))
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
