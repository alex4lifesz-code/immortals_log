"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import type { LanguageMode } from "@/lib/language";

// Display mode options for technique rendering (kept as exports for component prop types)
export type TechniqueDisplayMode =
  | "name-only"
  | "name-illumination"
  | "name-illumination-realm"
  | "name-illumination-realm-path";

export type ActiveCardStyle = "default" | "scroll-card";

export type DateFormatOption = "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";

export type CalendarWeekStartOption = "sunday" | "monday";

export type TerminologyMode = "fantasy" | "normal";

export type VariationDisplayMode = "abbreviation" | "full";

export type TimedUnitPref = "seconds" | "minutes";

export type WeightUnitPref = "kg" | "lbs";

export type RecentSessionsCompactMode = "auto" | "compact" | "full";

export type PopupLoggerStyle = "classic" | "minimal" | "compact";

export type CheckInHistoryViewMode = "detailed" | "compact";

export type CheckInCalendarScopeOption = "all" | "mine" | "friends";

export type UnifiedVisibleColumnKey =
  | "date"
  | "category"
  | "progression"
  | "val1"
  | "val2"
  | "val3"
  | "reps1"
  | "reps2"
  | "reps3"
  | "modifier"
  | "band"
  | "variant"
  | "notes"
  | "standardWeight"
  | "avgWeight";

export const DEFAULT_UNIFIED_VISIBLE_COLUMNS: UnifiedVisibleColumnKey[] = [
  "date",
  "category",
  "progression",
  "val1",
  "val2",
  "val3",
  "reps1",
  "reps2",
  "reps3",
  "modifier",
  "band",
  "variant",
  "notes",
];

export interface DisplaySettings {
  // Date display format preference
  dateFormat: DateFormatOption;
  // Preferred timezone for all date and calendar calculations
  timeZone: string;
  // Calendar week start behaviour
  calendarWeekStart: CalendarWeekStartOption;
  // Terminology mode: fantasy (wuxia) or normal (fitness)
  terminologyMode: TerminologyMode;
  // Progression log variation display mode
  progressionVariationDisplay: VariationDisplayMode;
  // Default weight unit preference
  defaultWeightUnit: WeightUnitPref;
  // Default timed display unit preference
  defaultTimedUnit: TimedUnitPref;
  // UI language mode
  languageMode: LanguageMode;
  // Show opposite-language exercise name alongside primary name
  showExerciseForeignLanguage: boolean;
  // Check-In history rendering mode
  checkInHistoryView: CheckInHistoryViewMode;
  // Check-In scope filter
  checkInCalendarScope: CheckInCalendarScopeOption;
}

function getBrowserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const DEFAULT_SETTINGS: DisplaySettings = {
  dateFormat: "dd-mmm-yyyy",
  timeZone: getBrowserTimeZone(),
  calendarWeekStart: "sunday",
  terminologyMode: "normal",
  progressionVariationDisplay: "abbreviation",
  defaultWeightUnit: "kg",
  defaultTimedUnit: "seconds",
  languageMode: "english",
  showExerciseForeignLanguage: false,
  checkInHistoryView: "compact",
  checkInCalendarScope: "all",
};

function normalizeDisplaySettings(partial?: Partial<DisplaySettings> | null): DisplaySettings {
  return {
    ...DEFAULT_SETTINGS,
    ...(partial ?? {}),
    languageMode: "english",
    showExerciseForeignLanguage: false,
  };
}

export const DISPLAY_SETTINGS_STORAGE_KEY = "cultivateos-display-settings";

function getDisplaySettingsStorageKey(userId: string | null | undefined): string {
  if (!userId) {
    return DISPLAY_SETTINGS_STORAGE_KEY;
  }
  return `${DISPLAY_SETTINGS_STORAGE_KEY}-${userId}`;
}

// Non-user-configurable display defaults — single source of truth for all
// layout and presentation values that are fixed (not exposed in the settings UI).
export const DISPLAY_DEFAULTS = {
  // Training session sidebar
  sidebarMode: "name-illumination-realm" as TechniqueDisplayMode,
  sidebarStyle: "default" as ActiveCardStyle,
  sidebarWidth: 320,
  glowIntensitySidebar: 100,
  sidebarLoreVisible: true,
  // Training Grounds progression sidebar
  progressionSidebarMode: "name-illumination-realm" as TechniqueDisplayMode,
  progressionSidebarStyle: "default" as ActiveCardStyle,
  glowIntensityProgressionSidebar: 100,
  progressionSidebarLoreVisible: true,
  progressionSidebarUseThemeColor: false,
  // Set logger (progression active card)
  progressionCardMode: "name-illumination-realm-path" as TechniqueDisplayMode,
  progressionCardStyle: "default" as ActiveCardStyle,
  progressionCardCompact: false,
  glowIntensityProgressionCards: 100,
  progressionCardLoreVisible: true,
  popupLoggerStyle: "classic" as PopupLoggerStyle,
  // Training log table
  progressionLogMode: "name-illumination-realm" as TechniqueDisplayMode,
  progressionLogCompact: "compact" as RecentSessionsCompactMode,
  glowIntensityProgressionLog: 100,
  progressionColumnColorsEnabled: true,
  progressionColumnOrderGrouped: true,
  // Exercise history modal columns
  columnColorsEnabled: true,
  columnOrderGrouped: false,
} as const;

interface DisplaySettingsContextType {
  settings: DisplaySettings;
  updateSettings: (partial: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
}

const DisplaySettingsContext = createContext<DisplaySettingsContextType | null>(null);

function loadSettings(userId: string | null | undefined): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const storageKey = getDisplaySettingsStorageKey(userId);
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<DisplaySettings>;
      return normalizeDisplaySettings(parsed);
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: DisplaySettings, userId: string | null | undefined) {
  if (typeof window === "undefined") return;
  try {
    const serialized = JSON.stringify(settings);
    // Always mirror to the shared key so legacy utilities (e.g. terminology,
    // timezone helpers) read the *current* user's effective preferences.
    localStorage.setItem(DISPLAY_SETTINGS_STORAGE_KEY, serialized);
    // Also persist under the user-scoped key so each user's settings are
    // restored correctly when they log back in.
    if (userId) {
      localStorage.setItem(getDisplaySettingsStorageKey(userId), serialized);
    }
  } catch {
    // Ignore storage errors
  }
}


export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  // Initial state reads the legacy shared key so SSR-mismatch is avoided and the
  // very first paint matches whatever the layout script applied. The hydration
  // effect below replaces this with the active user's settings.
  const [settings, setSettings] = useState<DisplaySettings>(() => loadSettings(null));
  const [hydrated] = useState(() => typeof window !== "undefined");
  const [remotePrefsReady, setRemotePrefsReady] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);

  // Persist whenever settings change. CRITICAL: only persist after the
  // hydration effect has loaded *this* user's settings (tracked via
  // syncedUserIdRef). Otherwise, when switching accounts, the previous user's
  // settings would be written into the new user's storage key on the first
  // render after `user.id` changes (the persist effect fires before the
  // hydration effect updates state).
  useEffect(() => {
    if (!hydrated) return;
    if (user?.id) {
      // Signed in: only persist once hydration for this user has completed.
      if (syncedUserIdRef.current !== user.id) return;
      saveSettings(settings, user.id);
    } else {
      // Signed out: only mirror to shared key, never to a user-scoped key.
      // Hydration sets syncedUserIdRef to null when there is no user.
      if (syncedUserIdRef.current !== null) return;
      saveSettings(settings, null);
    }
  }, [settings, hydrated, user?.id]);

  // Hydrate display settings from per-user shared preferences when user changes
  useEffect(() => {
    let cancelled = false;

    const hydrateRemoteDisplaySettings = async () => {
      if (!user?.id) {
        // Logged out: keep whatever was in shared key as-is so the login screen
        // can still apply it. Do not overwrite from a stale per-user key.
        syncedUserIdRef.current = null;
        setRemotePrefsReady(true);
        return;
      }

      setRemotePrefsReady(false);

      // Immediately swap to this user's locally cached settings so we stop
      // showing the previous user's values while the API call is in flight.
      const localSettings = loadSettings(user.id);
      setSettings(localSettings);

      try {
        const res = await fetch("/api/users/preferences", { cache: "no-store", credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch preferences");

        const payload = await res.json();
        const remoteSettings = payload?.displaySettings;

        if (!cancelled && remoteSettings && typeof remoteSettings === "object" && !Array.isArray(remoteSettings)) {
          // Remote takes precedence — it is the authoritative cross-device copy.
          setSettings(normalizeDisplaySettings(remoteSettings as Partial<DisplaySettings>));
        }
      } catch {
        // Ignore remote sync errors; local user-scoped settings already applied.
      } finally {
        if (!cancelled) {
          syncedUserIdRef.current = user.id;
          setRemotePrefsReady(true);
        }
      }
    };

    hydrateRemoteDisplaySettings();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Persist display settings to shared per-user preferences.
  useEffect(() => {
    if (!remotePrefsReady || !user?.id || syncedUserIdRef.current !== user.id) return;

    const timer = window.setTimeout(() => {
      fetch("/api/users/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          displaySettings: settings,
        }),
      }).catch(() => {
        // Ignore sync failures; local storage persistence still applies.
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [settings, remotePrefsReady, user?.id]);

  const updateSettings = useCallback((partial: Partial<DisplaySettings>) => {
    setSettings((prev) => normalizeDisplaySettings({ ...prev, ...partial }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <DisplaySettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </DisplaySettingsContext.Provider>
  );
}

export function useDisplaySettings(): DisplaySettingsContextType {
  const ctx = useContext(DisplaySettingsContext);
  if (!ctx) {
    throw new Error("useDisplaySettings must be used within a DisplaySettingsProvider");
  }
  return ctx;
}