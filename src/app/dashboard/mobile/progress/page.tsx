"use client";

import { useEffect, useMemo, useState } from "react";
import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileSegmentedControl from "@/components/mobile/inputs/MobileSegmentedControl";
import MobileProgressRing from "@/components/mobile/progress/MobileProgressRing";
import { useAuth } from "@/context/AuthContext";
import { buildExerciseAnalytics } from "@/lib/exercise-analytics";

type Range = "week" | "month" | "year";

export default function MobileProgressPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<Range>("month");
  const [logs, setLogs] = useState<unknown[]>([]);

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      const res = await fetch("/api/progressions/logs/export", { cache: "no-store", credentials: "include" });
      const payload = await res.json().catch(() => []);
      setLogs(Array.isArray(payload) ? payload : []);
    };

    void run();
  }, [user?.id]);

  const summary = useMemo(() => {
    const analytics = buildExerciseAnalytics({
      logs: logs as Parameters<typeof buildExerciseAnalytics>[0]["logs"],
      tiers: [],
      currentLevel: 1,
    });
    const score = Math.min(100, Math.round((analytics.summaries.totalVolume / 10000) * 100));
    return {
      score,
      sessions: analytics.summaries.totalSessions,
      volume: Math.round(analytics.summaries.totalVolume),
    };
  }, [logs]);

  return (
    <div>
      <MobileHeader title="Progress" />
      <section className="mobile-content-stack space-y-6 p-4">
        <MobileSegmentedControl
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
            { value: "year", label: "Year" },
          ]}
        />

        <MobileCard>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-jade-glow">Cultivation Momentum</p>
              <p className="mt-1 text-sm text-cloud-white">Range: {range}</p>
            </div>
            <MobileProgressRing progress={summary.score} valueText={`${summary.score}%`} />
          </div>
        </MobileCard>

        <MobileCard>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-ink-light bg-ink-dark p-3">
              <p className="text-xs text-jade-glow uppercase tracking-wider">Sessions</p>
              <p className="text-xl font-bold text-cloud-white">{summary.sessions}</p>
            </div>
            <div className="rounded-xl border border-ink-light bg-ink-dark p-3">
              <p className="text-xs text-jade-glow uppercase tracking-wider">Total Volume</p>
              <p className="text-xl font-bold text-cloud-white">{summary.volume}</p>
            </div>
          </div>
        </MobileCard>
      </section>
    </div>
  );
}
