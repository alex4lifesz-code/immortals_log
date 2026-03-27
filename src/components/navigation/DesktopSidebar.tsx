"use client";

import { motion } from "framer-motion";
import { memo } from "react";
import { useAppContext } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter, usePathname } from "next/navigation";
import { t } from "@/lib/terminology";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

const ADMIN_NAV_IDS = new Set(["admin", "checkin"]);

function DesktopSidebar({ incomingFriendRequestCount = 0 }: { incomingFriendRequestCount?: number }) {
  const { getSortedNavItems, isMobile } = useAppContext();
  const { logout, user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode ?? "fantasy";
  const router = useRouter();
  const pathname = usePathname();
  const isAdmin = user?.role === "admin";
  const items = getSortedNavItems();
  const mainItems = items.filter((item) => !ADMIN_NAV_IDS.has(item.id));
  const orderedMainItems = [...mainItems].sort((a, b) => {
    const aPriority = a.id === "newsfeed" ? 0 : 1;
    const bPriority = b.id === "newsfeed" ? 0 : 1;
    return aPriority - bPriority;
  });
  const communityItem = orderedMainItems.find((item) => item.id === "newsfeed");
  const remainingMainItems = orderedMainItems.filter((item) => item.id !== "newsfeed");
  const adminItems = isAdmin ? items.filter((item) => ADMIN_NAV_IDS.has(item.id)) : [];

  // Hide only on mobile; keep desktop sidebar visible until mobile layout kicks in.
  if (isMobile) return null;

  return (
    <motion.aside
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="w-[264px] shrink-0 overflow-hidden border-r border-jade-glow/20 bg-gradient-to-b from-ink-deep via-ink-dark to-ink-deep"
    >
      <div className="relative flex h-full min-h-0 flex-col px-3 py-3">
      {communityItem && (
        <div className="mb-3 rounded-xl border border-ink-light/45 bg-ink-mid/20 p-1.5">
          <motion.button
            type="button"
            onClick={() => router.push(communityItem.path)}
            whileTap={{ scale: 0.985 }}
            className="group flex w-full items-center gap-2 rounded-lg border border-jade-glow/30 bg-ink-mid/20 px-2.5 py-2 text-left transition-all hover:border-jade-glow/45 hover:bg-jade-deep/20"
          >
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-jade-glow/35 bg-jade-deep/25 text-[11px]">
              {communityItem.icon}
            </span>
            <span className="text-sm font-bold tracking-[0.04em] text-jade-glow">{t(communityItem.label, terminologyMode)}</span>
          </motion.button>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
        <div className="space-y-1.5 rounded-xl border border-ink-light/45 bg-ink-mid/20 p-1.5">
        {remainingMainItems.map((item, index) => {
          const isActive = pathname === item.path;
          return (
            <motion.button
              key={item.id}
              type="button"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: index * 0.05 }}
              whileTap={{ scale: 0.985 }}
              className={`group relative flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-all duration-200 cursor-pointer ${
                isActive
                  ? "text-cloud-white border border-jade-glow/40 bg-jade-deep/35 shadow-[var(--glow-subtle)]"
                  : "text-mist-light hover:text-cloud-white hover:bg-ink-light/25 border border-transparent"
              }`}
              onClick={() => router.push(item.path)}
            >
              <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[15px] select-none ${
                isActive
                  ? "border-jade-glow/35 bg-jade-deep/50"
                  : "border-ink-light/40 bg-ink-deep/65"
              }`}>{item.icon}</span>
              <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-[0.1em] select-none">{t(item.label, terminologyMode)}</span>
              {item.id === "friends" && incomingFriendRequestCount > 0 && (
                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-crimson-light text-void-black text-[10px] font-bold flex items-center justify-center">
                  {incomingFriendRequestCount > 99 ? "99+" : incomingFriendRequestCount}
                </span>
              )}
              {item.pinned && (
                <span className="text-[10px] text-gold-dim">📌</span>
              )}
              {isActive && (
                <motion.div
                  layoutId="navIndicator"
                  className="h-6 w-1 rounded-full bg-jade-glow"
                />
              )}
            </motion.button>
          );
        })}
        </div>

        {adminItems.length > 0 && (
          <div className="mt-4 rounded-xl border border-gold/35 bg-gold/5 p-1.5">
            <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-gold-dim/90">Admin</p>
            <div className="space-y-1.5">
              {adminItems.map((item) => {
                const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.path)}
                    className={`w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-all duration-200 ${
                      isActive
                        ? "border-gold/45 bg-gold-dim/20 text-gold"
                        : "border-transparent text-gold-dim/90 hover:border-gold/30 hover:bg-gold-dim/10 hover:text-gold"
                    }`}
                  >
                    <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border text-[15px] select-none ${
                      isActive
                        ? "border-gold/45 bg-gold-dim/22"
                        : "border-ink-light/40 bg-ink-deep/65"
                    }`}>{item.icon}</span>
                    <span className="flex-1 text-left text-[11px] font-semibold uppercase tracking-[0.1em] select-none">{t(item.label, terminologyMode)}</span>
                    {isActive && <span className="h-6 w-1 rounded-full bg-gold/85" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 border-t border-ink-light/55 pt-3 space-y-2">
        {user && (
          <div className="mb-1 flex items-center gap-2 rounded-xl border border-ink-light/45 bg-ink-mid/20 px-2.5 py-2">
            <span className="text-xs">🧑</span>
            <UserPhysiqueButton
              userId={user.id}
              userName={user.name}
              className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-cloud-white hover:text-jade-glow transition-colors"
            />
          </div>
        )}
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 rounded-xl border border-transparent px-2.5 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-crimson-light/75 transition-all duration-200 hover:border-crimson/35 hover:bg-crimson-deep/20 hover:text-crimson-light"
        >
          <span>🚪</span>
          <span>Logout</span>
        </button>
        <p className="text-center text-[10px] text-mist-dark">
          The path of cultivation is long
        </p>
      </div>
      </div>
    </motion.aside>
  );
}

export default memo(DesktopSidebar);
