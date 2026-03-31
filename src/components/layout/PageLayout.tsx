"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ReactNode, useState, useEffect, useRef, memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";

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
  const { panelPosition, isMobile, mobileSidebarOpen, setMobileSidebarOpen, themeStyle } = useAppContext();
  const prefersReducedMotion = useReducedMotion();
  const disableMotion = themeStyle === "eternal" || themeStyle === "discord" || prefersReducedMotion;
  const effectivePosition = isMobile ? "top" : panelPosition;
  const mobileMode = isMobile;
  const mobileSidebarHistoryArmedRef = useRef(false);
  const sidebarTouchStartXRef = useRef<number | null>(null);
  const sidebarTouchCurrentXRef = useRef<number | null>(null);
  const sidebarWidth = DISPLAY_DEFAULTS.sidebarWidth;

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
      layout={!disableMotion}
      className="sticky top-0 self-start h-full border-r border-l-0 border-ink-light/50 surface-panel surface-panel-strong shrink-0 overflow-hidden flex flex-col"
      style={{
        width: `${sidebarWidth}px`,
        minWidth: `${MIN_SIDEBAR_WIDTH}px`,
      }}
    >
      <div className="px-5 pt-4 pb-2.5 shrink-0 flex items-center justify-between">
        <h2 className="text-xs text-jade-glow uppercase tracking-widest font-semibold">{title}</h2>
      </div>
      <div className="flex-1 min-h-0 px-1.5 overflow-y-auto sidebar-scroll overscroll-contain">
        {sidebar}
      </div>
      <div className="h-2 shrink-0" />
    </motion.div>
  ) : sidebar && !isMobile && effectivePosition === "top" ? (
    <motion.div
      layout={!disableMotion}
      className="w-full border-b border-ink-light surface-panel surface-panel-strong shrink-0 overflow-hidden flex flex-col max-h-[40vh]"
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
      initial={disableMotion ? false : { opacity: 0 }}
      animate={disableMotion ? { opacity: 1 } : { opacity: 1 }}
      transition={{ duration: disableMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
      className={`flex ${effectivePosition === "top" || isMobile ? "flex-col" : "flex-row"} relative ${isMobile ? "min-h-full" : "h-full overflow-hidden"}`}
    >
      {/* Desktop sidebar */}
      {desktopSidebar}

      {/* Main Content — full width on mobile */}
      <div
        data-mobile-scroll-container={isMobile ? "true" : undefined}
        className={`flex-1 min-w-0 overflow-y-auto overflow-x-auto ${isMobile ? `${mobileContentPaddingClass} scrollbar-hide` : "h-full overscroll-contain [scrollbar-gutter:stable] p-2"}`}
      >
        <motion.div
          initial={disableMotion ? false : { opacity: 0 }}
          animate={disableMotion ? { opacity: 1 } : { opacity: 1 }}
          transition={{ delay: disableMotion ? 0 : 0.04, duration: disableMotion ? 0 : 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="page-rise"
        >
          <div className={`${contentContainerClass} ${isMobile ? "" : "rounded-2xl"}`}>
            {subtitle && (
              <p className="text-xs text-mist-dark mb-4 italic">{subtitle}</p>
            )}
            {children}
          </div>
        </motion.div>
      </div>


      {/* ── Mobile slide-in sidebar (page panel) — native APK only ── */}
      <AnimatePresence>
        {mobileSidebarOpen && mobileMode && sidebar && (
          <>
            <motion.div
              key="page-sidebar-backdrop"
              initial={disableMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={disableMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: disableMotion ? 0 : 0.18 }}
              className="fixed inset-0 z-40 bg-void-black/60 backdrop-blur-[2px]"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              key="page-sidebar-panel"
              initial={disableMotion ? false : { x: "-100%" }}
              animate={disableMotion ? { x: 0 } : { x: 0 }}
              exit={disableMotion ? { x: 0 } : { x: "-100%" }}
              drag="x"
              dragDirectionLock
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.06, right: 0 }}
              onDragEnd={(_event, info) => {
                if (info.offset.x < -70 || info.velocity.x < -380) {
                  setMobileSidebarOpen(false);
                }
              }}
              transition={disableMotion ? { duration: 0 } : { type: "spring", damping: 31, stiffness: 360, mass: 0.72 }}
              className="fixed inset-y-0 left-0 z-50 surface-panel surface-panel-strong border-r border-jade-glow/15 flex flex-col shadow-2xl touch-pan-y pt-[max(env(safe-area-inset-top,0px),12px)]"
              style={{ width: "min(88vw, 380px)" }}
              onTouchStart={onSidebarTouchStart}
              onTouchMove={onSidebarTouchMove}
              onTouchEnd={onSidebarTouchEnd}
            >
              <div className="flex items-center justify-between px-5 pb-4 border-b border-ink-light/50 shrink-0">
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
