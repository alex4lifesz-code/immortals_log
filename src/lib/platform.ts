/**
 * Platform detection utility.
 *
 * Web-browser platform helpers.
 */

/**
 * Always `false` in this web-only runtime.
 */
export function isNativePlatform(): boolean {
  return false;
}

/**
 * Convenience — returns `true` when running in a standard web browser.
 */
export function isBrowserPlatform(): boolean {
  return !isNativePlatform();
}
