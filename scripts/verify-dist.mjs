import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const dist = path.resolve('dist');
const index = readFileSync(path.join(dist, 'index.html'), 'utf8');
if (!index.includes('/TJMaterials/')) {
  throw new Error('Built index.html is missing the /TJMaterials/ base path.');
}
if (!existsSync(path.join(dist, '404.html'))) {
  throw new Error('dist/404.html is missing. GitHub Pages needs it for the SPA.');
}
if (!existsSync(path.join(dist, '.nojekyll'))) {
  throw new Error('dist/.nojekyll is missing.');
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

const manifestFile = files.find((file) => file.endsWith('.webmanifest'));
const manifest = JSON.parse(readFileSync(path.join(dist, manifestFile), 'utf8'));
if (!String(manifest.start_url).includes('/TJMaterials/')) {
  throw new Error(`Manifest start_url is ${manifest.start_url}`);
}
console.log('dist OK', { manifest: manifestFile, files: files.length });
