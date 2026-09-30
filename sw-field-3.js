/* Replaces a stuck Workbox worker at sw.js, sw-field-3.js, or sw-field-4.js.
   Those builds answered every navigation, including reset.html, with precached
   index.html. Serving this file at the old script URL lets the browser update
   that registration. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(recover());
});

async function recover() {
  await self.clients.claim();
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
  const scope = self.registration.scope.endsWith('/') ? self.registration.scope : `${self.registration.scope}/`;
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  await Promise.all(
    windows.map(async (client) => {
      const wantsReset = new URL(client.url).pathname.endsWith('/reset.html');
      const target = new URL(wantsReset ? 'reset.html' : '?fresh=5', scope);
      try {
        await client.navigate(target.href);
      } catch {
        // Some browsers reject client.navigate. The cache is already empty.
      }
    }),
  );
  await self.registration.unregister();
}
