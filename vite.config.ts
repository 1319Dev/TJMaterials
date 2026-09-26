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
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/TJMaterials/',
        name: 'Pipeline Material Inspector',
        short_name: 'Material Inspector',
        description:
          'Third-party pipeline materials documentation website. Install from the browser. Not an App Store app.',
        theme_color: '#0c5c56',
        background_color: '#f3f0e8',
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
        navigateFallback: 'index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,txt}'],
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
