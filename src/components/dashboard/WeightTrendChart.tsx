"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
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
  selectedUserIds: string[];
  userNames: Record<string, string>;
  userColors: Record<string, string>;
}

export default function WeightTrendChart({
  checkInRows,
  selectedUserIds,
  userNames,
  userColors,
}: Props) {
  const { chartData, avgWeights, minW, maxW } = useMemo(() => {
    const sorted = [...checkInRows].sort((a, b) => a.date.localeCompare(b.date));

    const points: Record<string, unknown>[] = [];
    const sums: Record<string, number> = {};
    const counts: Record<string, number> = {};

    for (const row of sorted) {
      let hasWeight = false;
      const point: Record<string, unknown> = { date: row.date };
      const parts = row.date.split("-");
      point.label = `${parts[2]}/${parts[1]}`;

      for (const uid of selectedUserIds) {
        const entry = row.entries[uid];
        if (!entry?.weight) continue;
        const w = parseFloat(entry.weight);
        if (isNaN(w) || w <= 0) continue;
        point[uid] = w;
        hasWeight = true;
        sums[uid] = (sums[uid] || 0) + w;
        counts[uid] = (counts[uid] || 0) + 1;
      }

      if (hasWeight) points.push(point);
    }

    const avgs: Record<string, number> = {};
    for (const uid of selectedUserIds) {
      if (counts[uid]) avgs[uid] = Math.round((sums[uid] / counts[uid]) * 10) / 10;
    }

    let allMin = Infinity;
    let allMax = -Infinity;
    for (const p of points) {
      for (const uid of selectedUserIds) {
        const v = p[uid];
        if (typeof v === "number") {
          allMin = Math.min(allMin, v);
          allMax = Math.max(allMax, v);
        }
      }
    }
    if (!isFinite(allMin)) {
      allMin = 50;
      allMax = 100;
    }
    const pad = Math.max((allMax - allMin) * 0.2, 2);

    return {
      chartData: points,
      avgWeights: avgs,
      minW: Math.floor(allMin - pad),
      maxW: Math.ceil(allMax + pad),
    };
  }, [checkInRows, selectedUserIds]);

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-xs" style={{ color: "var(--text-muted)" }}>
        No weight data recorded
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      <div className="flex items-center justify-between px-1">
        <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--text-primary)" }}>
          Weight Trend
        </h4>
        <div className="flex items-center gap-3 text-[11px]">
          {selectedUserIds.map((uid) =>
            avgWeights[uid] ? (
              <span key={uid} style={{ color: userColors[uid] || "var(--chart-secondary)" }}>
                {selectedUserIds.length > 1 ? `${userNames[uid]}: ` : "Avg: "}
                <span className="font-semibold">{avgWeights[uid]} kg</span>
              </span>
            ) : null
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -6 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minW, maxW]}
              tick={{ fontSize: 10, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              width={32}
              tickFormatter={(v: number) => `${v}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 2,
                fontSize: 11,
                color: "var(--text-primary)",
              }}
              formatter={(value, name) => [`${value} kg`, userNames[name as string] || name]}
              labelFormatter={(label) => `Date: ${label}`}
            />
            {selectedUserIds.length > 1 && (
              <Legend
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
                formatter={(value) => userNames[value] || value}
              />
            )}
            {selectedUserIds.map((uid) => (
              <Line
                key={uid}
                type="monotone"
                dataKey={uid}
                stroke={userColors[uid] || "var(--chart-secondary)"}
                strokeWidth={2}
                dot={{ r: 2, fill: userColors[uid] || "var(--chart-secondary)", strokeWidth: 0 }}
                activeDot={{ r: 4 }}
                connectNulls
                name={uid}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
