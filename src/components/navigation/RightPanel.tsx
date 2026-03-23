"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { t } from "@/lib/terminology";
import PresetSlots from "@/components/ui/PresetSlots";
import { memo, useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api-client";

interface QuickStats {
  todaySessions: number;
  todayExercises: number;
  recentLogs: { name: string; date: string }[];
}

function RightPanel() {
  const { collapsed, isMobile } = useAppContext();
  const { settings, updateSettings } = useDisplaySettings();
  const { user } = useAuth();
  const visible = settings.rightPanelVisible;
  const terminologyMode = settings.terminologyMode ?? "fantasy";

  const [stats, setStats] = useState<QuickStats>({ todaySessions: 0, todayExercises: 0, recentLogs: [] });
  const abortRef = useRef<AbortController | null>(null);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const data = await api.get<{ logs: { exerciseName: string; createdAt: string }[] }>("/api/progressions/logs/export", { signal: controller.signal });
      const logs = data.logs || [];
      const todayStr = new Date().toISOString().split("T")[0];
      const todayLogs = logs.filter(l => l.createdAt && l.createdAt.split("T")[0] === todayStr);
      const uniqueTodayExercises = new Set(todayLogs.map(l => l.exerciseName)).size;
      setStats({
        todaySessions: todayLogs.length,
        todayExercises: uniqueTodayExercises,
        recentLogs: logs.slice(-3).reverse().map(l => ({ name: l.exerciseName, date: l.createdAt })),
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }, [user]);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void fetchStats();
    }, 0);
    const interval = window.setInterval(() => {
      void fetchStats();
    }, 120000);
    return () => {
      window.clearTimeout(initialTimer);
      clearInterval(interval);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchStats]);

  // On mobile, the Quick View panel is handled by PageLayout slide-in
  if (isMobile) return null;

  // Hide when nav collapsed on desktop (no room)
  if (collapsed && !isMobile) return null;

  return (
    <div className="relative flex shrink-0">
      {/* Collapse / Expand toggle tab */}
      <button
        onClick={() => updateSettings({ rightPanelVisible: !visible })}
        aria-label={visible ? "Hide Quick View panel" : "Show Quick View panel"}
        aria-expanded={visible}
        aria-controls="right-panel"
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
            id="right-panel"
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
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="ink-border rounded-lg p-3 bg-ink-dark">
                  <h3 className="text-xs text-mountain-blue-glow mb-2">{t("Recent Activity", terminologyMode)}</h3>
                  {stats.recentLogs.length === 0 ? (
                    <div className="flex flex-col items-center py-3 text-center">
                      <div className="text-xl opacity-30 mb-1">📜</div>
                      <p className="text-[10px] text-mist-dark">
                        No recent cultivation records
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {stats.recentLogs.map((l, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="text-mist-light truncate mr-2">{l.name}</span>
                          <span className="text-mist-dark whitespace-nowrap text-[10px]">
                            {new Date(l.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
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
