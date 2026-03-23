"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useState, memo, useCallback, useMemo, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

const NAV_ICON_MAP: Record<string, ReactNode> = {
  "/dashboard": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  ),
  "/dashboard/workout": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
};

function BottomBar() {
  const { getSortedNavItems, isMobile, viewportMode, setMobileSidebarOpen, mobileSidebarOpen, activeDrawerClose } = useAppContext();
  const { logout, user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems().filter(item => (item.id !== "admin" || isAdmin));
  const [menuOpen, setMenuOpen] = useState(false);

  const effectiveMobile = isMobile || viewportMode === "mobile";

  const primaryItems = useMemo(() => [
    items.find(i => i.path === "/dashboard"),
    items.find(i => i.path === "/dashboard/workout"),
    items.find(i => i.path === "/dashboard/checkin"),
  ].filter(Boolean) as typeof items, [items]);

  const moreItems = useMemo(
    () => items.filter(i => !primaryItems.find(p => p.id === i.id)),
    [items, primaryItems]
  );

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
    setMenuOpen(false);
    setMobileSidebarOpen(false);
  }, [router, setMobileSidebarOpen]);

  const handleFABPress = useCallback(() => {
    if (activeDrawerClose) {
      activeDrawerClose();
      return;
    }
    setMobileSidebarOpen(!mobileSidebarOpen);
  }, [setMobileSidebarOpen, mobileSidebarOpen, activeDrawerClose]);

  const handleMenuToggle = useCallback(() => {
    setMenuOpen(prev => !prev);
  }, []);

  // Show the APK-style bottom nav whenever mobile viewport is active,
  // including manual "Mobile mode" on web.
  if (!effectiveMobile) return null;

  // Build nav button order: [item0, item1, FAB, item2, More]
  return (
    <>
      {/* Overlay for expanded menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-void-black/60 z-40 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 z-50">
        {/* Expanded menu drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="bg-ink-deep/95 backdrop-blur-lg border-t border-jade-deep/30 rounded-t-2xl mx-3 p-2 mb-0"
            >
              <div className="flex items-center justify-between mb-1 px-3 pt-1">
                <span className="text-[10px] uppercase tracking-[0.15em] text-mist-dark font-semibold">Navigation</span>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="p-1.5 rounded-lg text-mist-dark active:text-cloud-white active:bg-white/10 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-1.5 px-1" role="menu" aria-label="Navigation menu">
                {user && (
                  <div className="col-span-2 rounded-xl border border-jade-glow/20 bg-ink-mid/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-mist-dark mb-0.5">Body Profile</p>
                    <UserPhysiqueButton
                      userId={user.id}
                      userName="Update Weight & Gender"
                      className="text-[13px] font-semibold text-jade-light hover:text-jade-glow transition-colors"
                    />
                  </div>
                )}
                {moreItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                    role="menuitem"
                    className={`flex items-center gap-2.5 px-3 py-3 rounded-xl transition-colors min-h-[48px] ${
                      pathname === item.path
                        ? "text-jade-light bg-jade-deep/30 border border-jade/20"
                        : "text-mist-light active:text-jade-light active:bg-ink-mid/60 border border-transparent"
                    }`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <span className="text-base flex-shrink-0">{item.icon}</span>
                    <span className="text-[13px] font-medium truncate">{t(item.label, terminologyMode)}</span>
                  </motion.button>
                ))}
                <motion.button
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: moreItems.length * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  role="menuitem"
                  className="flex items-center gap-2.5 px-3 py-3 rounded-xl transition-colors min-h-[48px] text-crimson-light/70 active:text-crimson-light active:bg-crimson-deep/20 border border-transparent col-span-2"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  <span className="text-base flex-shrink-0">🚪</span>
                  <span className="text-[13px] font-medium">Logout</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Bottom Navigation Bar ── */}
        <nav
          className="relative bg-ink-deep/95 backdrop-blur-lg border-t border-jade-glow/8 flex items-end justify-around px-1 pb-1 safe-area-bottom"
          style={{
            borderRadius: '20px 20px 0 0',
            boxShadow: '0 -2px 20px rgba(0,0,0,0.4)',
          }}
        >
          {/* Glow accent line */}
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 15%, transparent), transparent)` }} />

          {/* Left nav items */}
          {primaryItems.slice(0, 2).map((item) => {
            const isActive = pathname === item.path;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.9 }}
                aria-current={isActive ? "page" : undefined}
                onClick={() => { router.push(item.path); setMobileSidebarOpen(false); setMenuOpen(false); }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[56px] pt-2 pb-1 rounded-2xl transition-colors ${
                  isActive ? "text-[var(--accent)]" : "text-mist-mid active:text-mist-light"
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                  {NAV_ICON_MAP[item.path] || <span className="text-lg">{item.icon}</span>}
                </div>
                <span className={`text-[10px] font-medium tracking-wide ${isActive ? "text-[var(--accent)]" : ""}`}>
                  {t(item.label, terminologyMode).split(" ")[0]}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomBarActiveTab"
                    className="absolute -bottom-0.5 w-6 h-[3px] rounded-full"
                    style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)' }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}

          {/* ── Centre FAB — Side Panel Toggle / Drawer Close ── */}
          <div className="relative flex flex-col items-center -mt-4 z-10">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={handleFABPress}
              aria-label={activeDrawerClose ? "Close drawer" : mobileSidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileSidebarOpen || undefined}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-colors ${
                activeDrawerClose
                  ? "bg-crimson-glow/90"
                  : mobileSidebarOpen
                    ? "bg-[var(--accent)]"
                    : "bg-gradient-to-br from-[var(--accent)]/70 to-[var(--accent)]/90"
              }`}
              style={{
                boxShadow: activeDrawerClose
                  ? '0 4px 20px rgba(220,38,38,0.4), 0 0 30px rgba(220,38,38,0.15)'
                  : mobileSidebarOpen
                    ? `0 4px 20px color-mix(in srgb, var(--accent) 50%, transparent), 0 0 40px color-mix(in srgb, var(--accent) 15%, transparent)`
                    : `0 4px 16px color-mix(in srgb, var(--accent) 30%, transparent), 0 0 30px color-mix(in srgb, var(--accent) 10%, transparent)`,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <motion.svg
                initial={false}
                animate={{ rotate: activeDrawerClose ? 90 : mobileSidebarOpen ? 90 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`w-6 h-6 ${activeDrawerClose ? "text-cloud-white" : mobileSidebarOpen ? "text-ink-deep" : "text-cloud-white"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2.2}
              >
                {activeDrawerClose || mobileSidebarOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10M4 18h16" />
                )}
              </motion.svg>
            </motion.button>
            <span className={`text-[9px] font-semibold mt-0.5 tracking-wide ${activeDrawerClose ? "text-crimson-glow" : mobileSidebarOpen ? "text-[var(--accent)]" : "text-mist-dark"}`}>
              {activeDrawerClose ? "Close" : "Menu"}
            </span>
          </div>

          {/* Right nav item (3rd primary) */}
          {primaryItems.slice(2, 3).map((item) => {
            const isActive = pathname === item.path;
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.9 }}
                aria-current={isActive ? "page" : undefined}
                onClick={() => { router.push(item.path); setMobileSidebarOpen(false); setMenuOpen(false); }}
                className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[56px] pt-2 pb-1 rounded-2xl transition-colors ${
                  isActive ? "text-[var(--accent)]" : "text-mist-mid active:text-mist-light"
                }`}
                style={{ WebkitTapHighlightColor: 'transparent' }}
              >
                <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                  {NAV_ICON_MAP[item.path] || <span className="text-lg">{item.icon}</span>}
                </div>
                <span className={`text-[10px] font-medium tracking-wide ${isActive ? "text-[var(--accent)]" : ""}`}>
                  {t(item.label, terminologyMode).split(" ")[0]}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="bottomBarActiveTab"
                    className="absolute -bottom-0.5 w-6 h-[3px] rounded-full"
                    style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)' }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}

          {/* More / Hamburger button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleMenuToggle}
            aria-label={menuOpen ? "Close more menu" : "Open more menu"}
            aria-expanded={menuOpen || undefined}
            className={`relative flex flex-col items-center justify-center gap-0.5 min-w-[64px] min-h-[56px] pt-2 pb-1 rounded-2xl transition-colors ${
              menuOpen ? "text-[var(--accent)]" : "text-mist-mid active:text-mist-light"
            }`}
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <motion.div
              animate={{ rotate: menuOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </motion.div>
            <span className={`text-[10px] font-medium tracking-wide ${menuOpen ? "text-[var(--accent)]" : ""}`}>
              More
            </span>
            {menuOpen && (
              <motion.div
                layoutId="bottomBarActiveTab"
                className="absolute -bottom-0.5 w-6 h-[3px] rounded-full"
                style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 8px color-mix(in srgb, var(--accent) 60%, transparent)' }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </motion.button>
        </nav>
      </div>
    </>
  );
}

export default memo(BottomBar);
