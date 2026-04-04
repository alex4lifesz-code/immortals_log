"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter, usePathname } from "next/navigation";
import { memo, useCallback, useEffect, useRef } from "react";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

const ADMIN_NAV_IDS = new Set(["admin", "checkin"]);

function FloatingMobileSidebar() {
  const { getSortedNavItems, isMobile, mobileSidebarOpen, setMobileSidebarOpen } = useAppContext();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems().filter((item) => (isAdmin ? true : !ADMIN_NAV_IDS.has(item.id)));
  const mainItems = items.filter((item) => !ADMIN_NAV_IDS.has(item.id));
  const adminItems = isAdmin ? items.filter((item) => ADMIN_NAV_IDS.has(item.id)) : [];
  const touchStartXRef = useRef<number | null>(null);
  const touchCurrentXRef = useRef<number | null>(null);

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

  const onSidebarTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    touchCurrentXRef.current = touchStartXRef.current;
  };

  const onSidebarTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    touchCurrentXRef.current = event.touches[0]?.clientX ?? null;
  };

  const onSidebarTouchEnd = () => {
    const start = touchStartXRef.current;
    const end = touchCurrentXRef.current;
    touchStartXRef.current = null;
    touchCurrentXRef.current = null;
    if (start == null || end == null) return;
    if (end - start < -48) {
      handleClose();
    }
  };

  if (!isMobile) return null;

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
            className="fixed inset-0 bg-void-black/70 z-30"
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
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.06, right: 0 }}
            onDragEnd={(_event, info) => {
              if (info.offset.x < -70 || info.velocity.x < -380) {
                handleClose();
              }
            }}
            transition={{ type: "spring", damping: 28, stiffness: 300, mass: 0.8 }}
            className="fixed left-0 top-0 z-40 h-screen flex flex-col bg-ink-deep/98 border-r border-jade-glow/15 shadow-2xl overflow-hidden touch-pan-y pt-[max(env(safe-area-inset-top,0px),12px)]"
            style={{ width: "min(92vw, 420px)" }}
            onTouchStart={onSidebarTouchStart}
            onTouchMove={onSidebarTouchMove}
            onTouchEnd={onSidebarTouchEnd}
          >
            {/* Header */}
            <div className="px-5 pb-4 border-b border-ink-light/50 flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base text-jade-glow font-bold tracking-[0.12em] uppercase">
                  ⚔ Navigation
                </h2>
                {user && (
                  <p className="text-xs text-mist-light mt-0.5 truncate">{user.name}</p>
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

            {user && (
              <div className="mx-4 mt-3 mb-2 rounded-xl border border-jade-glow/20 bg-ink-mid/35 px-4 py-3">
                <p className="text-[10px] uppercase tracking-[0.12em] text-mist-dark mb-1">Body Profile</p>
                <UserPhysiqueButton
                  userId={user.id}
                  userName="Update Weight & Gender"
                  className="text-sm font-semibold text-jade-light hover:text-jade-glow transition-colors"
                />
              </div>
            )}

            {/* Navigation Items — scrollable */}
            <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1.5 overscroll-contain">
              {mainItems.map((item, index) => {
                const isActive = pathname === item.path;
                return (
                  <motion.button
                    key={item.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.03, type: "spring", stiffness: 400, damping: 30 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-base transition-colors min-h-[56px] ${
                      isActive
                        ? "bg-jade-deep/40 text-jade-light border border-jade/20 shadow-sm"
                        : "text-mist-light active:text-cloud-white active:bg-ink-mid/60 border border-transparent"
                    }`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    <span className="text-xl flex-shrink-0 w-8 text-center">{item.icon}</span>
                    <span className="flex-1 text-left font-medium">{t(item.label, terminologyMode)}</span>
                    {item.pinned && <span className="text-[10px] text-gold-dim flex-shrink-0">📌</span>}
                    {isActive && (
                      <div className="w-1.5 h-1.5 bg-jade-glow rounded-full flex-shrink-0" />
                    )}
                  </motion.button>
                );
              })}

              {adminItems.length > 0 && (
                <div className="pt-3 mt-3 border-t border-ink-light/60">
                  <p className="px-2 pb-2 text-[10px] uppercase tracking-[0.12em] text-gold-dim/85">Admin</p>
                  <div className="space-y-1.5">
                    {adminItems.map((item, index) => {
                      const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                      return (
                        <motion.button
                          key={item.id}
                          initial={{ x: -20, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          transition={{ delay: (mainItems.length + index) * 0.03, type: "spring", stiffness: 400, damping: 30 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => handleNavigate(item.path)}
                          className={`w-full flex items-center gap-3 px-4 py-4 rounded-xl text-base transition-colors min-h-[56px] border ${
                            isActive
                              ? "bg-gold-dim/20 text-gold border-gold/45"
                              : "text-gold-dim active:text-gold active:bg-gold-dim/15 border-gold/20"
                          }`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          <span className="text-xl flex-shrink-0 w-8 text-center">{item.icon}</span>
                          <span className="flex-1 text-left font-medium">{t(item.label, terminologyMode)}</span>
                          {isActive && <div className="w-1.5 h-1.5 bg-gold rounded-full flex-shrink-0" />}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}
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
