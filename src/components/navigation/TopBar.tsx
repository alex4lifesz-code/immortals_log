"use client";

import { motion } from "framer-motion";
import { useState, useEffect, memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";
import { t } from "@/lib/terminology";

function TopBar() {
  const { getSortedNavItems, collapsed, isMobile, topPanelExpanded, setTopPanelExpanded } = useAppContext();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems().filter(item => (item.id !== "admin" || isAdmin));
  const [isCompactDesktop, setIsCompactDesktop] = useState(false);
  const [elevated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateCompactDesktop = () => {
      setIsCompactDesktop(window.innerWidth <= 1280);
    };

    updateCompactDesktop();
    window.addEventListener("resize", updateCompactDesktop);
    return () => window.removeEventListener("resize", updateCompactDesktop);
  }, []);

  const visibleDesktopItems = isCompactDesktop ? items : items.slice(0, 4);

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
        className={`h-12 bg-gradient-to-r from-ink-deep to-ink-dark border-b border-jade-glow/20 flex items-stretch px-3 gap-2 shrink-0 overflow-x-auto z-40 transition-shadow ${
          elevated ? "shadow-lg shadow-black/30" : ""
        }`}
      >
        {/* Logo and Title */}
        <div className="flex items-center pr-2 border-r border-ink-light">
          <motion.span 
            className="text-jade-glow text-xs font-bold whitespace-nowrap tracking-wider cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => router.push("/dashboard")}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push("/dashboard"); } }}
            whileHover={{ scale: 1.05 }}
          >
            ⚔️ Immortal's Log
          </motion.span>
        </div>

        {/* Navigation Items — desktop only */}
        {!isMobile && (
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            {visibleDesktopItems.map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(item.path)}
                aria-current={pathname === item.path ? "page" : undefined}
                className={`px-3 py-1 text-xs rounded-md transition-all duration-200 whitespace-nowrap ${
                  pathname === item.path
                    ? "bg-jade-deep text-jade-light glow-subtle"
                    : "text-mist-light hover:text-cloud-white hover:bg-ink-mid"
                }`}
              >
                {item.icon} {t(item.label, settings.terminologyMode ?? "fantasy")}
              </motion.button>
            ))}
          </nav>
        )}

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end gap-3 border-l border-ink-light pl-3">
          {user && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-mist-dark">🧑</span>
              <UserPhysiqueButton
                userId={user.id}
                userName={user.name}
                className="text-xs font-semibold text-cloud-white hover:text-jade-glow transition-colors"
              />
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default memo(TopBar);
