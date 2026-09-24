/**
 * Browser Geolocation Service
 * Centralized, promise-based utility for acquiring real device GPS coordinates.
 */

export const getBrowserLocation = (options = {}) => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      resolve({
        success: false,
        error: 'Geolocation is not supported by your browser.',
        code: 0
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = Number(position.coords.latitude.toFixed(6));
        const longitude = Number(position.coords.longitude.toFixed(6));
        console.log('[locationService] Acquired fresh browser GPS:', { latitude, longitude, accuracy: position.coords.accuracy });
        resolve({
          success: true,
          latitude,
          longitude,
          accuracy: position.coords.accuracy
        });
      },
      (error) => {
        console.warn('[locationService] Geolocation error:', { code: error.code, message: error.message });
        resolve({
          success: false,
          error: error.message || 'Location permission denied or unavailable.',
          code: error.code
        });
      },
      {
        enableHighAccuracy: true,
        timeout: options.timeout || 10000,
        maximumAge: options.maximumAge !== undefined ? options.maximumAge : 0,
        ...options
      }
    );
  });
};
