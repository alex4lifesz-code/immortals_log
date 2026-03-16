"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { NavItem, defaultNavItems } from "@/lib/constants";
import { isNativePlatform } from "@/lib/platform";

type ThemeMode = "dark" | "light";
type ThemeStyle = "midnight-ink" | "mountain-mist" | "calligraphy" | "sakura" | "sakura-dark";
type NavigationMode = "top" | "side";
type ViewportMode = "auto" | "mobile" | "desktop";
type TrainingMode = "simplified" | "detailed";

interface AppState {
  navItems: NavItem[];
  dualPageView: boolean;
  panelPosition: "left" | "top";
  currentPage: string;
  collapsed: boolean;
  isMobile: boolean;
  /** True when running inside the Capacitor native APK, false in browsers */
  isNativeApp: boolean;
  theme: ThemeMode;
  themeStyle: ThemeStyle;
  navigationMode: NavigationMode;
  viewportMode: ViewportMode;
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
  setViewportMode: (mode: ViewportMode) => void;
  setTopPanelExpanded: (expanded: boolean) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  registerDrawerClose: (closeFn: (() => void) | null) => void;
  activeDrawerClose: (() => void) | null;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [navItems, setNavItems] = useState<NavItem[]>(defaultNavItems);
  const [dualPageView, setDualPageView] = useState(false);
  const [panelPosition, setPanelPosition] = useState<"left" | "top">("left");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isNativeApp] = useState(() => typeof window !== "undefined" ? isNativePlatform() : false);
  const [theme, setThemeState] = useState<ThemeMode>("dark");
  const [themeStyle, setThemeStyleState] = useState<ThemeStyle>("midnight-ink");
  const [navigationMode, setNavigationModeState] = useState<NavigationMode>("side");
  const [viewportMode, setViewportModeState] = useState<ViewportMode>("auto");
  const [topPanelExpanded, setTopPanelExpandedState] = useState(true);
  const [trainingMode, setTrainingModeState] = useState<TrainingMode>("simplified");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [activeDrawerClose, setActiveDrawerClose] = useState<(() => void) | null>(null);

  const registerDrawerClose = useCallback((closeFn: (() => void) | null) => {
    setActiveDrawerClose(() => closeFn);
  }, []);

  // Detect native vs browser platform on mount — already handled via lazy initializer above

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
        if (parsed.viewportMode) setViewportModeState(parsed.viewportMode);
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
      viewportMode,
      collapsed,
      trainingMode,
    };
    localStorage.setItem("cultivation-nav-state", JSON.stringify(state));
  }, [navItems, dualPageView, navigationMode, viewportMode, collapsed, trainingMode]);

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
      document.documentElement.classList.remove("midnight-ink", "mountain-mist", "calligraphy", "sakura", "sakura-dark");
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
    if (savedStyle && ["midnight-ink", "mountain-mist", "calligraphy", "sakura", "sakura-dark"].includes(savedStyle)) {
      setThemeStyle(savedStyle);
    }
  }, [setTheme, setThemeStyle]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Handle responsive layout changes (fixes bidirectional bug)
  // Explicit viewport overrides are honoured on all platforms (browser + native).
  // In auto mode, browsers default to desktop; native APK responds to screen size.
  useEffect(() => {
    const checkSize = () => {
      const windowWidth = window.innerWidth;
      const actualIsMobileNow = windowWidth < 768;

      // ---------- EXPLICIT VIEWPORT OVERRIDES (any platform) ----------
      if (viewportMode === "mobile") {
        setIsMobile(true);
        setCollapsed(true);
        setPanelPosition("top");
        setTopPanelExpandedState(false);
        return;
      }

      if (viewportMode === "desktop") {
        setIsMobile(false);
        setCollapsed(false);
        if (navigationMode === "side") {
          setPanelPosition("left");
        } else {
          setPanelPosition("top");
        }
        setTopPanelExpandedState(true);
        return;
      }

      // ---------- AUTO MODE: browser defaults to desktop ----------
      if (!isNativeApp) {
        setIsMobile(false);
        setCollapsed(false);
        if (navigationMode === "side") {
          setPanelPosition("left");
        } else {
          setPanelPosition("top");
        }
        setTopPanelExpandedState(true);
        return;
      }

      // ---------- AUTO MODE: native APK responds to screen size ----------
      setIsMobile(actualIsMobileNow);

      if (actualIsMobileNow) {
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
  }, [viewportMode, navigationMode, isNativeApp]);

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

  const setNavigationMode = useCallback((mode: NavigationMode) => {
    setNavigationModeState(mode);
  }, []);

  const setViewportMode = useCallback((mode: ViewportMode) => {
    setViewportModeState(mode);
  }, []);

  const setTopPanelExpanded = useCallback((expanded: boolean) => {
    setTopPanelExpandedState(expanded);
  }, []);

  const setTrainingMode = useCallback((mode: TrainingMode) => {
    setTrainingModeState(mode);
  }, []);

  return (
    <AppContext.Provider
      value={{
        navItems,
        dualPageView,
        panelPosition,
        currentPage,
        collapsed,
        isMobile,
        isNativeApp,
        theme,
        themeStyle,
        navigationMode,
        viewportMode,
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
        setViewportMode,
        setTopPanelExpanded,
        setTrainingMode,
        mobileSidebarOpen,
        setMobileSidebarOpen,
        registerDrawerClose,
        activeDrawerClose,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
