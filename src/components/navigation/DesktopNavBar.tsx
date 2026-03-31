"use client";

import { motion } from "framer-motion";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
import { t } from "@/lib/terminology";
import { ADMIN_NAV_IDS_ORDER, DASHBOARD_ROUTES, MAIN_NAV_IDS_ORDER, sortNavItemsByIdOrder } from "@/lib/navigation";

function DesktopNavBar() {
  const { collapsed, topPanelExpanded, setTopPanelExpanded, getSortedNavItems } = useAppContext();
  const { settings } = useDisplaySettings();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const isAdmin = user?.role === "admin";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const elevated = false;

  const allItems = getSortedNavItems();
  const mainItems = useMemo(
    () => sortNavItemsByIdOrder(allItems.filter((item) => !["admin", "checkin"].includes(item.id)), MAIN_NAV_IDS_ORDER),
    [allItems]
  );
  const adminItems = useMemo(
    () => isAdmin
      ? sortNavItemsByIdOrder(allItems.filter((item) => ["admin", "checkin"].includes(item.id)), ADMIN_NAV_IDS_ORDER)
      : [],
    [allItems, isAdmin]
  );
  const primaryItems = useMemo(
    () => mainItems.filter((item) => ["main", "history", "exercise-db"].includes(item.id)),
    [mainItems]
  );
  const secondaryItems = useMemo(
    () => mainItems.filter((item) => !["main", "history", "exercise-db"].includes(item.id)),
    [mainItems]
  );

  const navigateTo = (path: string) => {
    setMenuOpen(false);
    router.push(path);
  };

  useEffect(() => {
    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", onDocumentMouseDown);
      return () => document.removeEventListener("mousedown", onDocumentMouseDown);
    }
  }, [menuOpen]);

  // Mobile: no stats panel needed
  if (collapsed) {
    return null;
  }

  return (
    <>
      {/* Collapsible pulse tab — desktop only */}
      {!topPanelExpanded && (
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-0 left-1/2 transform -translate-x-1/2 z-50 pointer-events-auto"
        >
          <motion.button
            onClick={() => setTopPanelExpanded(true)}
            aria-label="Expand navigation bar"
            aria-expanded={false}
            whileHover={{ y: 2 }}
            whileTap={{ y: 1 }}
            className="w-16 h-2 bg-gradient-to-r from-jade-glow/60 to-jade-light/60 rounded-b-full border-b border-jade-glow/40 shadow-lg shadow-jade-glow/20 hover:shadow-jade-glow/40 transition-shadow"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}

      {/* Main Top Bar — desktop */}
      <motion.div
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: topPanelExpanded ? 0 : -48, opacity: topPanelExpanded ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`h-14 bg-gradient-to-r from-ink-deep to-ink-dark border-b border-jade-glow/20 flex items-center px-3 gap-3 shrink-0 overflow-x-auto z-40 transition-shadow ${
          elevated ? "shadow-lg shadow-black/30" : ""
        }`}
      >
        <div className="flex items-center pr-3 border-r border-ink-light/70 shrink-0">
          <motion.span 
            className="text-jade-glow text-sm font-bold whitespace-nowrap tracking-[0.08em] cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => navigateTo(DASHBOARD_ROUTES.overview)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigateTo(DASHBOARD_ROUTES.overview); } }}
            whileHover={{ scale: 1.05 }}
          >
            ⚔️ Immortal&apos;s Log
          </motion.span>
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 rounded-xl border border-ink-light/55 bg-ink-mid/20 p-1.5">
            {primaryItems.map((item) => {
              const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.path)}
                  className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                    isActive
                      ? "border border-jade-glow/45 bg-jade-deep/28 text-cloud-white shadow-[var(--glow-subtle)]"
                      : "border border-transparent text-mist-light hover:border-jade-glow/20 hover:bg-ink-light/20 hover:text-cloud-white"
                  }`}
                >
                  <span className="text-[13px] leading-none">{item.icon}</span>
                  <span>{t(item.label, terminologyMode)}</span>
                </button>
              );
            })}
          </div>

          <div className="relative ml-auto" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen || undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition-all ${
                menuOpen
                  ? "border-jade-glow/45 bg-jade-deep/24 text-jade-light"
                  : "border-ink-light/55 bg-ink-mid/25 text-mist-light hover:border-jade-glow/30 hover:text-cloud-white"
              }`}
            >
              <span className="text-sm leading-none">☰</span>
              <span>More</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-72 rounded-xl border border-ink-light/60 bg-ink-deep/98 p-2 shadow-2xl backdrop-blur-md">
                <div className="space-y-1">
                  {secondaryItems.map((item) => {
                    const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => navigateTo(item.path)}
                        className={`w-full inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                          isActive
                            ? "border-jade-glow/45 bg-jade-deep/24 text-cloud-white"
                            : "border-transparent text-mist-light hover:border-jade-glow/25 hover:bg-ink-light/20 hover:text-cloud-white"
                        }`}
                      >
                        <span className="text-[13px] leading-none">{item.icon}</span>
                        <span>{t(item.label, terminologyMode)}</span>
                      </button>
                    );
                  })}

                  {adminItems.length > 0 && (
                    <div className="pt-2 mt-1 border-t border-gold/25">
                      <p className="px-2 pb-1 text-[10px] uppercase tracking-[0.14em] text-gold-dim">Admin</p>
                      {adminItems.map((item) => {
                        const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => navigateTo(item.path)}
                            className={`mt-1 w-full inline-flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.08em] transition-all ${
                              isActive
                                ? "border-gold/45 bg-gold-dim/18 text-gold"
                                : "border-transparent text-gold-dim hover:border-gold/35 hover:bg-gold-dim/10 hover:text-gold"
                            }`}
                          >
                            <span className="text-[13px] leading-none">{item.icon}</span>
                            <span>{t(item.label, terminologyMode)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-1.5 rounded-xl border border-ink-light/55 bg-ink-mid/20 px-2 py-1.5 shrink-0">
              <span className="text-xs text-mist-dark">🧑</span>
              <UserPhysiqueButton
                userId={user.id}
                userName={user.name}
                className="text-xs font-semibold text-cloud-white hover:text-jade-glow transition-colors truncate max-w-[140px]"
              />
            </div>
          )}

          {isAdmin && (
            <span className="shrink-0 px-2 py-1 rounded-full border border-gold/40 text-[10px] uppercase tracking-wide text-gold-dim">
              Admin
            </span>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default memo(DesktopNavBar);
