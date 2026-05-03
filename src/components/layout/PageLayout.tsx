"use client";

import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ReactNode, useEffect, useRef, memo } from "react";
import { useAppContext } from "@/context/AppContext";

interface PageLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  title: string;
  subtitle?: string;
  sidebarLabel?: string;
  contentWidth?: "centered" | "fluid";
  contentMaxWidthClass?: string;
  mobileContentPaddingClass?: string;
  mobileScrollContainerEnabled?: boolean;
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
  mobileScrollContainerEnabled = true,
}: PageLayoutProps) {
  const { isMobile, mobileSidebarOpen, setMobileSidebarOpen, themeStyle } = useAppContext();
  const prefersReducedMotion = useReducedMotion();
  const disableMotion = themeStyle === "discord" || prefersReducedMotion;
  const mobileSidebarHistoryArmedRef = useRef(false);
  const sidebarTouchStartXRef = useRef<number | null>(null);
  const sidebarTouchCurrentXRef = useRef<number | null>(null);

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


  return (
    <div
      className={mobileScrollContainerEnabled ? "relative flex h-full flex-col" : "relative flex h-full flex-col"}
      style={{ background: "var(--page-gutter-bg)" }}
    >
      {mobileScrollContainerEnabled ? (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          <div
            data-mobile-scroll-container="true"
            className={`flex-1 min-h-0 min-w-0 overflow-y-auto scrollbar-hide ${mobileContentPaddingClass} overflow-x-hidden`}
          >
            <div className="page-rise">
              <div className={contentContainerClass}>
                {children}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          <div
            className={`flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden ${mobileContentPaddingClass} overflow-x-hidden`}
          >
            {children}
          </div>
        </div>
      )}


      {/* ── Mobile slide-in sidebar (page panel) — native APK only ── */}
      <AnimatePresence>
        {mobileSidebarOpen && sidebar && (
          <>
            <motion.div
              key="page-sidebar-backdrop"
              initial={disableMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={disableMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={{ duration: disableMotion ? 0 : 0.18 }}
              className="fixed inset-0 z-40 bg-void-black/70"
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
              className="fixed inset-y-0 left-0 z-50 surface-panel surface-panel-strong flex flex-col shadow-2xl touch-pan-y pt-[max(env(safe-area-inset-top,0px),12px)] pb-[max(env(safe-area-inset-bottom,0px),10px)]"
              style={{
                width: "min(88vw, 380px)",
                borderRightWidth: 0,
                background: "var(--sidebar-canvas-bg)",
              }}
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

    </div>
  );
}

export default memo(PageLayout);
