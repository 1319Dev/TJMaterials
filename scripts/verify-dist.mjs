import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const index = readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('/TJMaterials/')) {
  throw new Error('Built index.html is missing the /TJMaterials/ base path.');
}
for (const marker of ['apple-mobile-web-app-capable', 'apple-touch-icon', 'format-detection', 'viewport-fit=cover']) {
  if (!index.includes(marker)) throw new Error(`Built index.html is missing ${marker}`);
}
if (!existsSync(path.join(dist, 'icons/apple-touch-icon.png'))) {
  throw new Error('180px Apple touch icon is missing.');
}
if (!existsSync(path.join(dist, '404.html'))) {
  throw new Error('dist/404.html is missing. GitHub Pages needs it for the SPA.');
}
if (!existsSync(path.join(dist, '.nojekyll'))) {
  throw new Error('dist/.nojekyll is missing.');
}
for (const asset of ['ocr/worker.min.js', 'ocr/eng.traineddata.gz', 'ocr/core/tesseract-core-simd-lstm.wasm.js']) {
  if (!existsSync(path.join(dist, asset))) throw new Error(`OCR asset missing from dist: ${asset}`);
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}

const files = walk(dist).map((file) => path.relative(dist, file));
if (!files.some((file) => file.endsWith('.webmanifest'))) {
  throw new Error('PWA manifest was not emitted.');
}
if (!files.some((file) => /(^|\/)(sw|workbox).*\.js$/.test(file) || file.includes('workbox'))) {
  throw new Error(`Service worker was not emitted. Files: ${files.join(', ')}`);
}
if (!existsSync(path.join(dist, 'sw-field-5.js'))) {
  throw new Error('dist/sw-field-5.js is missing.');
}
const sw = readFileSync(path.join(dist, 'sw-field-5.js'), 'utf8');
if (!sw.includes('pmi-field-5')) {
  throw new Error('sw-field-5.js is not using the pmi-field-5 cache prefix.');
}
if (!sw.includes('reset.html') && !sw.includes('reset\\.html')) {
  throw new Error('sw-field-5.js NavigationRoute does not denylist reset.html.');
}
if (!sw.includes('denylist')) {
  throw new Error('sw-field-5.js NavigationRoute was emitted without a denylist.');
}
const reset = readFileSync(path.join(dist, 'reset.html'), 'utf8');
if (!reset.includes('Clearing old app data…') || reset.includes('id="root"')) {
  throw new Error('dist/reset.html is missing or was replaced by the SPA shell.');
}
if (sw.includes('"url": "reset.html"') || sw.includes('"url":"reset.html"')) {
  throw new Error('reset.html was precached, so the navigation route can hide the clear script.');
}
for (const legacy of ['sw.js', 'sw-field-3.js', 'sw-field-4.js']) {
  const legacySource = readFileSync(path.join(dist, legacy), 'utf8');
  if (!legacySource.includes('reset.html') || legacySource.includes('NavigationRoute')) {
    throw new Error(`${legacy} is not the cache-busting replacement worker.`);
  }
}
const bundles = files.filter((file) => file.startsWith('assets/') && file.endsWith('.js'));
const bundleText = bundles.map((file) => readFileSync(path.join(dist, file), 'utf8')).join('\n');
if (!bundleText.includes('pmi-field-5')) {
  throw new Error('Built JS is missing the pmi-field-5 stamp.');
}

const manifestFile = files.find((file) => file.endsWith('.webmanifest'));
const manifest = JSON.parse(readFileSync(path.join(dist, manifestFile), 'utf8'));
if (!String(manifest.start_url).includes('/TJMaterials/')) {
  throw new Error(`Manifest start_url is ${manifest.start_url}`);
}
if (manifest.prefer_related_applications !== false) {
  throw new Error('Manifest must set prefer_related_applications to false so browsers do not offer a native app.');
}
if (manifest.display !== 'standalone') {
  throw new Error(`Manifest display is ${manifest.display}`);
}
console.log('dist OK', { manifest: manifestFile, files: files.length });
