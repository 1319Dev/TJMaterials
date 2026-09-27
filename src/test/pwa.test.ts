import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const root = process.cwd();
const config = readFileSync(path.resolve(root, 'vite.config.ts'), 'utf8');
const main = readFileSync(path.resolve(root, 'src/main.tsx'), 'utf8');
const buildId = readFileSync(path.resolve(root, 'src/build-id.ts'), 'utf8');
const reset = readFileSync(path.resolve(root, 'public/reset.html'), 'utf8');
const legacyWorker = readFileSync(path.resolve(root, 'public/sw.js'), 'utf8');

test('the service worker cache is versioned so an old install updates', () => {
  expect(config).toContain("filename: 'sw-field-5.js'");
  expect(config).toContain("cacheId: 'pmi-field-5'");
  expect(config).toContain('skipWaiting: true');
  expect(config).toContain('clientsClaim: true');
  expect(config).toContain('cleanupOutdatedCaches: true');
  expect(config).toContain("registerType: 'autoUpdate'");
  expect(config).toContain("base: '/TJMaterials/'");
  expect(config).toContain('navigateFallbackDenylist');
  expect(config).toContain('/\\/reset\\.html$/');
  expect(config).toContain("'**/reset.html'");
  expect(buildId).toContain("export const CLIENT_BUILD = 'pmi-field-5'");
  expect(buildId).toContain("export const SERVICE_WORKER_FILENAME = 'sw-field-5.js'");
  expect(main).toContain('SERVICE_WORKER_FILENAME');
  expect(main).not.toContain('sw-field-4.js');
  expect(main).not.toContain('pmi-field-4');
});

test('reset.html clears workers, caches, and the on-device database outside the SPA shell', () => {
  expect(reset).toContain('Clearing old app data…');
  expect(reset).toContain('navigator.serviceWorker.getRegistrations()');
  expect(reset).toContain('registration.unregister()');
  expect(reset).toContain('caches.keys()');
  expect(reset).toContain('caches.delete(key)');
  expect(reset).toContain("indexedDB.deleteDatabase('pipeline-material-inspector')");
  expect(reset).toContain("key === 'pmi-client-build'");
  expect(reset).toContain("location.replace('./?fresh=5')");
  expect(reset).not.toContain('id="root"');
  expect(reset).not.toContain('Guest');
});

test('legacy worker urls drop the empty-denylist navigation route', () => {
  for (const name of ['sw.js', 'sw-field-3.js', 'sw-field-4.js']) {
    const source = readFileSync(path.resolve(root, 'public', name), 'utf8');
    expect(source).toBe(legacyWorker);
    expect(source).toContain('skipWaiting');
    expect(source).toContain('caches.delete');
    expect(source).toContain('reset.html');
    expect(source).toContain('unregister');
    expect(source).not.toContain('NavigationRoute');
    expect(source).not.toContain('respondWith');
  }
});
