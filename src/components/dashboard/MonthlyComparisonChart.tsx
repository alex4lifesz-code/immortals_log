"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

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
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function MonthlyComparisonChart({
  checkInRows,
  currentMonth,
  selectedUserIds,
  userNames,
  userColors,
}: Props) {
  const chartData = useMemo(() => {
    const rowsByDate = new Map<string, CheckInRow>();
    for (const row of checkInRows) {
      rowsByDate.set(row.date, row);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Last 6 months including current
    const months: { year: number; month: number; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: MONTH_LABELS[d.getMonth()],
      });
    }

    return months.map(({ year, month, label }) => {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const point: Record<string, unknown> = { month: label };

      for (const uid of selectedUserIds) {
        let checkIns = 0;
        let totalDays = 0;

        for (let d = 1; d <= daysInMonth; d++) {
          const dateObj = new Date(year, month, d);
          if (dateObj > today) break;
          totalDays++;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const row = rowsByDate.get(dateStr);
          if (row?.entries[uid]?.present) checkIns++;
        }

        point[uid] = totalDays > 0 ? Math.round((checkIns / totalDays) * 100) : 0;
        point[`${uid}_raw`] = `${checkIns}/${totalDays}`;
      }

      return point;
    });
  }, [checkInRows, currentMonth, selectedUserIds]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
        No data yet
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
          Monthly Comparison
        </h4>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Check-in rate %
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={30}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 11,
                color: "var(--text-primary)",
              }}
              formatter={(value, name, props) => {
                const raw = props.payload?.[`${name}_raw`] || "";
                return [`${value}% (${raw})`, userNames[name as string] || name];
              }}
            />
            {selectedUserIds.length > 1 && (
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => userNames[value] || value}
              />
            )}
            {selectedUserIds.map((uid) => (
              <Bar
                key={uid}
                dataKey={uid}
                fill={userColors[uid] || "var(--jade-glow)"}
                fillOpacity={0.7}
                radius={[3, 3, 0, 0]}
                barSize={selectedUserIds.length > 1 ? 16 : 28}
                name={uid}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
