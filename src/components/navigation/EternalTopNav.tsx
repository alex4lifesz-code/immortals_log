"use client";

import { memo, useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile, useSortedNavItems } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import Link from "next/link";
import { t, tHint } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
import { ADMIN_NAV_IDS, ADMIN_NAV_IDS_ORDER, DASHBOARD_ROUTES, MAIN_NAV_IDS_ORDER, sortNavItemsByIdOrder } from "@/lib/navigation";

interface EternalTopNavProps {
  incomingFriendRequestCount?: number;
}

function EternalTopNav({ incomingFriendRequestCount: _incomingFriendRequestCount = 0 }: EternalTopNavProps) {
  const isMobile = useIsMobile();
  const { user, logout } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = useSortedNavItems();
  const mainItems = useMemo(
    () => sortNavItemsByIdOrder(items.filter((item) => !ADMIN_NAV_IDS.has(item.id)), MAIN_NAV_IDS_ORDER),
    [items]
  );
  const adminItems = useMemo(
    () => isAdmin
      ? sortNavItemsByIdOrder(items.filter((item) => ADMIN_NAV_IDS.has(item.id)), ADMIN_NAV_IDS_ORDER)
      : [],
    [items, isAdmin]
  );
  const primaryItems = useMemo(
    () => mainItems.filter((item) => ["dashboard", "history", "rank-up"].includes(item.id)),
    [mainItems]
  );
  const secondaryItems = useMemo(
    () => mainItems.filter((item) => !["dashboard", "rank-up"].includes(item.id)),
    [mainItems]
  );
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if ((event.target as HTMLElement | null)?.closest?.(".glow-modal-container")) {
        return;
      }
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setUserMenuOpen(false);
      }
      if (navMenuRef.current && !navMenuRef.current.contains(target)) {
        setNavMenuOpen(false);
      }
    };

    if (userMenuOpen || navMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [userMenuOpen, navMenuOpen]);

  return (
    <nav className="sticky top-0 z-40 w-full border-b bg-surface safe-area-top" style={{ borderBottomColor: 'var(--neon-border)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push(DASHBOARD_ROUTES.overview)}
            className="flex items-center gap-2 font-bold text-lg text-accent hover:text-accent-hover transition-colors"
          >
            <span className="text-2xl">⚔️</span>
            <span className="hidden sm:inline">{t("Immortal’s Log", "normal")}</span>
          </motion.button>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div className="hidden md:flex items-center gap-1">
              {primaryItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <Link
                    key={item.id}
                    href={item.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-accent/10 text-accent"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                    }`}
                  >
                    <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                  </Link>
                );
              })}

              <div className="relative ml-1" ref={navMenuRef}>
                <button
                  type="button"
                  onClick={() => setNavMenuOpen((open) => !open)}
                  aria-label={navMenuOpen ? "Close navigation menu" : "Open navigation menu"}
                  aria-expanded={navMenuOpen || undefined}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    navMenuOpen
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                  }`}
                >
                  {t("More", "normal")}
                </button>

                <AnimatePresence>
                  {navMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute right-0 mt-2 w-56 bg-surface border border-border rounded-lg shadow-lg"
                      style={{
                        maxHeight: "calc(100dvh - 7rem)",
                        overflowY: "auto",
                        WebkitOverflowScrolling: "touch",
                      }}
                    >
                      <div className="p-1">
                        {secondaryItems.map((item) => {
                          const isActive = pathname === item.path;
                          return (
                            <Link
                              key={item.id}
                              href={item.path}
                              onClick={() => setNavMenuOpen(false)}
                              className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                                isActive
                                  ? "bg-accent/10 text-accent font-medium"
                                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                              }`}
                            >
                              <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                            </Link>
                          );
                        })}

                        {adminItems.length > 0 && (
                          <div className="mt-1 pt-1 border-t border-border">
                            {adminItems.map((item) => {
                              const isActive = pathname === item.path;
                              return (
                                <Link
                                  key={item.id}
                                  href={item.path}
                                  onClick={() => setNavMenuOpen(false)}
                                  className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                                    isActive
                                      ? "bg-accent/10 text-accent font-medium"
                                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                                  }`}
                                >
                                  <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Right Section - User Menu */}
          <div className="flex items-center gap-3">
            {isAdmin && (
              <span className="hidden sm:inline px-2 py-1 rounded-full border border-accent/40 text-xs uppercase tracking-wide text-accent font-semibold">
                {t("Admin", "normal")}
              </span>
            )}

            <div className="relative" ref={userMenuRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 py-2 hover:bg-surface-hover transition-colors"
              >
                <span className="text-lg">👤</span>
                <span className="hidden sm:inline text-sm font-medium text-text-secondary">
                  {user?.name}
                </span>
              </motion.button>

              {/* Dropdown Menu */}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="absolute right-0 mt-2 w-48 bg-surface border border-border rounded-lg shadow-lg"
                  >
                    <UserPhysiqueButton
                      userId={user?.id || ""}
                      userName={user?.name || ""}
                      className="block min-h-[44px] w-full text-left rounded-t-xl px-4 py-2 text-sm font-medium text-text-primary hover:bg-surface-hover"
                    />
                    {isMobile && (
                      <div className="border-t border-border">
                        {mainItems.map((item) => {
                          const isActive = pathname === item.path;
                          return (
                            <Link
                              key={item.id}
                              href={item.path}
                              onClick={() => setUserMenuOpen(false)}
                              className={`block min-h-[44px] w-full text-left px-4 py-2 text-sm transition-colors ${
                                isActive
                                  ? "bg-accent/10 text-accent font-medium"
                                  : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                              }`}
                            >
                              <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                            </Link>
                          );
                        })}
                        {adminItems.length > 0 && (
                          <div className="border-t border-border">
                            {adminItems.map((item) => {
                              const isActive = pathname === item.path;
                              return (
                                <Link
                                  key={item.id}
                                  href={item.path}
                                  onClick={() => setUserMenuOpen(false)}
                                  className={`block min-h-[44px] w-full text-left px-4 py-2 text-sm transition-colors ${
                                    isActive
                                      ? "bg-accent/10 text-accent font-medium"
                                      : "text-text-secondary hover:text-text-primary hover:bg-surface-hover"
                                  }`}
                                >
                                  <span title={tHint(item.label, terminologyMode) ?? undefined}>{t(item.label, terminologyMode)}</span>
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setUserMenuOpen(false);
                        logout();
                      }}
                      className="min-h-[44px] w-full text-left rounded-b-xl border-t border-border px-4 py-2 text-sm text-danger hover:bg-danger/10"
                    >
                      {t("Sign Out", "normal")}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

// For dynamic imports
export { EternalTopNav };
export default memo(EternalTopNav);
