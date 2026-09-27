import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from 'vitest';

const config = readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');

test('the service worker cache is versioned so an old install updates', () => {
  expect(config).toContain("filename: 'sw-field-4.js'");
  expect(config).toContain("cacheId: 'pmi-field-4'");
  expect(config).toContain('skipWaiting: true');
  expect(config).toContain('clientsClaim: true');
  expect(config).toContain('cleanupOutdatedCaches: true');
  expect(config).toContain("registerType: 'autoUpdate'");
  expect(config).toContain("base: '/TJMaterials/'");
});
