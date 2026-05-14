/**
 * Safely access navigator.userAgent, handling SSR where navigator is undefined.
 * Returns empty string when called on the server.
 */
function getUserAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent;
}

export function isIOS(): boolean {
  return Boolean(/iPad|iPhone|iPod/.test(getUserAgent()));
}

export function isSafari(): boolean {
  const ua = getUserAgent();
  return Boolean(/Safari/.test(ua) && !/Chrome/.test(ua));
}

export function supportsMSE(): boolean {
  return typeof window !== 'undefined' && !!window.MediaSource;
}

/**
 * Returns true when the browser cannot play FLV via mpegts.js and needs HLS.
 * iOS Safari lacks MSE, and Safari generally works best with native HLS.
 * Also covers browsers without any MSE support.
 */
export function needsHLSFallback(): boolean {
  return isIOS() || isSafari() || !supportsMSE();
}
