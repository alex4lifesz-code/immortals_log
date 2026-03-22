"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter, usePathname } from "next/navigation";
import { memo, useCallback, useEffect } from "react";
import { t } from "@/lib/terminology";

function FloatingMobileSidebar() {
  const { getSortedNavItems, isMobile, viewportMode, mobileSidebarOpen, setMobileSidebarOpen } = useAppContext();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems().filter(item => item.id !== "admin" || isAdmin);

  // Auto-close sidebar whenever the route changes
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  const handleClose = useCallback(() => {
    setMobileSidebarOpen(false);
  }, [setMobileSidebarOpen]);

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
    setMobileSidebarOpen(false);
  }, [router, setMobileSidebarOpen]);

  const effectiveMobile = isMobile || viewportMode === "mobile";

  // Render in APK and in forced Mobile mode so preview matches app layout.
  if (!effectiveMobile) return null;

  return (
    <>
      {/* Backdrop — tap-to-dismiss */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={handleClose}
            className="fixed inset-0 bg-void-black/60 backdrop-blur-[2px] z-30"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Drawer */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 300, mass: 0.8 }}
            className="fixed left-0 top-0 z-40 h-screen flex flex-col bg-ink-deep/98 backdrop-blur-lg border-r border-jade-glow/10 shadow-2xl overflow-hidden"
            style={{ width: "min(80vw, 320px)" }}
          >
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-ink-light/50 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-sm text-jade-glow font-bold tracking-[0.15em] uppercase">
                  ⚔ Navigation
                </h2>
                {user && (
                  <p className="text-[11px] text-mist-light mt-0.5 truncate">{user.name}</p>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={handleClose}
                className="p-2 rounded-xl text-mist-dark active:text-cloud-white active:bg-white/10 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>
            </div>

            {/* Navigation Items — scrollable */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1 overscroll-contain">
              {items.map((item, index) => {
                const isActive = pathname === item.path;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.03, type: "spring", stiffness: 400, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm transition-colors min-h-[48px] ${
                      isActive
                        ? "bg-jade-deep/40 text-jade-light border border-jade/20 shadow-sm"
                        : "text-mist-light active:text-cloud-white active:bg-ink-mid/60 border border-transparent"
                    }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span className="text-lg flex-shrink-0 w-7 text-center">{item.icon}</span>
                    <span className="flex-1 text-left font-medium">{t(item.label, terminologyMode)}</span>
                    {item.pinned && <span className="text-[10px] text-gold-dim flex-shrink-0">📌</span>}
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-jade-glow rounded-full flex-shrink-0" />
                    )}
                  </motion.button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-ink-light/50 shrink-0">
              <p className="text-[10px] text-mist-dark text-center italic leading-relaxed">
                &quot;The path of cultivation is long, but every step brings you closer to the Dao.&quot;
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(FloatingMobileSidebar);
