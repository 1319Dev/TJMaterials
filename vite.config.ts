import react from '@vitejs/plugin-react';
import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { VitePWA } from 'vite-plugin-pwa';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: '/TJMaterials/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      filename: 'sw-field-4.js',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/TJMaterials/',
        name: 'Pipeline Material Inspector',
        short_name: 'Material Inspector',
        description:
          'Third-party pipeline materials documentation website. Install from the browser. Not an App Store app.',
        theme_color: '#2a3340',
        background_color: '#c5ccd4',
        display: 'standalone',
        prefer_related_applications: false,
        start_url: '/TJMaterials/',
        scope: '/TJMaterials/',
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        cacheId: 'pmi-field-4',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,txt,gz}'],
      },
    }),
    {
      name: 'spa-fallback-404',
      apply: 'build',
      closeBundle() {
        const dist = path.resolve(root, 'dist');
        copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
      },
    },
  ],
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
