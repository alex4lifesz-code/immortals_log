"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, memo, useCallback, useRef } from "react";
import { useAppContext } from "@/context/AppContext";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import DisplaySettingsPopup from "@/components/workout/DisplaySettingsPopup";
import { t } from "@/lib/terminology";

interface Stats {
  xp: number;
  streak: number;
  realm: string;
  sessions: number;
}

function TopBar() {
  const { getSortedNavItems, collapsed, isMobile, topPanelExpanded, setTopPanelExpanded } = useAppContext();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const gamificationVisible = settings.gamificationVisible ?? true;
  const router = useRouter();
  const pathname = usePathname();
  const items = getSortedNavItems();
  const [stats, setStats] = useState<Stats>({ xp: 0, streak: 0, realm: "Mortal", sessions: 0 });
  const [loading, setLoading] = useState(true);
  const [elevated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;

    // Cancel previous in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const [expRes, workoutRes, checkinsRes] = await Promise.all([
        fetch(`/api/users/experience?userId=${encodeURIComponent(user.id)}`, { signal: controller.signal }),
        fetch(`/api/workouts?userId=${encodeURIComponent(user.id)}`, { signal: controller.signal }),
        fetch("/api/checkins", { signal: controller.signal }),
      ]);
      const [expData, workoutData, checkinsData] = await Promise.all([
        expRes.json(),
        workoutRes.json(),
        checkinsRes.json(),
      ]);

      const userExp = expData.user?.experience || 0;
      const userWorkouts = workoutData.workouts || [];

      const dates = new Set<string>();
      for (const checkin of checkinsData.checkins || []) {
        if (checkin.present) {
          dates.add(checkin.date.split("T")[0]);
        }
      }

      // Calculate streak
      const today = new Date();
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(checkDate.getDate() - i);
        const dateStr = checkDate.toISOString().split("T")[0];
        if (dates.has(dateStr)) {
          streak++;
        } else if (i > 0) {
          break;
        }
      }

      const realms = ["Mortal", "Foundation Establishment", "Core Formation", "Nascent Soul", "Soul Splitting", "Tribulation Transcendence", "Immortal"];
      const xpThresholds = [0, 100, 300, 600, 1200, 2000, 3500];
      let currentRealm = "Mortal";
      for (let i = xpThresholds.length - 1; i >= 0; i--) {
        if (userExp >= xpThresholds[i]) {
          currentRealm = realms[i];
          break;
        }
      }

      setStats({ xp: userExp, streak, realm: currentRealm, sessions: userWorkouts.length });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("Failed to fetch stats:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats]);

  // Mobile: collapsed Quick View panel with scroll-based elevation
  if (collapsed) {
    // When gamification is hidden, don't render the mobile stats panel at all
    if (!gamificationVisible) return null;
    return (
      <>
        <AnimatePresence>
          {topPanelExpanded && (
            <motion.div
              key="stats-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-30"
              onClick={() => setTopPanelExpanded(false)}
            />
          )}
          {topPanelExpanded && (
            <motion.div
              key="stats-panel"
              initial={{ y: -200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -200, opacity: 0 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="bg-ink-deep/98 backdrop-blur-lg border-b border-jade-glow/10 p-4 z-40 relative"
            >
              <div className="flex justify-between items-center mb-3">
                <span className="text-jade-glow text-sm font-bold tracking-wider flex items-center gap-1.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Quick View
                </span>
                <motion.button
                  onClick={() => setTopPanelExpanded(false)}
                  whileTap={{ scale: 0.9 }}
                  className="p-2 rounded-xl text-mist-light active:text-crimson-glow min-w-[40px] min-h-[40px] flex items-center justify-center"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                <div className="bg-ink-mid/80 p-2.5 rounded-xl border border-ink-light/50 text-center">
                  <div className="text-[10px] text-mist-dark mb-0.5">✨ XP</div>
                  <div className="text-jade-glow font-bold text-sm">{loading ? "…" : stats.xp}</div>
                </div>
                <div className="bg-ink-mid/80 p-2.5 rounded-xl border border-ink-light/50 text-center">
                  <div className="text-[10px] text-mist-dark mb-0.5">🏔️ Realm</div>
                  <div className="text-gold-glow font-bold text-[11px]">{loading ? "…" : stats.realm}</div>
                </div>
                <div className="bg-ink-mid/80 p-2.5 rounded-xl border border-ink-light/50 text-center">
                  <div className="text-[10px] text-mist-dark mb-0.5">🔥 Streak</div>
                  <div className="text-crimson-glow font-bold text-sm">{loading ? "…" : stats.streak}d</div>
                </div>
                <div className="bg-ink-mid/80 p-2.5 rounded-xl border border-ink-light/50 text-center">
                  <div className="text-[10px] text-mist-dark mb-0.5">⚔️ Sess.</div>
                  <div className="text-stone-glow font-bold text-sm">{loading ? "…" : stats.sessions}</div>
                </div>
              </div>

              {/* Sections */}
              <div className="space-y-2">
                <div className="bg-ink-mid/60 p-3 rounded-xl border border-ink-light/30">
                  <h3 className="text-xs text-jade-glow mb-2 font-medium">Today&apos;s Cultivation</h3>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="flex flex-col items-center">
                      <span className="text-mist-dark text-[10px]">Sessions</span>
                      <span className="text-cloud-white font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-mist-dark text-[10px]">Exercises</span>
                      <span className="text-cloud-white font-bold">0</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-mist-dark text-[10px]">Duration</span>
                      <span className="text-cloud-white font-bold">0m</span>
                    </div>
                  </div>
                </div>

                <div className="bg-ink-mid/60 p-3 rounded-xl border border-ink-light/30">
                  <h3 className="text-xs text-gold mb-2 font-medium">Cultivation Realm</h3>
                  <div className="text-center py-1">
                    <span className="text-base text-gold-glow">{loading ? "…" : stats.realm}</span>
                    <div className="mt-1.5 w-full bg-ink-dark rounded-full h-1.5">
                      <div className="bg-jade-glow h-1.5 rounded-full transition-all" style={{ width: "10%" }} />
                    </div>
                    <p className="text-[10px] text-mist-dark mt-1">Progress to next realm</p>
                  </div>
                </div>

                <div className="bg-ink-mid/60 p-3 rounded-xl border border-ink-light/30">
                  <h3 className="text-xs text-mountain-blue-glow mb-2 font-medium">Recent Activity</h3>
                  <p className="text-xs text-mist-dark italic">No recent cultivation records</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
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
            onClick={() => router.push("/dashboard")}
            whileHover={{ scale: 1.05 }}
          >
            ⚔️ Immortals Log
          </motion.span>
        </div>

        {/* Navigation Items — desktop only */}
        {!isMobile && (
          <div className="flex items-center gap-1">
            {items.slice(0, 4).map((item) => (
              <motion.button
                key={item.id}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => router.push(item.path)}
                className={`px-3 py-1 text-xs rounded-md transition-all duration-200 whitespace-nowrap ${
                  pathname === item.path
                    ? "bg-jade-deep text-jade-light glow-subtle"
                    : "text-mist-light hover:text-cloud-white hover:bg-ink-mid"
                }`}
              >
                {item.icon} {t(item.label, settings.terminologyMode ?? "fantasy")}
              </motion.button>
            ))}
          </div>
        )}

        {/* Stats Display */}
        <div className="flex-1 flex items-center justify-end gap-3 border-l border-ink-light pl-3">
          <DisplaySettingsPopup />
          <div className="h-5 w-px bg-ink-light" />

          {user && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-mist-dark">🧑</span>
                <span className="text-xs font-semibold text-cloud-white">{user.name}</span>
              </div>
              <div className="h-5 w-px bg-ink-light" />
            </>
          )}

          {loading ? (
            <div className="text-xs text-mist-dark animate-pulse">Loading…</div>
          ) : (
            <>
              {gamificationVisible && (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-mist-dark">✨ XP:</span>
                    <span className="text-xs font-bold text-jade-glow">{stats.xp}</span>
                  </div>
                  <div className="h-5 w-px bg-ink-light" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-mist-dark">🏔️ Realm:</span>
                    <span className="text-xs font-bold text-gold-glow">{stats.realm}</span>
                  </div>
                  <div className="h-5 w-px bg-ink-light" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-mist-dark">🔥 Streak:</span>
                    <span className="text-xs font-bold text-crimson-glow">{stats.streak} days</span>
                  </div>
                  <div className="h-5 w-px bg-ink-light" />
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-mist-dark">⚔️ Sessions:</span>
                    <span className="text-xs font-bold text-stone-glow">{stats.sessions}</span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

export default memo(TopBar);
