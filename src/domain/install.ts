export const PAGES_URL = 'https://1319dev.github.io/TJMaterials/';

export type InstallMode = 'home-screen' | 'ios' | 'browser';

export function installMode(input: {
  userAgent: string;
  maxTouchPoints: number;
  navigatorStandalone: boolean;
  displayModeStandalone: boolean;
}): InstallMode {
  if (input.navigatorStandalone || input.displayModeStandalone) return 'home-screen';
  const iosPhone = /iPad|iPhone|iPod/.test(input.userAgent);
  const ipadDesktopUa = /Macintosh/.test(input.userAgent) && input.maxTouchPoints > 1;
  if (iosPhone || ipadDesktopUa) return 'ios';
  return 'browser';
}

export function installGuidance(mode: InstallMode): { heading: string; body: string } {
  if (mode === 'home-screen') {
    return {
      heading: 'Home Screen website',
      body: 'This icon opens the same GitHub Pages site full screen. Records stay in this browser.',
    };
  }
  if (mode === 'ios') {
    return {
      heading: 'Add to Home Screen',
      body: `In Safari, tap Share, then Add to Home Screen. Address: ${PAGES_URL}. There is no App Store listing.`,
    };
  }
  return {
    heading: 'Add to Home Screen',
    body: `On iPhone, open ${PAGES_URL} in Safari, tap Share, then Add to Home Screen. There is no App Store listing.`,
  };
}

export function currentInstallMode(): InstallMode {
  const nav = navigator as Navigator & { standalone?: boolean };
  return installMode({
    userAgent: nav.userAgent,
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    navigatorStandalone: nav.standalone === true,
    displayModeStandalone:
      typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches,
  });
}
