import type { PermissionNote } from './types';

export async function requestCameraStub(now = new Date()): Promise<PermissionNote> {
  if (!navigator.mediaDevices?.getUserMedia) {
    return {
      status: 'unavailable',
      message: 'Camera API is not available in this browser. No photo was stored.',
      latitude: null,
      longitude: null,
      recordedAt: now.toISOString(),
    };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false,
    });
    for (const track of stream.getTracks()) track.stop();
    return {
      status: 'granted',
      message: 'Camera permission granted. Phase 1 stores no photo bytes.',
      latitude: null,
      longitude: null,
      recordedAt: now.toISOString(),
    };
  } catch (error) {
    const name = error instanceof DOMException ? error.name : '';
    const denied = name === 'NotAllowedError' || name === 'PermissionDeniedError';
    return {
      status: denied ? 'denied' : 'unavailable',
      message: denied
        ? 'Camera permission denied. No photo was stored.'
        : 'Camera could not be opened. No photo was stored.',
      latitude: null,
      longitude: null,
      recordedAt: now.toISOString(),
    };
  }
}

export async function requestGpsStub(now = new Date()): Promise<PermissionNote> {
  if (!navigator.geolocation) {
    return {
      status: 'unavailable',
      message: 'Geolocation is not available in this browser. No coordinates were stored.',
      latitude: null,
      longitude: null,
      recordedAt: now.toISOString(),
    };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: 'granted',
          message: 'Location captured from this device.',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          recordedAt: now.toISOString(),
        });
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        resolve({
          status: denied ? 'denied' : 'unavailable',
          message: denied
            ? 'Location permission denied. No coordinates were stored.'
            : 'Location was not provided. No coordinates were stored.',
          latitude: null,
          longitude: null,
          recordedAt: now.toISOString(),
        });
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  });
}
