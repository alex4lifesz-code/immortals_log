export type UserGender = "male" | "female" | "other";

export interface UserPhysiqueSettings {
  gender: UserGender;
  bodyWeightKg: number | null;
}

export const DEFAULT_USER_PHYSIQUE: UserPhysiqueSettings = {
  gender: "other",
  bodyWeightKg: null,
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
    };
  } catch {
    return DEFAULT_USER_PHYSIQUE;
  }
}

export function saveUserPhysique(userId: string, settings: UserPhysiqueSettings): UserPhysiqueSettings {
  const normalized: UserPhysiqueSettings = {
    gender: normalizeGender(settings.gender),
    bodyWeightKg: normalizeBodyWeight(settings.bodyWeightKg),
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(getUserPhysiqueStorageKey(userId), JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("user-physique-updated", { detail: { userId, settings: normalized } }));
  }

  return normalized;
}
