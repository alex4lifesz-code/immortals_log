"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { NavItem, defaultNavItems } from "@/lib/constants";
import { useAuth } from "@/context/AuthContext";
import { CONFIG, type Theme } from "@/lib/config";
import { api } from "@/lib/api-client";

type ThemeMode = "dark" | "light";
type ThemeStyle = Theme;
type NavigationMode = "top" | "side";
type TrainingMode = "simplified" | "detailed";

interface AppState {
  navItems: NavItem[];
  dualPageView: boolean;
  panelPosition: "left" | "top";
  currentPage: string;
  collapsed: boolean;
  isMobile: boolean;
  theme: ThemeMode;
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
  const [themeStyle, setThemeStyleState] = useState<ThemeStyle>("midnight-ink");
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

  // Load saved state from localStorage
  /* eslint-disable react-hooks/set-state-in-effect -- hydration from localStorage on mount */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivation-nav-state");
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
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Persist state to localStorage
  const persistState = useCallback(() => {
    const state = {
      navItems,
      dualPageView,
      navigationMode,
      collapsed,
      trainingMode,
    };
    localStorage.setItem("cultivation-nav-state", JSON.stringify(state));
  }, [navItems, dualPageView, navigationMode, collapsed, trainingMode]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove("dark", "light");
      document.documentElement.classList.add(t);
      localStorage.setItem("cultivation-theme", t);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const setThemeStyle = useCallback((style: ThemeStyle) => {
    setThemeStyleState(style);
    if (typeof window !== "undefined") {
      document.documentElement.classList.remove(...CONFIG.themes);
      document.documentElement.classList.add(style);
      localStorage.setItem("cultivation-theme-style", style);
    }
  }, []);

  // Load saved theme on mount
  /* eslint-disable react-hooks/set-state-in-effect -- hydration from localStorage on mount */
  useEffect(() => {
    const saved = localStorage.getItem("cultivation-theme") as ThemeMode | null;
    if (saved && (saved === "dark" || saved === "light")) {
      setTheme(saved);
    }
    const savedStyle = localStorage.getItem("cultivation-theme-style") as ThemeStyle | null;
    if (savedStyle && (CONFIG.themes as readonly string[]).includes(savedStyle)) {
      setThemeStyle(savedStyle);
    }
    // Layout selection removed: always use Layout 1 shell.
    localStorage.removeItem("cultivation-layout-style");
  }, [setTheme, setThemeStyle]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Hydrate shared theme preferences per user (desktop/web + APK)
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
          localStorage.setItem("cultivation-theme", remoteTheme);
        }

        if (typeof remoteThemeStyle === "string" && (CONFIG.themes as readonly string[]).includes(remoteThemeStyle)) {
          setThemeStyleState(remoteThemeStyle as ThemeStyle);
          document.documentElement.classList.remove(...CONFIG.themes);
          document.documentElement.classList.add(remoteThemeStyle);
          localStorage.setItem("cultivation-theme-style", remoteThemeStyle);
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

  // Handle responsive layout changes using automatic width-based behavior.
  useEffect(() => {
    const checkSize = () => {
      const mobileNow = window.innerWidth < 768;
      setIsMobile(mobileNow);

      if (mobileNow) {
        setCollapsed(true);
        setPanelPosition("top");
        setTopPanelExpandedState(false);
      } else {
        setCollapsed(false);
        setTopPanelExpandedState(true);
        if (navigationMode === "side") {
          setPanelPosition("left");
        } else {
          setPanelPosition("top");
        }
      }
    };
    
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
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
        setThemeStyle,
        setTopPanelExpanded,
        setTrainingMode,
        theme,
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
