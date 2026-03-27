"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

function TopBar() {
  const { collapsed, topPanelExpanded, setTopPanelExpanded } = useAppContext();
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const elevated = false;

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
            className="w-16 h-2 bg-gradient-to-r from-jade-glow/60 to-jade-light/60 rounded-b-full border-b border-jade-glow/40"
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
        className={`h-12 bg-gradient-to-r from-ink-deep to-ink-dark border-b border-jade-glow/20 flex items-stretch px-3 gap-2 shrink-0 overflow-x-auto z-40 ${
          elevated ? "shadow-lg shadow-black/30" : ""
        }`}
      >
        {/* Logo and Title */}
        <div className="flex items-center pr-2 border-r border-ink-light">
          <motion.span 
            className="text-jade-glow text-xs font-bold whitespace-nowrap tracking-wider cursor-pointer"
            role="link"
            tabIndex={0}
            onClick={() => router.push("/dashboard/overview")}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push("/dashboard/overview"); } }}
            whileHover={{ scale: 1.05 }}
          >
            ⚔️ Immortal's Log
          </motion.span>
        </div>

        {/* Right section */}
        <div className="flex-1 flex items-center justify-end gap-3 border-l border-ink-light pl-3">
          {isAdmin && (
            <span className="px-2 py-0.5 rounded-full border border-gold/40 text-[10px] uppercase tracking-wide text-gold-dim">
              Admin
            </span>
          )}
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
