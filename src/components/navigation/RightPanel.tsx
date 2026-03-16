"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/terminology";
import { getCurrentRealm, getExperiencePercentage } from "@/lib/experience";
import PresetSlots from "@/components/ui/PresetSlots";
import { memo, useState, useEffect, useCallback, useRef } from "react";

interface QuickStats {
  xp: number;
  todaySessions: number;
  todayExercises: number;
  recentWorkouts: { name: string; date: string }[];
}

function RightPanel() {
  const { collapsed, isMobile } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const { user } = useAuth();
  const visible = settings.rightPanelVisible;
  const gamificationVisible = settings.gamificationVisible ?? true;
  const terminologyMode = settings.terminologyMode ?? "fantasy";

  const [stats, setStats] = useState<QuickStats>({ xp: 0, todaySessions: 0, todayExercises: 0, recentWorkouts: [] });
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const [expRes, workoutRes] = await Promise.all([
        fetch(`/api/users/experience?userId=${encodeURIComponent(user.id)}`, { signal: controller.signal }),
        fetch(`/api/workouts?userId=${encodeURIComponent(user.id)}`, { signal: controller.signal }),
      ]);
      const [expData, workoutData] = await Promise.all([expRes.json(), workoutRes.json()]);
      const userExp = expData.user?.experience || 0;
      const workouts: { name: string; date: string }[] = (workoutData.workouts || []);
      const todayStr = new Date().toISOString().split("T")[0];
      const todayWorkouts = workouts.filter(w => w.date && w.date.split("T")[0] === todayStr);
      setStats({
        xp: userExp,
        todaySessions: todayWorkouts.length,
        todayExercises: todayWorkouts.length, // Each workout is one exercise session
        recentWorkouts: workouts.slice(0, 3).map(w => ({ name: w.name, date: w.date })),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, [user]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async data fetch sets state in callback
    fetchStats();
    const interval = setInterval(fetchStats, 120000);
    return () => {
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats]);

  // Hide entire panel when gamification is disabled
  if (!gamificationVisible) return null;

  // On mobile, the Quick View panel is handled by PageLayout slide-in
  if (isMobile) return null;

  // Hide when nav collapsed on desktop (no room)
  if (collapsed && !isMobile) return null;

  const realm = getCurrentRealm(stats.xp);
  const realmProgress = getExperiencePercentage(stats.xp);

  return (
    <div className="relative flex shrink-0">
      {/* Collapse / Expand toggle tab */}
      <button
        onClick={() => updateSettings({ rightPanelVisible: !visible })}
        className="absolute -left-4 top-1/2 -translate-y-1/2 z-30 w-4 h-10 bg-ink-dark border border-ink-light rounded-l flex items-center justify-center hover:bg-ink-mid transition-colors group"
        title={visible ? "Hide Quick View" : "Show Quick View"}
      >
        <svg
          className={`w-3 h-3 text-mist-dark group-hover:text-jade-glow transition-transform ${visible ? "rotate-0" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      <AnimatePresence mode="wait">
        {visible && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="bg-ink-deep border-l border-ink-light flex flex-col py-4 overflow-hidden"
          >
            <div className="w-64 min-w-[16rem]">
              <div className="px-4 mb-4">
                <h2 className="text-xs text-mist-dark uppercase tracking-widest">Quick View</h2>
              </div>

              <div className="px-4 space-y-4 overflow-y-auto scrollbar-hide" style={{ maxHeight: "calc(100vh - 5rem)" }}>
                {/* Today's Cultivation */}
                <div className="ink-border rounded-lg p-3 bg-ink-dark">
                  <h3 className="text-xs text-jade-glow mb-2">{t("Today's Cultivation", terminologyMode)}</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-mist-light">Sessions</span>
                      <span className="text-cloud-white">{stats.todaySessions}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-mist-light">Exercises</span>
                      <span className="text-cloud-white">{stats.todayExercises}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-mist-light">Total XP</span>
                      <span className="text-cloud-white">{stats.xp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Cultivation Level */}
                <div className="ink-border rounded-lg p-3 bg-ink-dark">
                  <h3 className="text-xs text-gold mb-2">{t("Cultivation Realm", terminologyMode)}</h3>
                  <div className="text-center py-2">
                    <span className="text-lg text-gold-glow animate-glow-pulse">{realm.name}</span>
                    <div className="mt-2 w-full bg-ink-mid rounded-full h-1.5">
                      <div
                        className="bg-jade-glow h-1.5 rounded-full transition-all"
                        style={{ width: `${realmProgress}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-mist-dark mt-1">
                      {realmProgress}% progress
                    </p>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="ink-border rounded-lg p-3 bg-ink-dark">
                  <h3 className="text-xs text-mountain-blue-glow mb-2">{t("Recent Activity", terminologyMode)}</h3>
                  {stats.recentWorkouts.length === 0 ? (
                    <p className="text-xs text-mist-dark italic">
                      No recent cultivation records
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.recentWorkouts.map((w, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-mist-light truncate mr-2">{w.name}</span>
                          <span className="text-mist-dark whitespace-nowrap text-[10px]">
                            {new Date(w.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Saved Presets */}
                <PresetSlots variant="sidebar" />
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}

export default memo(RightPanel);
