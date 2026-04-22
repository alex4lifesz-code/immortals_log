"use client";

import { useMemo } from "react";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatCalendarMonthLabel } from "@/lib/constants";
import { t, tHint } from "@/lib/terminology";

interface CheckInRow {
  date: string;
  entries: Record<string, { present: boolean; weight: string; comment: string }>;
}

interface Props {
  checkInRows: CheckInRow[];
  currentMonth: Date;
  selectedUserIds: string[];
  userNames: Record<string, string>;
  userColors: Record<string, string>;
  currentUserId: string;
}

export default function CheckInStatsPanel({
  checkInRows,
  currentMonth,
  selectedUserIds,
  userNames,
  userColors,
  currentUserId,
}: Props) {
  const { settings } = useDisplaySettings();
  const stats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rowsByDate = new Map<string, CheckInRow>();
    for (const row of checkInRows) rowsByDate.set(row.date, row);

    const result: {
      userId: string;
      name: string;
      color: string;
      monthCheckIns: number;
      monthDays: number;
      monthRate: number;
      currentStreak: number;
      bestStreak: number;
      totalCheckIns: number;
      latestWeight: string | null;
      weightChange: string | null;
    }[] = [];

    for (const uid of selectedUserIds) {
      // Month stats
      let monthCheckIns = 0;
      let monthDays = 0;
      const monthWeights: number[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        const dateObj = new Date(year, month, d);
        if (dateObj > today) break;
        monthDays++;
        const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        const row = rowsByDate.get(dateStr);
        const entry = row?.entries[uid];
        if (entry?.present) monthCheckIns++;
        if (entry?.weight) {
          const w = parseFloat(entry.weight);
          if (!isNaN(w) && w > 0) monthWeights.push(w);
        }
      }

      // All-time: streaks and total
      const sortedDates = [...checkInRows]
        .sort((a, b) => a.date.localeCompare(b.date));

      let totalCheckIns = 0;
      let currentStreak = 0;
      let bestStreak = 0;
      let tempStreak = 0;
      let latestWeight: string | null = null;
      let firstWeight: number | null = null;
      let lastWeight: number | null = null;

      for (const row of sortedDates) {
        const entry = row.entries[uid];
        if (entry?.present) {
          totalCheckIns++;
          tempStreak++;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }

        if (entry?.weight) {
          const w = parseFloat(entry.weight);
          if (!isNaN(w) && w > 0) {
            if (firstWeight === null) firstWeight = w;
            lastWeight = w;
            latestWeight = `${w} kg`;
          }
        }
      }

      // Current streak = count backwards from today
      currentStreak = 0;
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const dateSet = new Set(
        checkInRows
          .filter((r) => r.entries[uid]?.present)
          .map((r) => r.date)
      );
      const d = new Date(today);
      // If not checked in today, start from yesterday
      if (!dateSet.has(todayStr)) d.setDate(d.getDate() - 1);
      while (true) {
        const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (dateSet.has(ds)) {
          currentStreak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }

      let weightChange: string | null = null;
      if (firstWeight !== null && lastWeight !== null && firstWeight !== lastWeight) {
        const diff = lastWeight - firstWeight;
        weightChange = `${diff > 0 ? "+" : ""}${diff.toFixed(1)} kg`;
      }

      result.push({
        userId: uid,
        name: userNames[uid] || "Unknown",
        color: userColors[uid] || "var(--jade-glow)",
        monthCheckIns,
        monthDays,
        monthRate: monthDays > 0 ? Math.round((monthCheckIns / monthDays) * 100) : 0,
        currentStreak,
        bestStreak,
        totalCheckIns,
        latestWeight,
        weightChange,
      });
    }

    return result;
  }, [checkInRows, currentMonth, selectedUserIds, userNames, userColors]);

  if (stats.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
        <span title={tHint("No data yet", "normal") ?? undefined}>{t("No data yet", "normal")}</span>
      </div>
    );
  }

  const monthName = formatCalendarMonthLabel(currentMonth, settings.timeZone).replace(/\s+\d{4}$/, "");

  return (
    <div className="dao-modern-monthly-stats-panel flex flex-col h-full gap-2 overflow-y-auto">
      <div className="flex items-center justify-between px-1">
        <h4
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--text-primary)" }}
          title={tHint("Statistics", "normal") ?? undefined}
        >
          {monthName} {t("Statistics", "normal")}
        </h4>
      </div>

      <div className="space-y-3">
        {stats.map((s) => (
          <div key={s.userId} className="dao-modern-monthly-stats-user space-y-1.5">
            {/* User label header (show when multiple users) */}
            {stats.length > 1 && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-[11px] font-semibold" style={{ color: s.color }}>{s.name}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              {/* Month check-in rate */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("Check-in Rate", "normal") ?? undefined}>{t("Check-in Rate", "normal")}</span>
                <span className="font-semibold" style={{ color: s.monthRate >= 80 ? "var(--accent)" : s.monthRate >= 50 ? "var(--gold-glow)" : "var(--crimson-glow)" }}>
                  {s.monthRate}%
                </span>
              </div>

              {/* Month check-ins */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("Days Checked In", "normal") ?? undefined}>{t("Days Checked In", "normal")}</span>
                <span style={{ color: "var(--text-primary)" }}>{s.monthCheckIns}/{s.monthDays}</span>
              </div>

              {/* Current streak */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("Streak", "normal") ?? undefined}>{t("Streak", "normal")}</span>
                <span className="font-semibold" style={{ color: "var(--accent)" }}>
                  {s.currentStreak}d
                </span>
              </div>

              {/* Best streak */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("Best Streak", "normal") ?? undefined}>{t("Best Streak", "normal")}</span>
                <span style={{ color: "var(--text-primary)" }}>{s.bestStreak}d</span>
              </div>

              {/* Total all-time */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("All-time", "normal") ?? undefined}>{t("All-time", "normal")}</span>
                <span style={{ color: "var(--text-primary)" }}>{s.totalCheckIns} {t("days", "normal")}</span>
              </div>

              {/* Latest weight */}
              <div className="flex justify-between">
                <span style={{ color: "var(--text-secondary)" }} title={tHint("Weight", "normal") ?? undefined}>{t("Weight", "normal")}</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {s.latestWeight || "–"}
                  {s.weightChange && (
                    <span className="ml-1" style={{ color: s.weightChange.startsWith("+") ? "var(--crimson-glow)" : "var(--jade-glow)" }}>
                      ({s.weightChange})
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Divider between users */}
            {stats.length > 1 && s.userId !== stats[stats.length - 1].userId && (
              <div className="border-t mt-1" style={{ borderColor: "var(--border)" }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
