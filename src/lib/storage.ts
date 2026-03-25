/**
 * Persistent storage abstraction.
 *
 * Uses localStorage / sessionStorage in web browsers.
 */

const REMEMBER_FLAG = "cultivation-remember";

/** Read a persisted value (Remember Me). */
export async function getPersistedUser(): Promise<string | null> {
  if (typeof window === "undefined") return null;

  // Web: check localStorage (Remember Me) then sessionStorage (session-only)
  return (
    localStorage.getItem("cultivation-user") ||
    sessionStorage.getItem("cultivation-user")
  );
}

/** Persist user data according to Remember Me preference. */
export async function persistUser(
  json: string,
  rememberMe: boolean
): Promise<void> {
  if (typeof window === "undefined") return;

  if (rememberMe) {
    localStorage.setItem("cultivation-user", json);
    localStorage.setItem(REMEMBER_FLAG, "1");
    sessionStorage.removeItem("cultivation-user");
  } else {
    sessionStorage.setItem("cultivation-user", json);
    localStorage.removeItem("cultivation-user");
    localStorage.removeItem(REMEMBER_FLAG);
  }
}

/** Clear all auth storage on logout. */
export async function clearPersistedUser(): Promise<void> {
  if (typeof window === "undefined") return;

  localStorage.removeItem("cultivation-user");
  localStorage.removeItem(REMEMBER_FLAG);
  sessionStorage.removeItem("cultivation-user");
}
