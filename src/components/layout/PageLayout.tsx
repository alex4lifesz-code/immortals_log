"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState, useEffect, useRef, memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";

interface PageLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  title: string;
  subtitle?: string;
  sidebarLabel?: string;
  contentWidth?: "centered" | "fluid";
  contentMaxWidthClass?: string;
  mobileContentPaddingClass?: string;
}

function PageLayout({
  children,
  sidebar,
  title,
  subtitle,
  sidebarLabel,
  contentWidth = "centered",
  contentMaxWidthClass = "max-w-[1400px]",
  mobileContentPaddingClass = "p-4 pb-24",
}: PageLayoutProps) {
  const { panelPosition, isMobile, isNativeApp, mobileSidebarOpen, setMobileSidebarOpen } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const effectivePosition = isMobile ? "top" : panelPosition;
  const mobileMode = isMobile;
  const mobileSidebarHistoryArmedRef = useRef(false);
  const sidebarTouchStartXRef = useRef<number | null>(null);
  const sidebarTouchCurrentXRef = useRef<number | null>(null);
  const sidebarPosition = settings.sidebarPosition || "left";
  const sidebarWidth = settings.sidebarWidth || 320;

  const MIN_SIDEBAR_WIDTH = 200;
  const contentContainerClass = contentWidth === "centered"
    ? `mx-auto w-full ${contentMaxWidthClass}`
    : "w-full";

  // Close mobile panels on escape
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  // Lock body scroll when mobile panels open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileSidebarOpen]);

  // Arm history while mobile drawers are open so Android back closes drawer first.
  useEffect(() => {
    if (!mobileSidebarOpen) {
      mobileSidebarHistoryArmedRef.current = false;
      return;
    }
    if (mobileSidebarHistoryArmedRef.current) return;

    try {
      window.history.pushState({ mobileDrawer: true, at: Date.now() }, "", window.location.href);
      mobileSidebarHistoryArmedRef.current = true;
    } catch {
      // Ignore history errors.
    }
  }, [mobileSidebarOpen]);

  // Browser back should close mobile drawers before navigation.
  useEffect(() => {
    const onPopState = () => {
      if (!mobileSidebarOpen) return;
      setMobileSidebarOpen(false);
      mobileSidebarHistoryArmedRef.current = false;
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  // Capacitor Android hardware back fallback for closing mobile drawers.
  useEffect(() => {
    const onBackButton = (event: Event) => {
      if (!mobileSidebarOpen) return;
      if (typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
        (event as { preventDefault: () => void }).preventDefault();
      }
      setMobileSidebarOpen(false);
      mobileSidebarHistoryArmedRef.current = false;
    };

    document.addEventListener("backbutton", onBackButton as EventListener);
    return () => document.removeEventListener("backbutton", onBackButton as EventListener);
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  // Capacitor native Android back-button (reliable in APK webview).
  useEffect(() => {
    let handle: { remove: () => Promise<void> } | null = null;
    let cancelled = false;

    const register = async () => {
      try {
        const mod = await import("@capacitor/app");
        if (cancelled) return;
        const result = await mod.App.addListener("backButton", () => {
          if (!mobileSidebarOpen) return;
          setMobileSidebarOpen(false);
          mobileSidebarHistoryArmedRef.current = false;
        });
        if (cancelled) {
          void result.remove();
          return;
        }
        handle = result;
      } catch {
        // Capacitor App plugin unavailable outside native runtime.
      }
    };

    void register();

    return () => {
      cancelled = true;
      if (!handle) return;
      void handle.remove();
    };
  }, [mobileSidebarOpen, setMobileSidebarOpen]);

  const onSidebarTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    sidebarTouchStartXRef.current = event.touches[0]?.clientX ?? null;
    sidebarTouchCurrentXRef.current = sidebarTouchStartXRef.current;
  };

  const onSidebarTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    sidebarTouchCurrentXRef.current = event.touches[0]?.clientX ?? null;
  };

  const onSidebarTouchEnd = () => {
    const start = sidebarTouchStartXRef.current;
    const end = sidebarTouchCurrentXRef.current;
    sidebarTouchStartXRef.current = null;
    sidebarTouchCurrentXRef.current = null;
    if (start == null || end == null) return;
    const deltaX = end - start;
    if (deltaX < -48) {
      setMobileSidebarOpen(false);
      mobileSidebarHistoryArmedRef.current = false;
    }
  };

  // Close sidebars when switching away from mobile
  useEffect(() => {
    if (!isMobile) {
      const timer = window.setTimeout(() => {
        setMobileSidebarOpen(false);
      }, 0);
      return () => window.clearTimeout(timer);
    }
  }, [isMobile, setMobileSidebarOpen]);

  // Desktop sidebar element
  const desktopSidebar = sidebar && !isMobile && effectivePosition !== "top" ? (
    <motion.div
      layout
      className="sticky top-0 self-start h-full border-ink-light bg-ink-deep/50 shrink-0 overflow-hidden flex flex-col"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${MIN_SIDEBAR_WIDTH}px`,
        borderRight: sidebarPosition === "left" ? "1px solid" : "none",
        borderLeft: sidebarPosition === "right" ? "1px solid" : "none",
        borderColor: "rgba(55,65,81,0.5)",
      }}
    >
      <div className="px-5 pt-4 pb-2.5 shrink-0 flex items-center justify-between">
        <h2 className="text-xs text-jade-glow uppercase tracking-widest font-semibold">{title}</h2>
        <button
          onClick={() => updateSettings({ sidebarPosition: sidebarPosition === "left" ? "right" : "left" })}
          className="p-1 rounded-md border border-ink-light/50 text-mist-dark hover:text-jade-glow hover:border-jade-glow/40 hover:bg-jade-deep/20 transition-all duration-200"
          title={`Move panel to ${sidebarPosition === "left" ? "right" : "left"}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarPosition === "left" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 4h7v16h-7V4zM3 4h8v8H3V4z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h7v16H3V4zm10 0h8v8h-8V4z" />
            )}
          </svg>
        </button>
      </div>
      <div className="flex-1 min-h-0 px-1.5 overflow-y-auto sidebar-scroll overscroll-contain">
        {sidebar}
      </div>
      <div className="h-2 shrink-0" />
    </motion.div>
  ) : sidebar && !isMobile && effectivePosition === "top" ? (
    <motion.div
      layout
      className="w-full border-b border-ink-light bg-ink-deep/50 shrink-0 overflow-hidden flex flex-col max-h-[40vh]"
    >
      <div className="px-5 pt-4 pb-2.5 shrink-0 flex items-center justify-between">
        <h2 className="text-xs text-jade-glow uppercase tracking-widest font-semibold">{title}</h2>
      </div>
      <div className="flex-1 min-h-0 px-1.5 overflow-y-auto scrollbar-hide">
        {sidebar}
      </div>
      <div className="h-2 shrink-0" />
    </motion.div>
  ) : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`flex ${effectivePosition === "top" || isMobile ? "flex-col" : "flex-row"} relative ${isMobile ? "min-h-full" : "h-full overflow-hidden"}`}
    >
      {/* Desktop sidebar — left position */}
      {sidebarPosition === "left" && desktopSidebar}

      {/* Main Content — full width on mobile */}
      <div
        data-mobile-scroll-container={isMobile ? "true" : undefined}
        className={`flex-1 min-w-0 overflow-y-auto overflow-x-auto ${isMobile ? `${mobileContentPaddingClass} scrollbar-hide` : "h-full overscroll-contain [scrollbar-gutter:stable] p-2"}`}
      >
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className={contentContainerClass}>
            {subtitle && (
              <p className="text-xs text-mist-dark mb-4 italic">{subtitle}</p>
            )}
            {children}
          </div>
        </motion.div>
      </div>

      {/* Desktop sidebar — right position */}
      {sidebarPosition === "right" && desktopSidebar}

      {/* ── Mobile slide-in sidebar (page panel) — native APK only ── */}
      <AnimatePresence>
        {mobileSidebarOpen && mobileMode && sidebar && (
          <>
            <motion.div
              key="page-sidebar-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-void-black/60 backdrop-blur-[2px]"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              key="page-sidebar-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.06, right: 0 }}
              onDragEnd={(_event, info) => {
                if (info.offset.x < -70 || info.velocity.x < -380) {
                  setMobileSidebarOpen(false);
                }
              }}
              transition={{ type: "spring", damping: 31, stiffness: 360, mass: 0.72 }}
              className="fixed inset-y-0 left-0 z-50 bg-ink-deep/98 border-r border-jade-glow/15 flex flex-col shadow-2xl touch-pan-y"
              style={{ width: "min(88vw, 380px)" }}
              onTouchStart={onSidebarTouchStart}
              onTouchMove={onSidebarTouchMove}
              onTouchEnd={onSidebarTouchEnd}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink-light/50 shrink-0">
                <h2 className="text-base text-jade-glow font-semibold uppercase tracking-[0.1em]">
                  {sidebarLabel || title}
                </h2>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 rounded-xl text-mist-dark active:text-cloud-white active:bg-white/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 sidebar-scroll overscroll-contain">
                {sidebar}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

    </motion.div>
  );
}

export default memo(PageLayout);
