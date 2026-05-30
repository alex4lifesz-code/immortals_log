"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useState, memo, useCallback, useMemo, useEffect, useRef, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { loadUserPhysique } from "@/lib/user-physique";
import { kgToLbs } from "@/lib/unit-conversion";
import { api } from "@/lib/api-client";
import { t, tHint } from "@/lib/terminology";
import { ADMIN_NAV_IDS_ORDER, DASHBOARD_ROUTES, MAIN_NAV_IDS_ORDER, MOBILE_MORE_NAV_IDS_ORDER, MOBILE_PRIMARY_NAV_IDS, sortNavItemsByIdOrder } from "@/lib/navigation";

const ADMIN_NAV_IDS = new Set(["attendance", "admin", "website-information"]);

const NAV_ICON_MAP: Record<string, ReactNode> = {
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
  [DASHBOARD_ROUTES.rankUp]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  [DASHBOARD_ROUTES.workoutHistory]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12a9 9 0 109-9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4v4h4" />
    </svg>
  ),
  [DASHBOARD_ROUTES.checkIn]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5a2 2 0 002 2h2a2 2 0 002-2 2 2 0 00-2-2h-2a2 2 0 00-2 2z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
  [DASHBOARD_ROUTES.circle]: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
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

function MobileNavBar({
  incomingFriendRequestCount = 0,
  isTrainExerciseHistoryOpen = false,
}: {
  incomingFriendRequestCount?: number;
  isTrainExerciseHistoryOpen?: boolean;
}) {
  const { getSortedNavItems, isMobile, setMobileSidebarOpen } = useAppContext();
  const { logout, user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = user?.role === "admin";
  const items = sortNavItemsByIdOrder(
    getSortedNavItems().filter((item) => item.id !== "main" && (isAdmin ? true : !ADMIN_NAV_IDS.has(item.id))),
    [...MAIN_NAV_IDS_ORDER, ...ADMIN_NAV_IDS_ORDER]
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const [weightTrendLabel, setWeightTrendLabel] = useState<string | null>(null);
  const [checkInTotalCount, setCheckInTotalCount] = useState<number | null>(null);
  const lastScrollYRef = useRef(0);

  const effectiveMobile = isMobile;

  const primaryItems = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    return MOBILE_PRIMARY_NAV_IDS.map((id) => itemMap.get(id)).filter(Boolean) as typeof items;
  }, [items]);

  const moreItems = useMemo(
    () => items.filter((item) => !primaryItems.find((p) => p.id === item.id)),
    [items, primaryItems]
  );

  const regularMoreItems = useMemo(
    () => sortNavItemsByIdOrder(moreItems.filter((item) => !ADMIN_NAV_IDS.has(item.id)), MOBILE_MORE_NAV_IDS_ORDER),
    [moreItems]
  );

  const adminMoreItems = useMemo(
    () => (isAdmin ? moreItems.filter((item) => ADMIN_NAV_IDS.has(item.id)) : []),
    [isAdmin, moreItems]
  );

  const bodyWeightLabel = useMemo(() => {
    if (bodyWeightKg == null) return null;
    const displayUnit = settings.defaultWeightUnit === "lbs" ? "lbs" : "kg";
    const displayValue = displayUnit === "lbs" ? kgToLbs(bodyWeightKg) : bodyWeightKg;
    return `${displayValue.toFixed(1)} ${displayUnit}`;
  }, [bodyWeightKg, settings.defaultWeightUnit]);

  const trendTone = useMemo(() => {
    if (!weightTrendLabel) return "neutral";
    if (weightTrendLabel.startsWith("+")) return "up";
    if (weightTrendLabel.startsWith("-")) return "down";
    return "neutral";
  }, [weightTrendLabel]);

  const quickAccessItems = useMemo(
    () => [
      { id: "profile", label: t("Profile", "normal"), path: DASHBOARD_ROUTES.profile, icon: "👤" },
      { id: "checkin", label: t("Check-In", "normal"), path: DASHBOARD_ROUTES.checkIn, icon: NAV_ICON_MAP[DASHBOARD_ROUTES.checkIn] },
      { id: "settings", label: t("Settings", "normal"), path: DASHBOARD_ROUTES.settings, icon: NAV_ICON_MAP[DASHBOARD_ROUTES.settings] },
      { id: "circle", label: t("Circle", "normal"), path: "/dashboard/circle?tab=members", icon: NAV_ICON_MAP[DASHBOARD_ROUTES.circle] },
    ],
    [],
  );

  const menuPageItems = useMemo(
    () => regularMoreItems.filter((item) => !quickAccessItems.some((quick) => quick.path === item.path)),
    [quickAccessItems, regularMoreItems],
  );
  void menuPageItems;

  const handleNavigate = useCallback((path: string) => {
    setMenuOpen(false);
    setMobileSidebarOpen(false);

    if (typeof window !== "undefined") {
      if (path === DASHBOARD_ROUTES.workoutHistory) {
        window.dispatchEvent(new Event("train-reset-view"));
      }
      if (path === DASHBOARD_ROUTES.checkIn || path === DASHBOARD_ROUTES.checkinLegacy) {
        window.dispatchEvent(new Event("checkin-notes-updated"));
      }
    }

    const currentQuery = searchParams.toString();
    const isExactRoute = pathname === path;
    if (isExactRoute && !currentQuery) {
      router.refresh();
      return;
    }

    router.push(path);
  }, [pathname, router, searchParams, setMobileSidebarOpen]);

  const handleMenuToggle = useCallback(() => {
    setMobileSidebarOpen(false);
    setMenuOpen((prev) => !prev);
  }, [setMobileSidebarOpen]);
  void handleMenuToggle;

  const isPathActive = useCallback((path: string) => {
    if (!pathname) return false;

    if (path === DASHBOARD_ROUTES.root || path === DASHBOARD_ROUTES.overview) {
      return pathname === DASHBOARD_ROUTES.root || pathname === DASHBOARD_ROUTES.main;
    }

    if (path === DASHBOARD_ROUTES.checkIn) {
      return pathname === DASHBOARD_ROUTES.checkIn
        || pathname.startsWith(`${DASHBOARD_ROUTES.checkIn}/`)
        || pathname === DASHBOARD_ROUTES.checkinLegacy
        || pathname.startsWith(`${DASHBOARD_ROUTES.checkinLegacy}/`);
    }

    return pathname === path || pathname?.startsWith(`${path}/`);
  }, [pathname]);

  const isMeSectionActive = useMemo(
    () => isPathActive(DASHBOARD_ROUTES.profile),
    [isPathActive]
  );

  useEffect(() => {
    if (!effectiveMobile || typeof document === "undefined") return;

    const scrollContainerSelector = "[data-mobile-scroll-container='true']";

    const getScrollContainers = () => Array.from(
      document.querySelectorAll<HTMLElement>(scrollContainerSelector)
    );

    const readScrollTop = (target?: EventTarget | null) => {
      if (target instanceof HTMLElement) {
        return target.scrollTop;
      }
      return window.scrollY || document.documentElement.scrollTop || 0;
    };

    const resolveActiveContainer = (target?: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return null;
      return target.matches(scrollContainerSelector)
        ? target
        : target.closest<HTMLElement>(scrollContainerSelector);
    };

    const getCurrentScrollTop = (target?: EventTarget | null) => {
      const activeContainer = resolveActiveContainer(target);
      if (activeContainer) {
        return readScrollTop(activeContainer);
      }

      const containerTops = getScrollContainers().map((container) => container.scrollTop || 0);
      const windowTop = readScrollTop(window);
      return Math.max(windowTop, ...containerTops, 0);
    };

    const scrollContainers = getScrollContainers();
    lastScrollYRef.current = getCurrentScrollTop();
    let ticking = false;

    const onScroll = (event?: Event) => {
      if (ticking) return;

      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = getCurrentScrollTop(event?.target ?? null);
        const delta = currentY - lastScrollYRef.current;
        const threshold = 6;

        if (currentY <= 24 || delta < -threshold) {
          setNavVisible(true);
        } else if (delta > threshold) {
          setNavVisible(false);
        }

        lastScrollYRef.current = currentY;
        ticking = false;
      });
    };

    const listenerOptions: AddEventListenerOptions = { passive: true };
    window.addEventListener("scroll", onScroll as EventListener, listenerOptions);
    scrollContainers.forEach((container) => {
      container.addEventListener("scroll", onScroll as EventListener, listenerOptions);
    });
    document.addEventListener("scroll", onScroll as EventListener, { passive: true, capture: true });

    return () => {
      window.removeEventListener("scroll", onScroll as EventListener);
      scrollContainers.forEach((container) => {
        container.removeEventListener("scroll", onScroll as EventListener);
      });
      document.removeEventListener("scroll", onScroll as EventListener, true);
    };
  }, [effectiveMobile, pathname]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;

    if (!effectiveMobile) {
      root.style.removeProperty("--mobile-nav-offset");
      return;
    }

    root.style.setProperty(
      "--mobile-nav-offset",
      "calc(env(safe-area-inset-bottom,0px) + 4.85rem)"
    );

    return () => {
      root.style.removeProperty("--mobile-nav-offset");
    };
  }, [effectiveMobile]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") return;

    const syncBodyWeight = () => {
      const physique = loadUserPhysique(user.id);
      setBodyWeightKg(physique.bodyWeightKg);
    };

    const onPhysiqueUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ userId?: string }>).detail;
      if (!detail?.userId || detail.userId === user.id) {
        syncBodyWeight();
      }
    };

    syncBodyWeight();
    window.addEventListener("user-physique-updated", onPhysiqueUpdated as EventListener);
    return () => {
      window.removeEventListener("user-physique-updated", onPhysiqueUpdated as EventListener);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const loadWeightTrend = async () => {
      try {
        const payload = await api.get<{ checkins: Array<{ userId: string; date: string; weight: number | null }> }>("/api/checkins");
        if (cancelled) return;

        const userCheckIns = (payload.checkins || []).filter((checkin) => checkin.userId === user.id);
        setCheckInTotalCount(userCheckIns.length);

        const userWeights = userCheckIns
          .filter((checkin) => checkin.weight != null && Number.isFinite(Number(checkin.weight)) && Number(checkin.weight) > 0)
          .map((checkin) => ({ date: checkin.date, weight: Number(checkin.weight) }))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (userWeights.length < 2) {
          setWeightTrendLabel(null);
          return;
        }

        const first = userWeights[0].weight;
        const latest = userWeights[userWeights.length - 1].weight;
        if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(latest)) {
          setWeightTrendLabel(null);
          return;
        }

        const changePct = ((latest - first) / first) * 100;
        const absPct = Math.abs(changePct).toFixed(1);
        if (absPct === "0.0") {
          setWeightTrendLabel("0.0%");
          return;
        }

        setWeightTrendLabel(changePct >= 0 ? `+${absPct}%` : `-${absPct}%`);
      } catch {
        if (!cancelled) {
          setWeightTrendLabel(null);
          setCheckInTotalCount(null);
        }
      }
    };

    void loadWeightTrend();

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

  // Show the bottom nav whenever mobile viewport is active.
  if (!effectiveMobile) return null;

  // Build nav button order: [check-in, train, me]
  return (
    <>
      <motion.div
        className={`fixed bottom-0 left-0 right-0 safe-area-left safe-area-right ${isTrainExerciseHistoryOpen ? "z-[120]" : "z-[200]"}`}
        animate={{ y: navVisible ? 0 : 120 }}
        transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
      >
        {/* ── Main Bottom Navigation Bar ── */}
        <nav
          data-mobile-bottom-nav="true"
          className="mobile-bottom-nav-polish relative mx-1 mb-1.5 flex items-end justify-around gap-0.5 rounded-2xl border px-1 pt-1 pb-1.5 shadow-[0_-10px_28px_rgba(0,0,0,0.4)] backdrop-blur-md safe-area-bottom"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 58%, var(--border))",
            background: "linear-gradient(180deg, color-mix(in srgb, var(--surface-hover) 82%, var(--surface)) 0%, color-mix(in srgb, var(--surface) 96%, black) 100%)",
            boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 -10px 28px rgba(0,0,0,0.4)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent) 18%, var(--ink-light)) 20%, color-mix(in srgb, var(--ink-light) 84%, var(--border)) 50%, color-mix(in srgb, var(--accent) 18%, var(--ink-light)) 80%, transparent 100%)",
            }}
          />

          {/* Fixed primary nav items */}
          {primaryItems.map((item) => {
            const isActive = !isMeSectionActive && isPathActive(item.path);
            return (
              <motion.button
                key={item.id}
                whileTap={{ scale: 0.9 }}
                aria-current={isActive ? "page" : undefined}
                aria-label={t(item.label, terminologyMode)}
                onClick={() => handleNavigate(item.path)}
                className={`polished-focus touch-manipulation relative flex min-h-[60px] min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-lg pt-2 pb-1.5 transition-[color,background-color,transform] duration-200`}
                style={{
                  WebkitTapHighlightColor: 'transparent',
                  backgroundColor: isActive ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
                  color: isActive ? "var(--text-primary)" : "var(--text-muted)",
                }}
              >
                <div className={`transition-transform duration-200 ${isActive ? "scale-110" : ""}`}>
                  {NAV_ICON_MAP[item.path] || <span className="text-lg">{item.icon}</span>}
                </div>
                <span className={`text-[11px] font-medium tracking-wide`} style={{ color: isActive ? "var(--text-primary)" : undefined }}>
                  {t(item.label, terminologyMode).split(" ")[0]}
                </span>
                {item.id === "circle" && incomingFriendRequestCount > 0 && (
                  <span className="absolute top-1 right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-crimson-light text-void-black text-[9px] font-bold flex items-center justify-center">
                    {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="bottomBarActiveTab"
                    className="absolute -bottom-0.5 h-[3px] w-6 rounded-full"
                    style={{ backgroundColor: "var(--accent)" }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}

          {/* Me/profile button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => handleNavigate(DASHBOARD_ROUTES.profile)}
            aria-label="Open profile"
            className={`polished-focus touch-manipulation relative flex min-h-[60px] min-w-[68px] flex-col items-center justify-center gap-0.5 rounded-lg pt-2 pb-1.5 transition-[color,background-color,transform] duration-200`}
            style={{
              WebkitTapHighlightColor: 'transparent',
              backgroundColor: isMeSectionActive ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "transparent",
              color: isMeSectionActive ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            <motion.div
              animate={{ scale: isMeSectionActive ? 1.05 : 1 }}
              transition={{ duration: 0.18 }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
              </svg>
            </motion.div>
            <span className={`text-[11px] font-medium tracking-wide`} style={{ color: isMeSectionActive ? "var(--text-primary)" : undefined }}>
              {t("Me", "normal")}
            </span>
            {isMeSectionActive && (
              <motion.div
                layoutId="bottomBarActiveTab"
                className="absolute -bottom-0.5 h-[3px] w-6 rounded-full"
                style={{ backgroundColor: "var(--accent)" }}
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
