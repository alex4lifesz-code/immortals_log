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
  Cell,
} from "recharts";

interface CheckInRow {
  date: string;
  entries: Record<string, { present: boolean; weight: string; comment: string }>;
}

interface Props {
  checkInRows: CheckInRow[];
  currentMonth: Date;
  userId: string;
}

export default function WeeklyConsistencyChart({ checkInRows, currentMonth, userId }: Props) {
  const chartData = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rowsByDate = new Map<string, CheckInRow>();
    for (const row of checkInRows) {
      rowsByDate.set(row.date, row);
    }

    const weeks: { week: string; checkIns: number; total: number }[] = [];
    let weekNum = 1;
    let checkIns = 0;
    let total = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      if (dateObj > today) break;

      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const row = rowsByDate.get(dateStr);
      const entry = row?.entries[userId];

      if (entry?.present) checkIns++;
      total++;

      // End of week (Saturday) or end of month
      if (dateObj.getDay() === 6 || d === daysInMonth || dateObj >= today) {
        weeks.push({ week: `W${weekNum}`, checkIns, total });
        weekNum++;
        checkIns = 0;
        total = 0;
      }
    }

    return weeks;
  }, [checkInRows, currentMonth, userId]);

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
          Weekly Consistency
        </h4>
        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          Check-ins / week
        </span>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={24}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 11,
                color: "var(--text-primary)",
              }}
              formatter={(value, _name, props) => {
                const t = props.payload?.total ?? 0;
                return [`${value} / ${t} days`, "Check-ins"];
              }}
            />
            <Bar dataKey="checkIns" radius={[3, 3, 0, 0]} barSize={28}>
              {chartData.map((entry, i) => {
                const rate = entry.total > 0 ? entry.checkIns / entry.total : 0;
                const fill = rate >= 0.8 ? "var(--jade-glow)" : rate >= 0.5 ? "var(--chart-secondary)" : "var(--crimson-glow)";
                return <Cell key={i} fill={fill} fillOpacity={0.7} />;
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
