/**
 * Platform detection utility.
 *
 * Differentiates between native Capacitor APK execution context and
 * standard web-browser access.  Used to enforce desktop-only presentation in
 * browsers while the APK retains full mobile-optimised functionality.
 */

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
      platform?: string;
    };
  }
}

/**
 * Returns `true` when the app is running inside the Capacitor native shell
 * (i.e. the installed Android APK).  Falls back to user-agent heuristics when
 * the Capacitor bridge is not available.
 */
export function isNativePlatform(): boolean {
  if (typeof window === "undefined") return false;

  // Primary: Capacitor native bridge detection
  if (window.Capacitor?.isNativePlatform) {
    return window.Capacitor.isNativePlatform();
  }

  // Secondary: check Capacitor platform string
  if (
    window.Capacitor?.getPlatform &&
    window.Capacitor.getPlatform() !== "web"
  ) {
    return true;
  }

  if (window.Capacitor?.platform && window.Capacitor.platform !== "web") {
    return true;
  }

  // Tertiary: user-agent heuristic – Android WebView used by Capacitor
  // wraps itself in "wv" (WebView) flag.
  const ua = navigator.userAgent || "";
  if (/; wv\)/.test(ua) && /Android/.test(ua)) {
    return true;
  }

  // Quaternary: custom UA string appended by capacitor.config.ts
  if (/CapacitorNative/.test(ua)) {
    return true;
  }

  return false;
}

/**
 * Convenience — returns `true` when running in a standard web browser
 * (i.e. NOT the installed APK).
 */
export function isBrowserPlatform(): boolean {
  return !isNativePlatform();
}
