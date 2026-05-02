"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { NavItem, defaultNavItems } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { CONFIG, THEME_CLASS_NAMES, type Theme } from "@/lib/config";
import { api } from "@/lib/api-client";

type ThemeMode = "dark" | "light";
type ThemeModePreference = "dark" | "light" | "auto";
type ThemeStyle = Theme;
type NavigationMode = "top" | "side";
type TrainingMode = "simplified" | "detailed";

// Helper functions for user-specific localStorage keys
function getNavStateStorageKey(userId: string | null | undefined): string {
  if (!userId) {
    return "cultivation-nav-state";
  }
  return `cultivation-nav-state-${userId}`;
}

function getThemeStorageKey(userId: string | null | undefined): string {
  if (!userId) {
    return "cultivation-theme";
  }
  return `cultivation-theme-${userId}`;
}

function getThemeStyleStorageKey(userId: string | null | undefined): string {
  if (!userId) {
    return "cultivation-theme-style";
  }
  return `cultivation-theme-style-${userId}`;
}

function getThemeModeStorageKey(userId: string | null | undefined): string {
  if (!userId) {
    return "cultivation-theme-mode";
  }
  return `cultivation-theme-mode-${userId}`;
}

function resolveAppearance(mode: ThemeModePreference, style: ThemeStyle): ThemeMode {
  // Discord palette has no light variant — always dark.
  if (style === "discord") return "dark";
  if (mode === "auto") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    }
    return "dark";
  }
  return mode;
}

// Themes that have a paired light/dark counterpart. The user's selected style
// stays in state, but the style class actually applied to <html> swaps when
// the resolved appearance changes.
const THEME_STYLE_PAIRS: Partial<Record<ThemeStyle, { dark: ThemeStyle; light: ThemeStyle }>> = {
  "ying-yang": { dark: "ying-yang", light: "ying-yang-light" },
  "ying-yang-light": { dark: "ying-yang", light: "ying-yang-light" },
};

function resolveThemeStyleForMode(style: ThemeStyle, appearance: ThemeMode): ThemeStyle {
  const pair = THEME_STYLE_PAIRS[style];
  if (!pair) return style;
  return appearance === "light" ? pair.light : pair.dark;
}


interface AppState {
  navItems: NavItem[];
  dualPageView: boolean;
  panelPosition: "left" | "top";
  currentPage: string;
  collapsed: boolean;
  isMobile: boolean;
  theme: ThemeMode;
  themeMode: ThemeModePreference;
  themeStyle: ThemeStyle;
  navigationMode: NavigationMode;
  topPanelExpanded: boolean;
  trainingMode: TrainingMode;
  mobileSidebarOpen: boolean;
}

interface AppContextType extends AppState {
  setCurrentPage: (page: string) => void;
  toggleDualPage: () => void;
  toggleNavVisibility: (id: string) => void;
  toggleNavPin: (id: string) => void;
  reorderNavItems: (newOrder: NavItem[]) => void;
  setCollapsed: (collapsed: boolean) => void;
  getSortedNavItems: () => NavItem[];
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeModePreference) => void;
  setThemeStyle: (style: ThemeStyle) => void;
  setNavigationMode: (mode: NavigationMode) => void;
  setTopPanelExpanded: (expanded: boolean) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  registerDrawerClose: (closeFn: (() => void) | null) => void;
  activeDrawerClose: (() => void) | null;
}

const AppContext = createContext<AppContextType | null>(null);
const IsMobileContext = createContext(false);
const SortedNavItemsContext = createContext<NavItem[]>(defaultNavItems.filter((item) => item.visible));

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
  const [dualPageView, setDualPageView] = useState(false);
  const [panelPosition, setPanelPosition] = useState<"left" | "top">("left");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [themeMode, setThemeModeState] = useState<ThemeModePreference>("dark");
  const [themeStyle, setThemeStyleState] = useState<ThemeStyle>("discord");
  const [navigationMode, setNavigationModeState] = useState<NavigationMode>("side");
  const [topPanelExpanded, setTopPanelExpandedState] = useState(true);
  const [trainingMode, setTrainingModeState] = useState<TrainingMode>("simplified");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeDrawerClose, setActiveDrawerClose] = useState<(() => void) | null>(null);
  const [remotePrefsReady, setRemotePrefsReady] = useState(false);
  const syncedUserIdRef = useRef<string | null>(null);

  const registerDrawerClose = useCallback((closeFn: (() => void) | null) => {
    setActiveDrawerClose(() => closeFn);
  }, []);

  // Load saved state from localStorage when user changes
  /* eslint-disable react-hooks/set-state-in-effect -- hydration from localStorage on mount and user change */
  useEffect(() => {
    try {
      const navStateKey = getNavStateStorageKey(user?.id);
      const saved = localStorage.getItem(navStateKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.navItems && Array.isArray(parsed.navItems)) {
          // Merge saved nav items with defaults: preserve user customizations
          // (order, visibility, pinned) but always use paths/labels/icons from
          // defaultNavItems so corrections propagate to returning users.
          const defaultMap = new Map(defaultNavItems.map(item => [item.id, item]));
          const mergedItems: NavItem[] = parsed.navItems
            .filter((saved: NavItem) => defaultMap.has(saved.id))
            .map((saved: NavItem) => {
              const def = defaultMap.get(saved.id)!;
              return {
                ...def,
                // Preserve user-customisable fields only
                pinned: saved.pinned ?? def.pinned,
                visible: saved.visible ?? def.visible,
              };
            });
          // Append any new default items not present in saved state
          for (const def of defaultNavItems) {
            if (!mergedItems.find(m => m.id === def.id)) {
              mergedItems.push(def);
            }
          }
          setNavItems(mergedItems);
        }
        if (parsed.dualPageView !== undefined) setDualPageView(parsed.dualPageView);
        if (parsed.navigationMode) setNavigationModeState(parsed.navigationMode);
        if (parsed.collapsed !== undefined) setCollapsed(parsed.collapsed);
        if (parsed.trainingMode) setTrainingModeState(parsed.trainingMode);
      }
    } catch {
      // ignore parse errors
    }
  }, [user?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist nav/layout state to localStorage. Only writes when a user is
  // signed in AND the hydration effect has loaded *this* user's settings
  // (tracked via syncedUserIdRef). Without this guard, switching accounts
  // would write the previous user's state into the new user's storage key.
  const persistState = useCallback(() => {
    if (!user?.id) return;
    if (syncedUserIdRef.current !== user.id) return;

    const state = {
      navItems,
      dualPageView,
      navigationMode,
      collapsed,
      trainingMode,
    };
    localStorage.setItem(getNavStateStorageKey(user.id), JSON.stringify(state));
  }, [navItems, dualPageView, navigationMode, collapsed, trainingMode, user?.id]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(t);
      // Mirror to shared key (used by the layout inline script on first paint)
      localStorage.setItem("cultivation-theme", t);
      if (user?.id) {
        localStorage.setItem(getThemeStorageKey(user.id), t);
      }
    }
  }, [user?.id]);

  const setThemeMode = useCallback((mode: ThemeModePreference) => {
    const normalized: ThemeModePreference =
      mode === "light" || mode === "dark" || mode === "auto" ? mode : "dark";
    setThemeModeState(normalized);
    if (typeof window !== "undefined") {
      const resolved = resolveAppearance(normalized, themeStyle);
      setThemeState(resolved);
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      root.classList.add(resolved);
      const resolvedStyle = resolveThemeStyleForMode(themeStyle, resolved);
      root.classList.remove(...THEME_CLASS_NAMES);
      root.classList.add(resolvedStyle);
      root.setAttribute("data-theme", resolvedStyle);
      localStorage.setItem("cultivation-theme-mode", normalized);
      localStorage.setItem("cultivation-theme", resolved);
      if (user?.id) {
        localStorage.setItem(getThemeModeStorageKey(user.id), normalized);
        localStorage.setItem(getThemeStorageKey(user.id), resolved);
      }
    }
  }, [themeStyle, user?.id]);

  const toggleTheme = useCallback(() => {
    setThemeMode(theme === "dark" ? "light" : "dark");
  }, [theme, setThemeMode]);

  const setThemeStyle = useCallback((style: ThemeStyle) => {
    const normalizedStyle: ThemeStyle = (THEME_CLASS_NAMES as readonly string[]).includes(style)
      ? style
      : "discord";
    setThemeStyleState(normalizedStyle);
    if (typeof window !== "undefined") {
      const root = document.documentElement;
      // Resolve appearance for the new style (discord always dark; otherwise use mode pref).
      const resolved = resolveAppearance(themeMode, normalizedStyle);
      const resolvedStyle = resolveThemeStyleForMode(normalizedStyle, resolved);
      root.classList.remove(...THEME_CLASS_NAMES);
      root.classList.add(resolvedStyle);
      root.setAttribute("data-theme", resolvedStyle);
      setThemeState(resolved);
      root.classList.remove("dark", "light");
      root.classList.add(resolved);
      localStorage.setItem("cultivation-theme-style", normalizedStyle);
      localStorage.setItem("cultivation-theme", resolved);
      if (user?.id) {
        localStorage.setItem(getThemeStyleStorageKey(user.id), normalizedStyle);
        localStorage.setItem(getThemeStorageKey(user.id), resolved);
      }
    }
  }, [themeMode, user?.id]);

  // Load saved theme on mount and when user changes
  /* eslint-disable react-hooks/set-state-in-effect -- hydration from localStorage on mount and user change */
  useEffect(() => {
    const themeKey = getThemeStorageKey(user?.id);
    const saved = localStorage.getItem(themeKey) as ThemeMode | null;
    if (saved && (saved === "dark" || saved === "light")) {
      setTheme(saved);
    }
    const themeModeKey = getThemeModeStorageKey(user?.id);
    const savedMode = localStorage.getItem(themeModeKey) as ThemeModePreference | null;
    if (savedMode && (savedMode === "dark" || savedMode === "light" || savedMode === "auto")) {
      setThemeMode(savedMode);
    }
    const themeStyleKey = getThemeStyleStorageKey(user?.id);
    const savedStyle = localStorage.getItem(themeStyleKey) as ThemeStyle | null;
    if (savedStyle && (THEME_CLASS_NAMES as readonly string[]).includes(savedStyle)) {
      setThemeStyle(savedStyle);
    } else {
      setThemeStyle("discord");
    }
    // Layout selection removed: always use Layout 1 shell.
    localStorage.removeItem("cultivation-layout-style");
  }, [user?.id, setTheme, setThemeMode, setThemeStyle]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Re-resolve appearance when system color-scheme flips (only matters when mode === "auto")
  useEffect(() => {
    if (themeMode !== "auto") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => {
      const resolved = resolveAppearance("auto", themeStyle);
      setThemeState(resolved);
      const root = document.documentElement;
      root.classList.remove("dark", "light");
      root.classList.add(resolved);
      const resolvedStyle = resolveThemeStyleForMode(themeStyle, resolved);
      root.classList.remove(...THEME_CLASS_NAMES);
      root.classList.add(resolvedStyle);
      root.setAttribute("data-theme", resolvedStyle);
      localStorage.setItem("cultivation-theme", resolved);
      if (user?.id) {
        localStorage.setItem(getThemeStorageKey(user.id), resolved);
      }
    };
    mql.addEventListener?.("change", handler);
    return () => mql.removeEventListener?.("change", handler);
  }, [themeMode, themeStyle, user?.id]);

  // Hydrate shared theme preferences per user (desktop/web)
  useEffect(() => {
    let cancelled = false;

    const hydrateRemoteTheme = async () => {
      if (!user?.id) {
        syncedUserIdRef.current = null;
        setRemotePrefsReady(true);
        return;
      }

      setRemotePrefsReady(false);
      try {
        const payload = await api.get<{ appPrefs?: Record<string, unknown> }>("/api/users/preferences", { cache: "no-store" });
        const appPrefs = payload?.appPrefs && typeof payload.appPrefs === "object" ? payload.appPrefs : null;
        if (!appPrefs || cancelled) return;

        const remoteTheme = appPrefs.theme;
        const remoteThemeStyle = appPrefs.themeStyle;

        if (remoteTheme === "dark" || remoteTheme === "light") {
          setThemeState(remoteTheme);
          document.documentElement.classList.remove("dark", "light");
          document.documentElement.classList.add(remoteTheme);
          // Mirror to shared key for first-paint script
          localStorage.setItem("cultivation-theme", remoteTheme);
          if (user?.id) {
            localStorage.setItem(getThemeStorageKey(user.id), remoteTheme);
          }
        }

        if (typeof remoteThemeStyle === "string") {
          const normalizedStyle: ThemeStyle = (THEME_CLASS_NAMES as readonly string[]).includes(remoteThemeStyle)
            ? (remoteThemeStyle as ThemeStyle)
            : "discord";
          setThemeStyleState(normalizedStyle);
          const root = document.documentElement;
          root.classList.remove(...THEME_CLASS_NAMES);
          root.classList.add(normalizedStyle);
          root.setAttribute("data-theme", normalizedStyle);
          // Mirror to shared key for login page & first-paint script
          localStorage.setItem("cultivation-theme-style", normalizedStyle);
          if (user?.id) {
            localStorage.setItem(getThemeStyleStorageKey(user.id), normalizedStyle);
          }
        }
      } catch {
        // Ignore remote sync errors; local settings remain usable.
      } finally {
        if (!cancelled) {
          syncedUserIdRef.current = user.id;
          setRemotePrefsReady(true);
        }
      }
    };

    hydrateRemoteTheme();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Persist theme changes to shared per-user preferences.
  useEffect(() => {
    if (!remotePrefsReady || !user?.id || syncedUserIdRef.current !== user.id) return;

    const timer = window.setTimeout(() => {
      api.put("/api/users/preferences", {
        appPrefs: {
          theme,
          themeStyle,
        },
      }).catch(() => {
        // Ignore sync failures; local settings are still saved.
      });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [theme, themeStyle, remotePrefsReady, user?.id]);

  // Unified shell mode: the app now keeps the mobile-first structure on every screen size.
  // Screen width can still influence spacing through CSS, but it no longer swaps the UI architecture.
  useEffect(() => {
    const applyUnifiedShell = () => {
      setIsMobile(true);
      setCollapsed(true);
      setPanelPosition("top");
      setTopPanelExpandedState(false);
    };

    applyUnifiedShell();
    window.addEventListener("resize", applyUnifiedShell);
    return () => window.removeEventListener("resize", applyUnifiedShell);
  }, [navigationMode]);

  // Persist state changes
  useEffect(() => {
    persistState();
  }, [persistState]);

  const toggleDualPage = useCallback(() => {
    setDualPageView((v) => !v);
  }, []);

  const toggleNavVisibility = useCallback((id: string) => {
    setNavItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, visible: !item.visible } : item
      )
    );
  }, []);

  const toggleNavPin = useCallback((id: string) => {
    setNavItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );
  }, []);

  const reorderNavItems = useCallback((newOrder: NavItem[]) => {
    setNavItems(newOrder);
  }, []);

  const getSortedNavItems = useCallback(() => {
    const visible = navItems.filter((item) => item.visible);
    const pinned = visible.filter((item) => item.pinned);
    const unpinned = visible.filter((item) => !item.pinned);
    return [...pinned, ...unpinned];
  }, [navItems]);

  const sortedNavItems = useMemo(() => getSortedNavItems(), [getSortedNavItems]);

  const setNavigationMode = useCallback((mode: NavigationMode) => {
    setNavigationModeState(mode);
  }, []);

  const setTopPanelExpanded = useCallback((expanded: boolean) => {
    setTopPanelExpandedState(expanded);
  }, []);

  const setTrainingMode = useCallback((mode: TrainingMode) => {
    setTrainingModeState(mode);
  }, []);

  const appContextValue = useMemo<AppContextType>(() => ({
        navItems,
        dualPageView,
        panelPosition,
        currentPage,
        collapsed,
        isMobile,
        theme,
        themeMode,
        themeStyle,
        navigationMode,
        topPanelExpanded,
        trainingMode,
        setCurrentPage,
        toggleDualPage,
        toggleNavVisibility,
        toggleNavPin,
        reorderNavItems,
        setCollapsed,
        getSortedNavItems,
        setTheme,
        toggleTheme,
        setThemeMode,
        setThemeStyle,
        setNavigationMode,
        setTopPanelExpanded,
        setTrainingMode,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        registerDrawerClose,
        activeDrawerClose,
      }), [
        activeDrawerClose,
        collapsed,
        currentPage,
        dualPageView,
        getSortedNavItems,
        isMobile,
        mobileSidebarOpen,
        navItems,
        navigationMode,
        panelPosition,
        registerDrawerClose,
        reorderNavItems,
        setCollapsed,
        setCurrentPage,
        setMobileSidebarOpen,
        setNavigationMode,
        setTheme,
        setThemeMode,
        setThemeStyle,
        setTopPanelExpanded,
        setTrainingMode,
        theme,
        themeMode,
        themeStyle,
        toggleDualPage,
        toggleNavPin,
        toggleNavVisibility,
        toggleTheme,
        topPanelExpanded,
        trainingMode,
      ]);

  return (
    <IsMobileContext.Provider value={isMobile}>
      <SortedNavItemsContext.Provider value={sortedNavItems}>
        <AppContext.Provider value={appContextValue}>
          {children}
        </AppContext.Provider>
      </SortedNavItemsContext.Provider>
    </IsMobileContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}

export function useIsMobile() {
  return useContext(IsMobileContext);
}

export function useSortedNavItems() {
  return useContext(SortedNavItemsContext);
}
