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

interface CheckInChartProps {
  checkInRows: CheckInRow[];
  currentMonth: Date;
  selectedUserIds: string[];
  userNames: Record<string, string>;
  userColors: Record<string, string>;
}

export default function CheckInChart({
  checkInRows,
  currentMonth,
  selectedUserIds,
  userNames,
  userColors,
}: CheckInChartProps) {
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

    const data: Record<string, unknown>[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateObj = new Date(year, month, d);
      if (dateObj > today) break;

      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const row = rowsByDate.get(dateStr);

      const point: Record<string, unknown> = { day: d, date: dateStr };
      for (const uid of selectedUserIds) {
        point[uid] = row?.entries[uid]?.present ? 1 : 0;
      }
      data.push(point);
    }

    return data;
  }, [checkInRows, currentMonth, selectedUserIds]);

  const totalDays = chartData.length;

  if (totalDays === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
        No data for this month
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between gap-3 px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
          Daily Check-ins
        </h4>
        <div className="flex items-center gap-3 text-[11px]">
          {selectedUserIds.map((uid) => {
            const count = chartData.filter((d) => d[uid] === 1).length;
            return (
              <span key={uid} style={{ color: userColors[uid] || "var(--jade-glow)" }}>
                {selectedUserIds.length > 1 ? `${userNames[uid] || "?"}: ` : ""}{count}/{totalDays}
              </span>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} vertical={false} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 1]}
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickFormatter={(v: number) => (v === 1 ? "✓" : "")}
              tickLine={false}
              axisLine={false}
              width={22}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 11,
                color: "var(--text-primary)",
              }}
              formatter={(value, name) => [
                value === 1 ? "✓ Present" : "✗ Absent",
                userNames[name as string] || name,
              ]}
              labelFormatter={(label) => `Day ${label}`}
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
                radius={[2, 2, 0, 0]}
                barSize={selectedUserIds.length > 1 ? 8 : 14}
                name={uid}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
