"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useAuth } from "@/context/AuthContext";

// Display mode options for technique rendering (kept as exports for component prop types)
export type TechniqueDisplayMode =
  | "name-only"
  | "name-illumination"
  | "name-illumination-realm"
  | "name-illumination-realm-path";

export type ActiveCardStyle = "default" | "scroll-card";

export type DateFormatOption = "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";

export type TerminologyMode = "fantasy" | "normal";

export type VariationDisplayMode = "abbreviation" | "full";

export type WeightUnitPref = "kg" | "lbs";

export type RecentSessionsCompactMode = "auto" | "compact" | "full";

export type PopupLoggerStyle = "classic" | "minimal" | "compact";

export type UnifiedVisibleColumnKey =
  | "date"
  | "category"
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
  // Terminology mode: fantasy (wuxia) or normal (fitness)
  terminologyMode: TerminologyMode;
  // Progression log variation display mode
  progressionVariationDisplay: VariationDisplayMode;
  // Default weight unit preference
  defaultWeightUnit: WeightUnitPref;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  dateFormat: "dd-mmm-yyyy",
  terminologyMode: "normal",
  progressionVariationDisplay: "abbreviation",
  defaultWeightUnit: "kg",
};

const STORAGE_KEY = "cultivateos-display-settings";

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

function loadSettings(): DisplaySettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: DisplaySettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore storage errors
  }
}

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<DisplaySettings>(() => loadSettings());
  const [hydrated] = useState(() => typeof window !== "undefined");
  const [remotePrefsReady, setRemotePrefsReady] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);

  // Persist whenever settings change (after hydration)
  useEffect(() => {
    if (hydrated) {
      saveSettings(settings);
    }
  }, [settings, hydrated]);

  // Hydrate display settings from per-user shared preferences.
  useEffect(() => {
    let cancelled = false;

    const hydrateRemoteDisplaySettings = async () => {
      if (!user?.id) {
        syncedUserIdRef.current = null;
        setRemotePrefsReady(true);
        return;
      }

      setRemotePrefsReady(false);
      try {
        const res = await fetch("/api/users/preferences", { cache: "no-store", credentials: "include" });
        if (!res.ok) return;

        const payload = await res.json();
        const remoteSettings = payload?.displaySettings;
        if (!cancelled && remoteSettings && typeof remoteSettings === "object" && !Array.isArray(remoteSettings)) {
          setSettings({ ...DEFAULT_SETTINGS, ...(remoteSettings as Partial<DisplaySettings>) });
        }
      } catch {
        // Ignore remote sync errors and keep local settings.
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
    setSettings(prev => ({ ...prev, ...partial }));
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