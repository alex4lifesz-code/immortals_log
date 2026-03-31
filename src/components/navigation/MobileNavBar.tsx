"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useState, memo, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
import { ADMIN_NAV_IDS_ORDER, DASHBOARD_ROUTES, MAIN_NAV_IDS_ORDER, MOBILE_PRIMARY_NAV_IDS, sortNavItemsByIdOrder } from "@/lib/navigation";

const ADMIN_NAV_IDS = new Set(["admin", "checkin"]);

const NAV_ICON_MAP: Record<string, ReactNode> = {
  [DASHBOARD_ROUTES.community]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  [DASHBOARD_ROUTES.overview]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z" />
    </svg>
  ),
  [DASHBOARD_ROUTES.main]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  [DASHBOARD_ROUTES.workoutHistory]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 109-9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v4h4" />
    </svg>
  ),
  [DASHBOARD_ROUTES.attendance]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 002 2h2a2 2 0 002-2 2 2 0 00-2-2h-2a2 2 0 00-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
  [DASHBOARD_ROUTES.exercises]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  [DASHBOARD_ROUTES.friends]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a4 4 0 100-8 4 4 0 000 8zM8 12a4 4 0 100-8 4 4 0 000 8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2 20a6 6 0 0112 0M14 20a6 6 0 018 0" />
    </svg>
  ),
  [DASHBOARD_ROUTES.settings]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  [DASHBOARD_ROUTES.admin]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
};

const LOGOUT_ICON = (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);

function MobileNavBar({ incomingFriendRequestCount = 0 }: { incomingFriendRequestCount?: number }) {
  const { getSortedNavItems, isMobile, setMobileSidebarOpen } = useAppContext();
  const { logout, user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = sortNavItemsByIdOrder(
    getSortedNavItems().filter((item) => (isAdmin ? true : !ADMIN_NAV_IDS.has(item.id))),
    [...MAIN_NAV_IDS_ORDER, ...ADMIN_NAV_IDS_ORDER]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const lastScrollYRef = useRef(0);

  const effectiveMobile = isMobile;

  const primaryItems = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    return MOBILE_PRIMARY_NAV_IDS.map((id) => itemMap.get(id)).filter(Boolean) as typeof items;
  }, [items]);

  const moreItems = useMemo(
    () => items.filter(i => !primaryItems.find(p => p.id === i.id)),
    [items, primaryItems]
  );

  const regularMoreItems = useMemo(
    () => moreItems.filter((item) => !ADMIN_NAV_IDS.has(item.id)),
    [moreItems]
  );

  const adminMoreItems = useMemo(
    () => (isAdmin ? moreItems.filter((item) => ADMIN_NAV_IDS.has(item.id)) : []),
    [isAdmin, moreItems]
  );

  const handleNavigate = useCallback((path: string) => {
    router.push(path);
    setMenuOpen(false);
    setMobileSidebarOpen(false);
  }, [router, setMobileSidebarOpen]);

  const handleMenuToggle = useCallback(() => {
    setMenuOpen(prev => !prev);
  }, []);

  useEffect(() => {
    if (!effectiveMobile) return;

    const scrollContainer = document.querySelector<HTMLElement>("[data-mobile-scroll-container='true']");
    const getScrollTop = () => (scrollContainer ? scrollContainer.scrollTop : window.scrollY);

    lastScrollYRef.current = getScrollTop();
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = getScrollTop();
        const delta = currentY - lastScrollYRef.current;
        const threshold = 8;

        if (currentY <= 16) {
          setNavVisible(true);
        } else if (delta > threshold) {
          setNavVisible(false);
        } else if (delta < -threshold) {
          setNavVisible(true);
        }

        lastScrollYRef.current = currentY;
        ticking = false;
      });
    };

    const target: EventTarget = scrollContainer ?? window;
    target.addEventListener("scroll", onScroll as EventListener, { passive: true });

    return () => {
      target.removeEventListener("scroll", onScroll as EventListener);
    };
  }, [effectiveMobile]);

  // Show the APK-style bottom nav whenever mobile viewport is active.
  if (!effectiveMobile) return null;

  // Build nav button order: [main, community, overview, workout-history, more]
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

      <motion.div
        className="fixed bottom-0 left-0 right-0 z-50"
        animate={{ y: navVisible || menuOpen ? 0 : 120 }}
        transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
      >
        {/* Expanded menu drawer */}
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="mx-2 mb-0 rounded-t-3xl border border-jade-glow/20 bg-ink-deep/96 p-3 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,0.24)]"
            >
              <div className="mb-2 flex items-start justify-between px-1 pt-1">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mist-dark">Navigation</span>
                  <p className="mt-0.5 text-[12px] text-mist-mid">Quick access to your pages</p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close navigation menu"
                  className="flex min-h-[36px] min-w-[36px] items-center justify-center rounded-full border border-ink-light/70 bg-ink-mid/40 p-1.5 text-mist-dark transition-colors active:bg-ink-mid/70 active:text-cloud-white"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 px-1" role="menu" aria-label="Navigation menu">
                {user && (
                  <div className="col-span-2 rounded-2xl border border-jade-glow/25 bg-gradient-to-r from-jade-deep/18 via-ink-mid/50 to-ink-mid/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-[0.14em] text-mist-dark">Body Profile</p>
                        <p className="mt-0.5 text-[12px] text-mist-light">Keep your stats current for accurate training targets.</p>
                      </div>
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-jade-glow/40 bg-jade-deep/18 text-jade-light">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
                        </svg>
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <UserPhysiqueButton
                        userId={user.id}
                        userName="Update Weight & Gender"
                        className="inline-flex min-h-[40px] items-center justify-center rounded-xl border border-jade-glow/40 bg-jade-deep/20 px-3 text-[13px] font-semibold text-jade-light transition-all duration-150 hover:border-jade-glow/55 hover:bg-jade-deep/28 hover:text-jade-glow active:scale-[0.98]"
                      />
                    </div>
                  </div>
                )}
                {regularMoreItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: index * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                    role="menuitem"
                    className={`group flex min-h-[50px] items-center gap-2.5 rounded-xl border px-3 py-3 transition-all duration-150 ${
                      pathname === item.path
                        ? "border-jade-glow/40 bg-jade-deep/20 text-jade-light"
                        : "border-ink-light/40 bg-ink-mid/30 text-mist-light active:border-jade-glow/35 active:bg-ink-mid/55 active:text-jade-light"
                    }`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
                      pathname === item.path
                        ? "border-jade-glow/35 bg-jade-deep/24"
                        : "border-ink-light/60 bg-ink-deep/45"
                    }`}>
                      {NAV_ICON_MAP[item.path] ?? <span className="text-base">{item.icon}</span>}
                    </span>
                    <span className="truncate text-[13px] font-medium">{t(item.label, terminologyMode)}</span>
                    {item.id === "friends" && incomingFriendRequestCount > 0 && (
                      <span className="ml-auto min-w-[18px] h-[18px] px-1 rounded-full bg-crimson-light text-void-black text-[10px] font-bold flex items-center justify-center">
                        {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
                      </span>
                    )}
                  </motion.button>
                ))}

                {adminMoreItems.length > 0 && (
                  <div className="col-span-2 mt-1 px-1">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-gold-dim/85">Admin</p>
                  </div>
                )}

                {adminMoreItems.map((item, index) => (
                  <motion.button
                    key={item.id}
                    initial={{ y: 10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: (regularMoreItems.length + index) * 0.04 }}
                    whileTap={{ scale: 0.97 }}
                    role="menuitem"
                    className={`group flex min-h-[50px] items-center gap-2.5 rounded-xl border px-3 py-3 transition-all duration-150 ${
                      pathname === item.path
                        ? "border-gold/45 bg-gold-dim/20 text-gold"
                        : "border-gold/25 bg-gold-dim/10 text-gold-dim hover:border-gold/45 hover:text-gold"
                    }`}
                    onClick={() => handleNavigate(item.path)}
                  >
                    <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border ${
                      pathname === item.path
                        ? "border-gold/45 bg-gold-dim/20"
                        : "border-gold/25 bg-gold-dim/10"
                    }`}>
                      {NAV_ICON_MAP[item.path] ?? <span className="text-base">{item.icon}</span>}
                    </span>
                    <span className="truncate text-[13px] font-medium">{t(item.label, terminologyMode)}</span>
                  </motion.button>
                ))}
                <motion.button
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: (regularMoreItems.length + adminMoreItems.length) * 0.04 }}
                  whileTap={{ scale: 0.97 }}
                  role="menuitem"
                  className="col-span-2 mt-0.5 flex min-h-[50px] items-center gap-2.5 rounded-xl border border-crimson/25 bg-crimson-deep/8 px-3 py-3 text-crimson-light/85 transition-all duration-150 active:border-crimson/45 active:bg-crimson-deep/20 active:text-crimson-light"
                  onClick={() => { setMenuOpen(false); logout(); }}
                >
                  <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-crimson/30 bg-crimson-deep/15">{LOGOUT_ICON}</span>
                  <span className="text-[13px] font-medium">Logout</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main Bottom Navigation Bar ── */}
        <nav
          className="relative bg-ink-deep/95 backdrop-blur-lg border-t border-jade-glow/8 flex items-end justify-around px-1 pb-1 safe-area-bottom"
        >
          {/* Glow accent line */}
          <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(to right, transparent, color-mix(in srgb, var(--accent) 15%, transparent), transparent)` }} />

          {/* Fixed primary nav items */}
          {primaryItems.map((item) => {
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
                {item.id === "friends" && incomingFriendRequestCount > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-crimson-light text-void-black text-[9px] font-bold flex items-center justify-center">
                    {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
                  </span>
                )}
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
      </motion.div>
    </>
  );
}

export default memo(MobileNavBar);
