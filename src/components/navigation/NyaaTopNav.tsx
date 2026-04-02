"use client";

import { memo, useState, useRef, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useIsMobile, useSortedNavItems } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import Link from "next/link";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
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
    () => sortNavItemsByIdOrder(items.filter((item) => !ADMIN_NAV_IDS.has(item.id)), MAIN_NAV_IDS_ORDER),
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
  const userMenuRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Determine which items to show in the compact nav bar and which go under "More"
  const visibleNavItems = useMemo(() => mainItems.slice(0, isMobile ? 0 : 5), [mainItems, isMobile]);
  const overflowNavItems = useMemo(() => mainItems.slice(isMobile ? 0 : 5), [mainItems, isMobile]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
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

  const NavLink = ({ href, label, isActive }: { href: string; label: string; isActive: boolean }) => (
    <Link
      href={href}
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
    <nav className="nyaa-nav-bar sticky top-0 z-40 w-full" role="navigation" aria-label="Main navigation">
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
                  isActive={pathname === item.path}
                />
              </span>
            ))}

            {(overflowNavItems.length > 0 || adminItems.length > 0) && (
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
                    More ▾
                  </button>
                  <AnimatePresence>
                    {moreMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.12 }}
                        className="nyaa-dropdown absolute left-0 mt-1 w-48 z-50"
                      >
                        {overflowNavItems.map((item) => (
                          <Link
                            key={item.id}
                            href={item.path}
                            onClick={() => setMoreMenuOpen(false)}
                            className={`nyaa-dropdown-item block px-3 py-1.5 text-xs transition-colors ${
                              pathname === item.path ? "nyaa-dropdown-item-active" : ""
                            }`}
                          >
                            {t(item.label, terminologyMode)}
                          </Link>
                        ))}
                        {adminItems.length > 0 && (
                          <>
                            <div className="nyaa-dropdown-divider my-1" />
                            {adminItems.map((item) => (
                              <Link
                                key={item.id}
                                href={item.path}
                                onClick={() => setMoreMenuOpen(false)}
                                className={`nyaa-dropdown-item block px-3 py-1.5 text-xs transition-colors ${
                                  pathname === item.path ? "nyaa-dropdown-item-active" : ""
                                }`}
                              >
                                {t(item.label, terminologyMode)}
                              </Link>
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
                  className="nyaa-dropdown-item block w-full text-left px-3 py-1.5 text-xs"
                />

                {/* Mobile: show all nav items in user menu */}
                {isMobile && (
                  <>
                    <div className="nyaa-dropdown-divider my-1" />
                    {mainItems.map((item) => (
                      <Link
                        key={item.id}
                        href={item.path}
                        onClick={() => setUserMenuOpen(false)}
                        className={`nyaa-dropdown-item block px-3 py-1.5 text-xs transition-colors ${
                          pathname === item.path ? "nyaa-dropdown-item-active" : ""
                        }`}
                      >
                        {t(item.label, terminologyMode)}
                      </Link>
                    ))}
                    {adminItems.length > 0 && (
                      <>
                        <div className="nyaa-dropdown-divider my-1" />
                        {adminItems.map((item) => (
                          <Link
                            key={item.id}
                            href={item.path}
                            onClick={() => setUserMenuOpen(false)}
                            className={`nyaa-dropdown-item block px-3 py-1.5 text-xs transition-colors ${
                              pathname === item.path ? "nyaa-dropdown-item-active" : ""
                            }`}
                          >
                            {t(item.label, terminologyMode)}
                          </Link>
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
                  className="nyaa-dropdown-item nyaa-dropdown-item-danger block w-full text-left px-3 py-1.5 text-xs"
                >
                  Sign Out
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
