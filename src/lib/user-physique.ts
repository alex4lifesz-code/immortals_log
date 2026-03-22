export type UserGender = "male" | "female" | "other";

export interface UserPhysiqueSettings {
  gender: UserGender;
  bodyWeightKg: number | null;
  syncWeightFromCheckins?: boolean;
}

export const DEFAULT_USER_PHYSIQUE: UserPhysiqueSettings = {
  gender: "other",
  bodyWeightKg: null,
  syncWeightFromCheckins: false,
};

function normalizeBodyWeight(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 10) / 10;
}

function normalizeGender(value: unknown): UserGender {
  if (value === "male" || value === "female" || value === "other") return value;
  return "other";
}

export function getUserPhysiqueStorageKey(userId: string): string {
  return `cultivateos-user-physique-${userId}`;
}

export function loadUserPhysique(userId: string): UserPhysiqueSettings {
  if (typeof window === "undefined") return DEFAULT_USER_PHYSIQUE;

  const raw = localStorage.getItem(getUserPhysiqueStorageKey(userId));
  if (!raw) return DEFAULT_USER_PHYSIQUE;

  try {
    const parsed = JSON.parse(raw) as Partial<UserPhysiqueSettings>;
    return {
      gender: normalizeGender(parsed.gender),
      bodyWeightKg: normalizeBodyWeight(parsed.bodyWeightKg),
      syncWeightFromCheckins: parsed.syncWeightFromCheckins === true,
    };
  } catch {
    return DEFAULT_USER_PHYSIQUE;
  }
}

export function saveUserPhysique(userId: string, settings: UserPhysiqueSettings): UserPhysiqueSettings {
  const normalized: UserPhysiqueSettings = {
    gender: normalizeGender(settings.gender),
    bodyWeightKg: normalizeBodyWeight(settings.bodyWeightKg),
    syncWeightFromCheckins: settings.syncWeightFromCheckins === true,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(getUserPhysiqueStorageKey(userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("user-physique-updated", { detail: { userId, settings: normalized } }));
  }

  return normalized;
}

/**
 * If weight sync is enabled, fetch latest check-in weight and update settings.
 * Returns the updated weight or null if no data available.
 */
export async function syncWeightFromLatestCheckin(userId: string): Promise<number | null> {
  const current = loadUserPhysique(userId);
  if (!current.syncWeightFromCheckins) return current.bodyWeightKg;

  try {
    const res = await fetch(`/api/checkins/latest-weight?userId=${encodeURIComponent(userId)}`);
    const data = await res.json();
    if (data.weight != null) {
      saveUserPhysique(userId, { ...current, bodyWeightKg: data.weight });
      return data.weight;
    }
  } catch {
    // Silently fail — keep existing value
  }
  return current.bodyWeightKg;
}
