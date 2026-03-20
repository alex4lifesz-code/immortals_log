"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ReactNode, useState, useEffect, useCallback, useRef, memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";

interface PageLayoutProps {
  children: ReactNode;
  sidebar?: ReactNode;
  title: string;
  subtitle?: string;
  sidebarLabel?: string;
}

function PageLayout({
  children,
  sidebar,
  title,
  subtitle,
  sidebarLabel,
}: PageLayoutProps) {
  const { panelPosition, isMobile, isNativeApp, viewportMode, mobileSidebarOpen, setMobileSidebarOpen, topPanelExpanded, setTopPanelExpanded } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const { user } = useAuth();
  const effectivePosition = isMobile ? "top" : panelPosition;
  const mobileMode = isMobile && (isNativeApp || viewportMode === "mobile");
  const [mobileQuickViewOpen, setMobileQuickViewOpen] = useState(false);
  const sidebarPosition = settings.sidebarPosition || "left";
  const sidebarWidth = settings.sidebarWidth || 320;

  // Resize state
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const MIN_SIDEBAR_WIDTH = 200;
  const MAX_SIDEBAR_WIDTH_RATIO = 0.4;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: sidebarWidth };
    setIsResizing(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      const maxWidth = window.innerWidth * MAX_SIDEBAR_WIDTH_RATIO;
      const delta = sidebarPosition === "left"
        ? e.clientX - resizeRef.current.startX
        : resizeRef.current.startX - e.clientX;
      const newWidth = Math.max(MIN_SIDEBAR_WIDTH, Math.min(maxWidth, resizeRef.current.startWidth + delta));
      updateSettings({ sidebarWidth: Math.round(newWidth) });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, sidebarPosition, updateSettings]);

  // Close mobile panels on escape
  useEffect(() => {
    if (!mobileSidebarOpen && !mobileQuickViewOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileSidebarOpen(false);
        setMobileQuickViewOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileSidebarOpen, mobileQuickViewOpen, setMobileSidebarOpen]);

  // Lock body scroll when mobile panels open
  useEffect(() => {
    if (mobileSidebarOpen || mobileQuickViewOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileSidebarOpen, mobileQuickViewOpen]);

  // Mutual exclusion: close QuickView when sidebar opens
  useEffect(() => {
    if (mobileSidebarOpen && mobileQuickViewOpen) {
      setMobileQuickViewOpen(false);
    }
  }, [mobileSidebarOpen, mobileQuickViewOpen]);

  // Close sidebars when switching away from mobile
  useEffect(() => {
    if (!isMobile) {
      setMobileSidebarOpen(false);
      setMobileQuickViewOpen(false);
    }
  }, [isMobile, setMobileSidebarOpen]);

  // Resize handle element
  const resizeHandle = sidebar && !isMobile && effectivePosition !== "top" ? (
    <div
      onMouseDown={handleResizeStart}
      className={`w-1 shrink-0 cursor-col-resize group relative transition-colors duration-200 ${
        isResizing ? "bg-jade-glow/40" : "bg-transparent hover:bg-jade-glow/20"
      }`}
      title="Drag to resize"
    >
      <div className={`absolute inset-y-0 ${sidebarPosition === "left" ? "-right-0.5 left-0" : "right-0 -left-0.5"} w-2`} />
      <div className="absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-60 transition-opacity">
        <div className="w-0.5 h-0.5 rounded-full bg-mist-dark" />
        <div className="w-0.5 h-0.5 rounded-full bg-mist-dark" />
        <div className="w-0.5 h-0.5 rounded-full bg-mist-dark" />
      </div>
    </div>
  ) : null;

  // Desktop sidebar element
  const desktopSidebar = sidebar && !isMobile && effectivePosition !== "top" ? (
    <motion.div
      layout
      className="border-ink-light bg-ink-deep/50 shrink-0 overflow-hidden flex flex-col"
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
      <div className="flex-1 min-h-0 px-1.5 overflow-y-auto scrollbar-hide">
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
      className={`flex ${effectivePosition === "top" || isMobile ? "flex-col" : "flex-row"} h-full relative`}
      style={isResizing ? { userSelect: "none" } : undefined}
    >
      {/* Desktop sidebar — left position */}
      {sidebarPosition === "left" && desktopSidebar}
      {sidebarPosition === "left" && resizeHandle}

      {/* Main Content — full width on mobile */}
      <div className={`flex-1 overflow-y-auto ${isMobile ? "p-4 pb-24" : "p-6"}`}>
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          {subtitle && (
            <p className="text-xs text-mist-dark mb-4 italic">{subtitle}</p>
          )}
          {children}
        </motion.div>
      </div>

      {/* Desktop sidebar — right position */}
      {sidebarPosition === "right" && resizeHandle}
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
              transition={{ duration: 0.25 }}
              className="fixed inset-0 z-40 bg-void-black/60 backdrop-blur-[2px]"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              key="page-sidebar-panel"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300, mass: 0.8 }}
              className="fixed inset-y-0 left-0 z-50 bg-ink-deep/98 backdrop-blur-lg border-r border-jade-glow/10 flex flex-col shadow-2xl"
              style={{ width: "min(85vw, 340px)" }}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-ink-light/50 shrink-0">
                <h2 className="text-sm text-jade-glow font-semibold uppercase tracking-[0.12em]">
                  {sidebarLabel || title}
                </h2>
                <button
                  onClick={() => setMobileSidebarOpen(false)}
                  className="p-2 rounded-xl text-mist-dark active:text-cloud-white active:bg-white/10 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
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
