"use client";

import { motion, Reorder } from "framer-motion";
import { useState, memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter, usePathname } from "next/navigation";
import { NavItem } from "@/lib/constants";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

const ADMIN_NAV_IDS = new Set(["admin", "checkin"]);

function DesktopSidebar() {
  const { getSortedNavItems, isMobile, reorderNavItems } = useAppContext();
  const { logout, user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems();
  const mainItems = items.filter((item) => !ADMIN_NAV_IDS.has(item.id));
  const adminItems = isAdmin ? items.filter((item) => ADMIN_NAV_IDS.has(item.id)) : [];
  const [isDragging, setIsDragging] = useState(false);

  // Hide only on mobile; keep desktop sidebar visible until mobile layout kicks in.
  if (isMobile) return null;

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-[222px] bg-ink-deep border-r border-ink-light flex flex-col py-4 shrink-0 overflow-y-auto scrollbar-hide"
    >
      <div className="px-4 mb-4 flex items-center justify-between">
        <h2 className="text-xs text-mist-dark uppercase tracking-widest">Navigation</h2>
        <span className="text-[9px] text-mist-dark/60 italic">drag to reorder</span>
      </div>

      <Reorder.Group
        axis="y"
        values={mainItems}
        onReorder={(newOrder: NavItem[]) => {
          const adminTail = items.filter((item) => ADMIN_NAV_IDS.has(item.id));
          reorderNavItems([...newOrder, ...adminTail]);
        }}
        className="flex-1 px-2 space-y-1"
      >
        {mainItems.map((item, index) => {
          const isActive = pathname === item.path;
          return (
            <Reorder.Item
              key={item.id}
              value={item}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={() => setTimeout(() => setIsDragging(false), 100)}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              whileDrag={{
                scale: 1.03,
                boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
                zIndex: 50,
              }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 group cursor-grab active:cursor-grabbing ${
                isActive
                  ? "bg-jade-deep/50 text-jade-light border border-jade/30 glow-subtle"
                  : "text-mist-light hover:text-cloud-white hover:bg-ink-mid border border-transparent"
              }`}
              onClick={() => {
                if (!isDragging) router.push(item.path);
              }}
            >
              <span className="text-base select-none">{item.icon}</span>
              <span className="flex-1 text-left select-none">{t(item.label, terminologyMode)}</span>
              {item.pinned && (
                <span className="text-[10px] text-gold-dim">📌</span>
              )}
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="w-1 h-4 bg-jade-glow rounded-full"
                />
              )}
              <span className="text-mist-dark/40 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">⠿</span>
            </Reorder.Item>
          );
        })}

        {adminItems.length > 0 && (
          <div className="pt-3 mt-3 border-t border-ink-light/70">
            <p className="px-2 pb-2 text-[10px] uppercase tracking-widest text-gold-dim/80">Admin</p>
            <div className="space-y-1">
              {adminItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 border ${
                      isActive
                        ? "bg-gold-dim/20 text-gold border-gold/40"
                        : "text-gold-dim/90 hover:text-gold hover:bg-gold-dim/10 border-transparent"
                    }`}
                  >
                    <span className="text-base select-none">{item.icon}</span>
                    <span className="flex-1 text-left select-none">{t(item.label, terminologyMode)}</span>
                    {isActive && <span className="w-1 h-4 rounded-full bg-gold/80" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Reorder.Group>

      <div className="px-4 pt-4 border-t border-ink-light mt-4 space-y-2">
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
            <span className="text-xs">🧑</span>
            <UserPhysiqueButton
              userId={user.id}
              userName={user.name}
              className="text-xs text-cloud-white font-medium truncate hover:text-jade-glow transition-colors"
            />
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-crimson-light/70 hover:text-crimson-light hover:bg-crimson-deep/20 border border-transparent hover:border-crimson/30 transition-all duration-200"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
        <p className="text-[10px] text-mist-dark text-center">
          The path of cultivation is long
        </p>
      </div>
    </motion.aside>
  );
}

export default memo(DesktopSidebar);
