"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

function DesktopNavBar() {
  const { collapsed, topPanelExpanded, setTopPanelExpanded } = useAppContext();
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const elevated = false;
  const navItems = [
    { label: "Overview", href: "/dashboard/overview" },
    { label: "Workout", href: "/dashboard/workout" },
    { label: "Progress", href: "/dashboard/progression" },
    { label: "Library", href: "/dashboard/exercises" },
  ];

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
            className="h-2 w-20 rounded-b-full border-b border-jade-glow/45 bg-gradient-to-r from-jade-glow/70 to-mountain-blue-glow/60 shadow-lg shadow-jade-glow/25 hover:shadow-jade-glow/45 transition-shadow"
            animate={{ y: [0, 4, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      )}

      {/* Main Top Bar — desktop */}
      <motion.div
        initial={{ y: -64, opacity: 0 }}
        animate={{ y: topPanelExpanded ? 0 : -64, opacity: topPanelExpanded ? 1 : 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`h-14 bg-gradient-to-r from-ink-deep via-ink-dark to-ink-deep border-b border-jade-glow/25 flex items-center px-4 lg:px-5 gap-4 shrink-0 z-40 transition-shadow ${
          elevated ? "shadow-lg shadow-black/30" : ""
        }`}
      >
        {/* Logo and Title */}
        <motion.div
          whileHover={{ y: -1 }}
          className="group flex items-center gap-2 rounded-xl border border-jade-glow/30 bg-ink-mid/25 px-3 py-1.5"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-jade-glow/35 bg-jade-deep/25 text-[11px]">
            ⚔️
          </span>
          <motion.span
            className="text-jade-glow text-sm font-bold whitespace-nowrap tracking-[0.06em] cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => router.push("/dashboard/overview")}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push("/dashboard/overview"); } }}
            whileHover={{ scale: 1.02 }}
          >
            Immortal's Log
          </motion.span>
        </motion.div>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl border border-ink-light/45 bg-ink-mid/20 p-1">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => router.push(item.href)}
                className={`px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] rounded-lg transition-all ${
                  active
                    ? "text-cloud-white border border-jade-glow/40 bg-jade-deep/35 shadow-[var(--glow-subtle)]"
                    : "text-mist-light hover:text-cloud-white hover:bg-ink-light/25 border border-transparent"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end gap-2">
          {isAdmin && (
            <span className="px-2.5 py-1 rounded-full border border-gold/45 bg-gold/10 text-[10px] uppercase tracking-[0.12em] text-gold-dim">
              Admin
            </span>
          )}
          {user && (
            <div className="flex items-center gap-2 rounded-xl border border-ink-light/40 bg-ink-mid/25 pl-2 pr-2.5 py-1">
              <span className="text-xs text-mist-dark">🧑</span>
              <UserPhysiqueButton
                userId={user.id}
                userName={user.name}
                className="text-xs font-semibold uppercase tracking-[0.08em] text-cloud-white hover:text-jade-glow transition-colors"
              />
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default memo(DesktopNavBar);
