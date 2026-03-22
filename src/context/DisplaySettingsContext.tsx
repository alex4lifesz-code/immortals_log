"use client";

import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";

// Display mode options for technique rendering
export type TechniqueDisplayMode =
  | "name-only"
  | "name-illumination"
  | "name-illumination-realm"
  | "name-illumination-realm-path";

export type ActiveCardStyle = "default" | "scroll-card";

export type RecentSessionsCompactMode = "auto" | "compact" | "full";

export type DateFormatOption = "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";

export type FontOption = "system" | "roboto" | "cinzel" | "noto-serif" | "crimson-text" | "ma-shan-zheng";

export type TerminologyMode = "fantasy" | "normal";

export type VariationDisplayMode = "abbreviation" | "full";

export interface DisplaySettings {
  // Active technique cards: display mode (same as sidebar/sessions)
  activeCardMode: TechniqueDisplayMode;
  // Active technique cards: show name above badges on its own line (legacy, derived from mode)
  activeCardNameAboveBadges: boolean;
  // Active technique cards: visual style variant
  activeCardStyle: ActiveCardStyle;
  // Active technique cards: always show notes field
  activeCardNotesAlwaysVisible: boolean;
  // Recent sessions table display mode
  recentSessionsMode: TechniqueDisplayMode;
  // Recent sessions compact presentation mode
  recentSessionsCompact: RecentSessionsCompactMode;
  // Show all training sessions instead of recent only
  showAllSessions: boolean;
  // Sidebar display mode
  sidebarMode: TechniqueDisplayMode;
  // Sidebar visual style variant
  sidebarStyle: ActiveCardStyle;
  // Training Grounds side panel position
  sidebarPosition: "left" | "right";
  // Training Grounds side panel width (pixels)
  sidebarWidth: number;
  // Quick View right panel visible
  rightPanelVisible: boolean;
  // Active technique cards: compact mode
  activeCardCompact: boolean;
  // Date display format preference
  dateFormat: DateFormatOption;
  // Font selection
  fontFamily: FontOption;
  // Terminology mode: fantasy (wuxia) or normal (fitness)
  terminologyMode: TerminologyMode;
  // Glow intensity for sidebar (0-100)
  glowIntensitySidebar: number;
  // Glow intensity for active cards (0-100)
  glowIntensityActiveCards: number;
  // Glow intensity for recent sessions (0-100)
  glowIntensityRecentSessions: number;
  // Lore/story visibility for active technique cards
  activeCardLoreVisible: boolean;
  // Lore/story visibility for Training Grounds sidebar
  sidebarLoreVisible: boolean;
  // Recent sessions duration filter in days (0 = all, 7/14/30/90)
  recentSessionsDays: number;
  // Column colour differentiation for W/R columns
  columnColorsEnabled: boolean;
  // Column order: false = W1,R1,W2,R2,W3,R3 (default), true = W1,W2,W3,R1,R2,R3 (grouped)
  columnOrderGrouped: boolean;
  // ── Progression page settings ──
  // Progression sidebar display mode
  progressionSidebarMode: TechniqueDisplayMode;
  // Progression sidebar visual style variant
  progressionSidebarStyle: ActiveCardStyle;
  // Progression sidebar compact mode
  progressionSidebarCompact: boolean;
  // Progression sidebar glow intensity (0-100)
  glowIntensityProgressionSidebar: number;
  // Progression sidebar lore visibility
  progressionSidebarLoreVisible: boolean;
  // Progression sidebar use theme color instead of difficulty color
  progressionSidebarUseThemeColor: boolean;
  // Progression sidebar expand tiers mode (true = expandable tiers, false = basic click-to-add)
  progressionSidebarExpandTiers: boolean;
  // Progression active card display mode
  progressionCardMode: TechniqueDisplayMode;
  // Progression active card visual style variant
  progressionCardStyle: ActiveCardStyle;
  // Progression active card compact mode
  progressionCardCompact: boolean;
  // Progression active card glow intensity (0-100)
  glowIntensityProgressionCards: number;
  // Progression active card lore visibility
  progressionCardLoreVisible: boolean;
  // Progression training log display mode
  progressionLogMode: TechniqueDisplayMode;
  // Progression training log compact mode
  progressionLogCompact: RecentSessionsCompactMode;
  // Progression training log glow intensity (0-100)
  glowIntensityProgressionLog: number;
  // Progression log column colours
  progressionColumnColorsEnabled: boolean;
  // Progression log column order grouped
  progressionColumnOrderGrouped: boolean;
  // Progression log variation display mode
  progressionVariationDisplay: VariationDisplayMode;
}

const DEFAULT_SETTINGS: DisplaySettings = {
  activeCardMode: "name-illumination-realm-path",
  activeCardStyle: "default",
  activeCardNameAboveBadges: false,
  activeCardNotesAlwaysVisible: false,
  recentSessionsMode: "name-illumination-realm",
  recentSessionsCompact: "auto",
  showAllSessions: false,
  sidebarMode: "name-illumination-realm",
  sidebarStyle: "default",
  sidebarPosition: "left",
  sidebarWidth: 320,
  rightPanelVisible: true,
  activeCardCompact: false,
  dateFormat: "dd-mmm-yyyy",
  fontFamily: "system",
  terminologyMode: "fantasy",
  glowIntensitySidebar: 100,
  glowIntensityActiveCards: 100,
  glowIntensityRecentSessions: 100,
  activeCardLoreVisible: true,
  sidebarLoreVisible: true,
  recentSessionsDays: 0,
  columnColorsEnabled: true,
  columnOrderGrouped: false,
  // Progression defaults
  progressionSidebarMode: "name-illumination-realm",
  progressionSidebarStyle: "default",
  progressionSidebarCompact: false,
  glowIntensityProgressionSidebar: 100,
  progressionSidebarLoreVisible: true,
  progressionSidebarUseThemeColor: false,
  progressionSidebarExpandTiers: true,
  progressionCardMode: "name-illumination-realm-path",
  progressionCardStyle: "default",
  progressionCardCompact: false,
  glowIntensityProgressionCards: 100,
  progressionCardLoreVisible: true,
  progressionLogMode: "name-illumination-realm",
  progressionLogCompact: "auto",
  glowIntensityProgressionLog: 100,
  progressionColumnColorsEnabled: true,
  progressionColumnOrderGrouped: false,
  progressionVariationDisplay: "abbreviation",
};

const STORAGE_KEY = "cultivateos-display-settings";
const PRESETS_STORAGE_KEY = "cultivateos-display-presets";
const ACTIVE_PRESET_STORAGE_KEY = "cultivateos-active-preset";

export const PRESET_SLOT_COUNT = 5;

export interface DisplayPreset {
  name: string;
  settings: DisplaySettings;
  savedAt: string; // ISO date string
}

export type PresetSlots = (DisplayPreset | null)[];

interface DisplaySettingsContextType {
  settings: DisplaySettings;
  updateSettings: (partial: Partial<DisplaySettings>) => void;
  resetSettings: () => void;
  // Preset management
  presets: PresetSlots;
  activePresetIndex: number | null;
  savePreset: (slotIndex: number, name?: string) => void;
  loadPreset: (slotIndex: number) => void;
  clearPreset: (slotIndex: number) => void;
  renamePreset: (slotIndex: number, name: string) => void;
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

function loadPresets(): PresetSlots {
  if (typeof window === "undefined") return Array(PRESET_SLOT_COUNT).fill(null);
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Ensure we always have exactly PRESET_SLOT_COUNT slots
      const slots: PresetSlots = Array(PRESET_SLOT_COUNT).fill(null);
      for (let i = 0; i < PRESET_SLOT_COUNT; i++) {
        if (parsed[i]) slots[i] = parsed[i];
      }
      return slots;
    }
  } catch {
    // Ignore parse errors
  }
  return Array(PRESET_SLOT_COUNT).fill(null);
}

function savePresets(presets: PresetSlots) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage errors
  }
}

function loadActivePresetIndex(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(ACTIVE_PRESET_STORAGE_KEY);
    if (stored !== null) {
      const idx = JSON.parse(stored);
      return typeof idx === "number" ? idx : null;
    }
  } catch {}
  return null;
}

function saveActivePresetIndex(index: number | null) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_PRESET_STORAGE_KEY, JSON.stringify(index));
  } catch {}
}

export function DisplaySettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<DisplaySettings>(() => loadSettings());
  const [presets, setPresets] = useState<PresetSlots>(() => loadPresets());
  const [activePresetIndex, setActivePresetIndex] = useState<number | null>(() => loadActivePresetIndex());
  const [hydrated] = useState(() => typeof window !== "undefined");

  // Hydrate flag for SSR — on the server loadSettings/loadPresets return
  // defaults so the first client render matches. The flag is already true on
  // the client (via the initializer) so persistence effects fire immediately.

  // Persist whenever settings change (after hydration)
  useEffect(() => {
    if (hydrated) {
      saveSettings(settings);
    }
  }, [settings, hydrated]);

  // Persist presets
  useEffect(() => {
    if (hydrated) {
      savePresets(presets);
    }
  }, [presets, hydrated]);

  // Persist active preset index
  useEffect(() => {
    if (hydrated) {
      saveActivePresetIndex(activePresetIndex);
    }
  }, [activePresetIndex, hydrated]);

  const updateSettings = useCallback((partial: Partial<DisplaySettings>) => {
    setSettings(prev => ({ ...prev, ...partial }));
    // When settings change manually, deactivate active preset since it no longer matches
    setActivePresetIndex(null);
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    setActivePresetIndex(null);
  }, []);

  const savePresetFn = useCallback((slotIndex: number, name?: string) => {
    if (slotIndex < 0 || slotIndex >= PRESET_SLOT_COUNT) return;
    setPresets(prev => {
      const next = [...prev];
      next[slotIndex] = {
        name: name || `Preset ${slotIndex + 1}`,
        settings: { ...settings },
        savedAt: new Date().toISOString(),
      };
      return next;
    });
    setActivePresetIndex(slotIndex);
  }, [settings]);

  const loadPresetFn = useCallback((slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= PRESET_SLOT_COUNT) return;
    const preset = presets[slotIndex];
    if (!preset) return;
    setSettings({ ...DEFAULT_SETTINGS, ...preset.settings });
    setActivePresetIndex(slotIndex);
  }, [presets]);

  const clearPresetFn = useCallback((slotIndex: number) => {
    if (slotIndex < 0 || slotIndex >= PRESET_SLOT_COUNT) return;
    setPresets(prev => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
    if (activePresetIndex === slotIndex) {
      setActivePresetIndex(null);
    }
  }, [activePresetIndex]);

  const renamePresetFn = useCallback((slotIndex: number, name: string) => {
    if (slotIndex < 0 || slotIndex >= PRESET_SLOT_COUNT) return;
    setPresets(prev => {
      const next = [...prev];
      if (next[slotIndex]) {
        next[slotIndex] = { ...next[slotIndex]!, name };
      }
      return next;
    });
  }, []);

  return (
    <DisplaySettingsContext.Provider value={{
      settings,
      updateSettings,
      resetSettings,
      presets,
      activePresetIndex,
      savePreset: savePresetFn,
      loadPreset: loadPresetFn,
      clearPreset: clearPresetFn,
      renamePreset: renamePresetFn,
    }}>
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
