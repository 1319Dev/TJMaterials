import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from 'vitest';
import { PAGES_URL, installGuidance, installMode } from '../domain/install';

describe('browser install', () => {
  test('treats an iPhone as Safari Home Screen install', () => {
    expect(
      installMode({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        maxTouchPoints: 5,
        navigatorStandalone: false,
        displayModeStandalone: false,
      }),
    ).toBe('ios');
    expect(installGuidance('ios').body).toContain('Add to Home Screen');
    expect(installGuidance('ios').body).toContain(PAGES_URL);
    expect(installGuidance('ios').body).toContain('no App Store listing');
  });

  test('recognizes an iPad that sends a desktop user agent', () => {
    expect(
      installMode({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
        maxTouchPoints: 5,
        navigatorStandalone: false,
        displayModeStandalone: false,
      }),
    ).toBe('ios');
  });

  test('keeps a Home Screen session on the same website', () => {
    expect(
      installMode({
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148',
        maxTouchPoints: 5,
        navigatorStandalone: true,
        displayModeStandalone: false,
      }),
    ).toBe('home-screen');
    expect(installGuidance('home-screen').body).toContain('same GitHub Pages site');
  });

  test('stays a static Vite site on the GitHub Pages base path', () => {
    const config = readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const html = readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    expect(config).toContain("base: '/TJMaterials/'");
    expect(config).toContain('prefer_related_applications: false');
    expect(config).not.toMatch(/capacitor|cordova|react-native/i);
    expect(html).toContain('apple-mobile-web-app-capable');
    expect(html).toContain('apple-touch-icon');
    expect(html).toContain('format-detection');
  });
});
