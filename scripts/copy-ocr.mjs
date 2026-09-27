import { copyFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dest = path.join(root, 'public', 'ocr');
const core = path.join(dest, 'core');
mkdirSync(core, { recursive: true });

const cores = [
  'tesseract-core-lstm.wasm.js',
  'tesseract-core-simd-lstm.wasm.js',
  'tesseract-core-relaxedsimd-lstm.wasm.js',
];
for (const file of cores) {
  copyFileSync(path.join(root, 'node_modules', 'tesseract.js-core', file), path.join(core, file));
}
copyFileSync(path.join(root, 'node_modules', 'tesseract.js', 'dist', 'worker.min.js'), path.join(dest, 'worker.min.js'));
copyFileSync(
  path.join(root, 'node_modules', '@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'),
  path.join(dest, 'eng.traineddata.gz'),
);
console.log('ocr assets copied');
