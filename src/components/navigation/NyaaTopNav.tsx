"use client";

import { memo, useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIsMobile, useSortedNavItems } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import Link from "next/link";
import { t, tHint } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
import { loadUserPhysique } from "@/lib/user-physique";
import { kgToLbs } from "@/lib/unit-conversion";
import { api } from "@/lib/api-client";
import { ADMIN_NAV_IDS, ADMIN_NAV_IDS_ORDER, DASHBOARD_ROUTES, MAIN_NAV_IDS_ORDER, sortNavItemsByIdOrder } from "@/lib/navigation";

interface NyaaTopNavProps {
  incomingFriendRequestCount?: number;
}

function NyaaTopNav({ incomingFriendRequestCount: _incomingFriendRequestCount = 0 }: NyaaTopNavProps) {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = useSortedNavItems();

  const mainItems = useMemo(
    () => sortNavItemsByIdOrder(items.filter((item) => item.id !== "main" && !ADMIN_NAV_IDS.has(item.id)), MAIN_NAV_IDS_ORDER),
    [items]
  );
  const adminItems = useMemo(
    () => isAdmin
      ? sortNavItemsByIdOrder(items.filter((item) => ADMIN_NAV_IDS.has(item.id)), ADMIN_NAV_IDS_ORDER)
      : [],
    [items, isAdmin]
  );

  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [bodyWeightKg, setBodyWeightKg] = useState<number | null>(null);
  const [weightTrendLabel, setWeightTrendLabel] = useState<string | null>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Keep top bar tighter so utility sections (e.g. Exercise Library, Friends) live under More.
  const visibleNavItems = useMemo(() => mainItems.slice(0, isMobile ? 0 : 3), [mainItems, isMobile]);
  const overflowNavItems = useMemo(() => mainItems.slice(isMobile ? 0 : 3), [mainItems, isMobile]);
  const overflowMenuItems = useMemo(() => {
    const historyItem = mainItems.find((item) => item.id === "history");
    if (!historyItem) return overflowNavItems;
    if (overflowNavItems.some((item) => item.id === "history")) return overflowNavItems;
    return [historyItem, ...overflowNavItems];
  }, [mainItems, overflowNavItems]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if ((event.target as HTMLElement | null)?.closest?.(".glow-modal-container")) {
        return;
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (moreMenuRef.current && !moreMenuRef.current.contains(target)) {
        setMoreMenuOpen(false);
      }
    };

    if (userMenuOpen || moreMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen, moreMenuOpen]);

  useEffect(() => {
    setUserMenuOpen(false);
    setMoreMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!user?.id || typeof window === "undefined") {
      setBodyWeightKg(null);
      setWeightTrendLabel(null);
      return;
    }

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
    if (!user?.id) {
      setWeightTrendLabel(null);
      return;
    }

    let cancelled = false;

    const loadWeightTrend = async () => {
      try {
        const payload = await api.get<{ checkins: Array<{ userId: string; date: string; weight: number | null }> }>("/api/checkins");
        if (cancelled) return;

        const userWeights = (payload.checkins || [])
          .filter((checkin) => checkin.userId === user.id && checkin.weight != null && Number.isFinite(Number(checkin.weight)) && Number(checkin.weight) > 0)
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
        }
      }
    };

    void loadWeightTrend();

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

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

  const navigateToPath = (path: string) => {
    if (path === DASHBOARD_ROUTES.workoutHistory && typeof window !== "undefined") {
      window.dispatchEvent(new Event("train-reset-view"));
    }
    router.push(path);
  };

  const navigateAndCloseMore = (path: string) => {
    setMoreMenuOpen(false);
    navigateToPath(path);
  };

  const navigateAndCloseUserMenu = (path: string) => {
    setUserMenuOpen(false);
    navigateToPath(path);
  };

  const NavLink = ({ href, label, hint, isActive }: { href: string; label: string; hint?: string; isActive: boolean }) => (
    <Link
      href={href}
      onClick={() => {
        if (href === DASHBOARD_ROUTES.workoutHistory && typeof window !== "undefined") {
          window.dispatchEvent(new Event("train-reset-view"));
        }
      }}
      title={hint || undefined}
      className={`nyaa-nav-link px-2 py-1 text-xs transition-colors whitespace-nowrap ${
        isActive
          ? "nyaa-nav-link-active"
          : "nyaa-nav-link-inactive"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <nav className="nyaa-nav-bar sticky top-0 z-40 w-full safe-area-top" role="navigation" aria-label="Main navigation">
      <div className="nyaa-nav-inner w-full px-3 flex items-center gap-0 h-13">

        {/* Logo */}
        <button
          type="button"
          onClick={() => router.push(DASHBOARD_ROUTES.overview)}
          className="nyaa-nav-logo mr-3 font-bold text-sm whitespace-nowrap flex-shrink-0"
          aria-label="Go to home"
        >
          {t("Immortal\u2019s Log", terminologyMode)}
        </button>

        {/* Vertical separator */}
        <span className="nyaa-nav-sep" aria-hidden />

        {/* Primary nav links */}
        {!isMobile && (
          <div className="flex items-center min-w-0 overflow-visible">
            {visibleNavItems.map((item, i) => (
              <span key={item.id} className="flex items-center">
                {i > 0 && <span className="nyaa-nav-sep" aria-hidden />}
                <NavLink
                  href={item.path}
                  label={t(item.label, terminologyMode)}
                  hint={tHint(item.label, terminologyMode) ?? undefined}
                  isActive={pathname === item.path}
                />
              </span>
            ))}

            {(overflowMenuItems.length > 0 || adminItems.length > 0) && (
              <span className="flex items-center">
                <span className="nyaa-nav-sep" aria-hidden />
                <div className="relative" ref={moreMenuRef}>
                  <button
                    type="button"
                    onClick={() => setMoreMenuOpen((o) => !o)}
                    aria-expanded={moreMenuOpen}
                    aria-label={moreMenuOpen ? "Close more navigation" : "Open more navigation"}
                    className={`nyaa-nav-link px-2 py-1 text-xs transition-colors ${
                      moreMenuOpen ? "nyaa-nav-link-active" : "nyaa-nav-link-inactive"
                    }`}
                  >
                    {t("More", "normal")} ▾
                  </button>
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="nyaa-dropdown absolute left-0 mt-1 w-48 z-50"
                        style={{
                          maxHeight: "calc(100dvh - 7rem)",
                          overflowY: "auto",
                          WebkitOverflowScrolling: "touch",
                        }}
                      >
                        {overflowMenuItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateAndCloseMore(item.path)}
                            className={`nyaa-dropdown-item block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              pathname === item.path ? "nyaa-dropdown-item-active" : ""
                            }`}
                          >
                            <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                          </button>
                        ))}
                        {adminItems.length > 0 && (
                          <>
                            <div className="nyaa-dropdown-divider my-1" />
                            {adminItems.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => navigateAndCloseMore(item.path)}
                                className={`nyaa-dropdown-item block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                                  pathname === item.path ? "nyaa-dropdown-item-active" : ""
                                }`}
                              >
                                <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </span>
            )}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Admin badge */}
        {isAdmin && (
          <span className="nyaa-badge mr-2 hidden sm:inline text-[10px] px-1.5 py-0.5 rounded">
            Admin
          </span>
        )}

        {/* User menu */}
        <div className="relative flex-shrink-0" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserMenuOpen((o) => !o)}
            aria-expanded={userMenuOpen}
            aria-label={userMenuOpen ? "Close user menu" : "Open user menu"}
            className="nyaa-nav-link nyaa-nav-link-inactive px-2 py-1 text-xs transition-colors flex items-center gap-1"
          >
            {bodyWeightLabel && (
              <span
                className="hidden sm:inline rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor: "color-mix(in srgb, var(--accent) 40%, var(--border))",
                  color: "var(--accent)",
                  backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)",
                }}
              >
                {bodyWeightLabel}
              </span>
            )}
            {weightTrendLabel && (
              <span
                className="hidden sm:inline rounded border px-1.5 py-0.5 text-[10px] font-semibold"
                style={{
                  borderColor:
                    trendTone === "up"
                      ? "color-mix(in srgb, var(--difficulty-green) 55%, var(--border))"
                      : trendTone === "down"
                        ? "color-mix(in srgb, var(--difficulty-red) 55%, var(--border))"
                        : "color-mix(in srgb, var(--text-muted) 45%, var(--border))",
                  color:
                    trendTone === "up"
                      ? "var(--difficulty-green)"
                      : trendTone === "down"
                        ? "var(--difficulty-red)"
                        : "var(--text-muted)",
                  backgroundColor:
                    trendTone === "up"
                      ? "color-mix(in srgb, var(--difficulty-green) 14%, transparent)"
                      : trendTone === "down"
                        ? "color-mix(in srgb, var(--difficulty-red) 14%, transparent)"
                        : "color-mix(in srgb, var(--text-muted) 10%, transparent)",
                }}
              >
                {weightTrendLabel}
              </span>
            )}
            <span className="hidden sm:inline max-w-[120px] truncate">{user?.name ?? "Guest"}</span>
            <span>▾</span>
          </button>

          <AnimatePresence>
            {userMenuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="nyaa-dropdown absolute right-0 mt-1 w-48 z-50"
              >
                <UserPhysiqueButton
                  userId={user?.id || ""}
                  userName={user?.name || ""}
                  className="nyaa-dropdown-item block min-h-[44px] w-full text-left px-3 py-2 text-sm"
                />

                {/* Mobile: show all nav items in user menu */}
                {isMobile && (
                  <>
                    <div className="nyaa-dropdown-divider my-1" />
                    {mainItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateAndCloseUserMenu(item.path)}
                        className={`nyaa-dropdown-item block min-h-[44px] w-full text-left px-3 py-2 text-sm transition-colors ${
                          pathname === item.path ? "nyaa-dropdown-item-active" : ""
                        }`}
                      >
                        <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                      </button>
                    ))}
                    {adminItems.length > 0 && (
                      <>
                        <div className="nyaa-dropdown-divider my-1" />
                        {adminItems.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateAndCloseUserMenu(item.path)}
                            className={`nyaa-dropdown-item block min-h-[44px] w-full text-left px-3 py-2 text-sm transition-colors ${
                              pathname === item.path ? "nyaa-dropdown-item-active" : ""
                            }`}
                          >
                            <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}

                <div className="nyaa-dropdown-divider my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="nyaa-dropdown-item nyaa-dropdown-item-danger block min-h-[44px] w-full text-left px-3 py-2 text-sm"
                >
                  {t("Sign Out", "normal")}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </nav>
  );
}

export { NyaaTopNav };
export default memo(NyaaTopNav);
