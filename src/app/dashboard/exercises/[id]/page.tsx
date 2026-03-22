"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput, { GlowSelect } from "@/components/ui/GlowInput";
import {
  AreaChartCard,
  BarChartCard,
  BoxPlotCard,
  CandlestickCard,
  FunnelCard,
  GaugeCard,
  HeatMapCard,
  LineChartCard,
  PieChartCard,
  RadarChartCard,
  ScatterChartCard,
  SparklineCard,
  StackedBarCard,
} from "@/components/analytics/ExerciseCharts";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { t } from "@/lib/terminology";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string | null;
  difficulty: string;
  type: string;
  story?: string | null;
  targetGroup?: string | null;
}

interface Tier {
  tierId: string;
  level: number;
  name: string;
  wuxiaName: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
  firstAttempt: string | null;
  sessions: number;
  bestWeight: number;
  bestReps: number;
  bestHold: number;
  totalVolume: number;
  avgSessionScore: number;
  timeToMasteryDays: number | null;
  targetHold?: number | null;
  targetReps?: number | null;
  targetRepsText?: string;
}

interface SessionPoint {
  id: string;
  date: string;
  level: number;
  w1: number;
  r1: number;
  w2: number;
  r2: number;
  w3: number;
  r3: number;
  t1: number;
  t2: number;
  t3: number;
  bestWeight: number;
  totalReps: number;
  bestReps: number;
  totalHold: number;
  bestHold: number;
  volume: number;
  oneRmEstimate: number;
  intensityScore: number;
  modifier: string;
  variant: string;
  notes: string;
  completed: boolean;
}

interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName: string;
  category: string;
  equipmentType: string;
  primaryMuscles: string;
  secondaryMuscles: string;
  story: string;
  tiers: Array<{
    id: string;
    level: number;
    name: string;
    wuxiaName: string;
    description: string;
    targetHold: number | null;
    targetReps: number | null;
    targetRepsText: string;
  }>;
  currentLevel: number;
}

interface Analytics {
  sessions: SessionPoint[];
  summaries: {
    totalSessions: number;
    activeDays: number;
    uniqueTrainingDays: number;
    sessionsPerWeek: number;
    longestStreakDays: number;
    totalVolume: number;
    totalReps: number;
    totalTimeUnderTensionSeconds: number;
    avgVolumePerSession: number;
    avgHoldSeconds: number;
    avgIntensityScore: number;
    consistencyScore: number;
    inferredRecoveryHours: number;
    fatigueScore: number;
    bestSession: SessionPoint | null;
    personalBests: {
      bestWeight: number;
      bestReps: number;
      bestHold: number;
      bestVolumeSession: number;
      bestOneRm: number;
    };
    improvements: {
      weeklyPct: number;
      monthlyPct: number;
      quarterlyPct: number;
    };
    avgDaysBetweenTierAdvancements: number;
    columnAverages: {
      w1: number;
      r1: number;
      w2: number;
      r2: number;
      w3: number;
      r3: number;
      t1: number;
      t2: number;
      t3: number;
    };
  };
  predictions: {
    projectedNextSession: { reps: number; holdSeconds: number; volume: number };
    projectedNextTierDate: string;
    projectedTierDays: number;
    predictedPrDate: string;
    plateauDetected: boolean;
    optimalSessionsPerWeek: number;
    deloadRecommended: boolean;
    expectedVolumeForTierAdvancement: number;
    goalProbabilities: {
      next90DaysRepsGoalPct: number;
      next90DaysHoldGoalPct: number;
      targetDate: string;
    };
  };
  charts: {
    repsSeries: Array<{ date: string; value: number }>;
    holdSeries: Array<{ date: string; value: number }>;
    volumeSeries: Array<{ date: string; value: number }>;
    scoreSeries: Array<{ date: string; value: number }>;
    rolling7: Array<{ date: string; value: number }>;
    rolling14: Array<{ date: string; value: number }>;
    rolling30: Array<{ date: string; value: number }>;
    scatterFrequencyVsImprovement: Array<{ week: string; frequency: number; improvement: number }>;
    equipmentDistribution: Array<{ label: string; value: number }>;
    variantDistribution: Array<{ label: string; value: number }>;
    tierDistribution: Array<{ label: string; value: number }>;
    heatmap: Array<{ date: string; value: number }>;
    boxPlot: { min: number; q1: number; median: number; q3: number; max: number };
    candlestick: Array<{ date: string; open: number; close: number; high: number; low: number }>;
    funnel: Array<{ label: string; value: number }>;
    radar: {
      strength: number;
      endurance: number;
      consistency: number;
      velocity: number;
      density: number;
    };
    gauge: { value: number };
  };
  tiers: Tier[];
  breakdowns: {
    byVariant: Array<{
      label: string;
      sessions: number;
      totalVolume: number;
      totalReps: number;
      totalHold: number;
      bestWeight: number;
      bestReps: number;
      bestHold: number;
      avgIntensity: number;
    }>;
    byModifier: Array<{
      label: string;
      sessions: number;
      totalVolume: number;
      totalReps: number;
      totalHold: number;
      bestWeight: number;
      bestReps: number;
      bestHold: number;
      avgIntensity: number;
    }>;
  };
  raw: { logs: Array<Record<string, unknown>> };
}

interface AnalyticsResponse {
  exercise: Exercise;
  progression: ProgressionExercise | null;
  analytics: Analytics;
  comparisons: {
    sameMuscle: Array<{ name: string; sessions: number; avgLevel: number; completions: number; primaryMuscles: string }>;
    similarDifficulty: Array<{ name: string; sessions: number; avgLevel: number; completions: number; difficulty: string }>;
    trainingAllocation: { thisExercisePct: number; userAverageSessionsPerExercise: number };
    synergyCandidates: Array<{ name: string; score: number }>;
  };
}

type ViewMode = "summary" | "analytics" | "historical" | "comparison" | "progression" | "goal" | "raw";
type ComparisonMode = "session" | "week" | "month" | "custom";

type TermKey =
  | "exercise"
  | "progressionTier"
  | "personalRecord"
  | "trainingSession"
  | "weight"
  | "reps"
  | "hold"
  | "improvement"
  | "regression"
  | "volume"
  | "frequency"
  | "rest"
  | "plateau"
  | "breakthrough";

const TERMINOLOGY_LABELS: Record<TermKey, { fantasy: string; normal: string }> = {
  exercise: { fantasy: "Technique", normal: "Exercise" },
  progressionTier: { fantasy: "Cultivation Tier", normal: "Progression Level" },
  personalRecord: { fantasy: "Peak Achievement", normal: "Personal Record" },
  trainingSession: { fantasy: "Cultivation Session", normal: "Training Session" },
  weight: { fantasy: "Resistance Burden", normal: "Weight" },
  reps: { fantasy: "Movement Cycles", normal: "Repetitions" },
  hold: { fantasy: "Qi Sustainment", normal: "Hold Duration" },
  improvement: { fantasy: "Advancement", normal: "Improvement" },
  regression: { fantasy: "Stagnation", normal: "Regression" },
  volume: { fantasy: "Accumulated Effort", normal: "Volume" },
  frequency: { fantasy: "Practice Rhythm", normal: "Frequency" },
  rest: { fantasy: "Recovery Interval", normal: "Rest Period" },
  plateau: { fantasy: "Qi Blockage", normal: "Plateau" },
  breakthrough: { fantasy: "Realm Ascension", normal: "Breakthrough" },
};

function labelFor(mode: "fantasy" | "normal", key: TermKey): string {
  return TERMINOLOGY_LABELS[key][mode];
}

type DeltaTone = "positive" | "neutral" | "negative";

function deltaTone(pct: number): DeltaTone {
  if (Math.abs(pct) <= 2) return "neutral";
  return pct > 0 ? "positive" : "negative";
}

function deltaStyles(tone: DeltaTone): string {
  if (tone === "positive") return "text-[#10B981]";
  if (tone === "negative") return "text-[#EF4444]";
  return "text-[#F59E0B]";
}

function deltaArrow(pct: number): string {
  const tone = deltaTone(pct);
  if (tone === "positive") return "↑";
  if (tone === "negative") return "↓";
  return "→";
}

function fmtSigned(value: number, suffix = ""): string {
  if (!Number.isFinite(value)) return `0${suffix}`;
  const rounded = Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2).replace(/\.00$/, "");
  return `${value > 0 ? "+" : ""}${rounded}${suffix}`;
}

function MiniSparkline({ values }: { values: number[] }) {
  const width = 120;
  const height = 28;
  if (!values.length) {
    return <div className="h-7 w-[120px] rounded bg-ink-dark/40" />;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((v, i) => {
      const x = (i / Math.max(1, values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} className="text-jade-light/90" />
    </svg>
  );
}

function DeltaBadge({ pct, absValue, unit, maintainLabel = "maintained" }: { pct: number; absValue: number; unit?: string; maintainLabel?: string }) {
  const tone = deltaTone(pct);
  const cls = deltaStyles(tone);
  const arrow = deltaArrow(pct);
  return (
    <span className={`text-xs font-semibold ${cls}`}>
      {arrow} {Math.abs(pct).toFixed(1)}% ({tone === "neutral" ? maintainLabel : `${fmtSigned(absValue, unit || "")}`})
    </span>
  );
}

function dualNames(exercise: Exercise, mode: "fantasy" | "normal") {
  const conventional = exercise.name.trim();
  const cultivation = (exercise.wuxiaName || "").trim();
  return mode === "fantasy"
    ? { primary: cultivation || conventional, secondaryLabel: "Conventional", secondary: conventional }
    : { primary: conventional || cultivation, secondaryLabel: "Cultivation", secondary: cultivation };
}

function toCsv(rows: SessionPoint[]): string {
  const header = [
    "date",
    "level",
    "w1",
    "r1",
    "w2",
    "r2",
    "w3",
    "r3",
    "t1",
    "t2",
    "t3",
    "bestWeight",
    "totalReps",
    "bestReps",
    "totalHold",
    "bestHold",
    "volume",
    "oneRmEstimate",
    "intensityScore",
    "modifier",
    "variant",
    "completed",
    "notes",
  ];
  const lines = rows.map((r) => [
    r.date,
    r.level,
    r.w1,
    r.r1,
    r.w2,
    r.r2,
    r.w3,
    r.r3,
    r.t1,
    r.t2,
    r.t3,
    r.bestWeight,
    r.totalReps,
    r.bestReps,
    r.totalHold,
    r.bestHold,
    r.volume,
    r.oneRmEstimate,
    r.intensityScore,
    r.modifier,
    r.variant,
    r.completed,
    JSON.stringify(r.notes || ""),
  ].join(","));
  return [header.join(","), ...lines].join("\n");
}

function downloadBlob(fileName: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function getTierDisplayName(tier: Tier, mode: "fantasy" | "normal"): string {
  if (mode === "fantasy") {
    return tier.wuxiaName || tier.name || `Tier ${tier.level}`;
  }
  return tier.name || tier.wuxiaName || `Tier ${tier.level}`;
}

function aggregateSessionBreakdown(rows: SessionPoint[], key: (s: SessionPoint) => string) {
  const map = new Map<string, { label: string; sessions: number; bestReps: number; bestHold: number; bestWeight: number; avgIntensityTotal: number; totalVolume: number; totalHold: number }>();
  rows.forEach((row) => {
    const label = key(row) || "unspecified";
    const existing = map.get(label) || {
      label,
      sessions: 0,
      bestReps: 0,
      bestHold: 0,
      bestWeight: 0,
      avgIntensityTotal: 0,
      totalVolume: 0,
      totalHold: 0,
    };
    existing.sessions += 1;
    existing.bestReps = Math.max(existing.bestReps, row.bestReps);
    existing.bestHold = Math.max(existing.bestHold, row.bestHold);
    existing.bestWeight = Math.max(existing.bestWeight, row.bestWeight);
    existing.avgIntensityTotal += row.intensityScore;
    existing.totalVolume += row.volume;
    existing.totalHold += row.totalHold;
    map.set(label, existing);
  });

  return Array.from(map.values())
    .map((r) => ({
      label: r.label,
      sessions: r.sessions,
      bestReps: r.bestReps,
      bestHold: r.bestHold,
      bestWeight: Number(r.bestWeight.toFixed(2)),
      avgIntensity: Number((r.sessions > 0 ? r.avgIntensityTotal / r.sessions : 0).toFixed(2)),
      totalVolume: Number(r.totalVolume.toFixed(2)),
      totalHold: r.totalHold,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export default function ExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const terminologyMode = settings.terminologyMode;

  const [viewMode, setViewMode] = useState<ViewMode>("summary");
  const [rangeDays, setRangeDays] = useState<string>("90");
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("week");
  const [customComparisonDays, setCustomComparisonDays] = useState<string>("45");
  const [query, setQuery] = useState("");
  const [variantFilter, setVariantFilter] = useState<string>("all");
  const [modifierFilter, setModifierFilter] = useState<string>("all");
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [expandedSessions, setExpandedSessions] = useState<Record<string, boolean>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<AnalyticsResponse | null>(null);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError("");
      try {
        if (!user?.id) {
          setPayload(null);
          return;
        }
        const res = await fetch(`/api/exercises/${encodeURIComponent(params.id)}/analytics?userId=${encodeURIComponent(user.id)}`);
        if (!res.ok) throw new Error("Failed to load exercise analytics.");
        const data: AnalyticsResponse = await res.json();
        setPayload(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load exercise analytics.");
      } finally {
        setIsLoading(false);
      }
    };

    run();
  }, [params.id, user?.id]);

  const exercise = payload?.exercise || null;
  const progression = payload?.progression || null;
  const analytics = payload?.analytics || null;
  const termLabel = (key: TermKey) => labelFor(terminologyMode, key);

  const toggleSessionExpanded = (id: string) => {
    setExpandedSessions((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredSessions = useMemo(() => {
    if (!analytics) return [];
    const days = Number(rangeDays);
    const cutoff = days > 0 ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : null;
    return analytics.sessions.filter((s) => {
      if (cutoff && new Date(s.date) < cutoff) return false;
      if (variantFilter !== "all" && s.variant !== variantFilter) return false;
      if (modifierFilter !== "all" && s.modifier !== modifierFilter) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return [s.modifier, s.variant, s.notes, String(s.level), String(s.totalReps), String(s.bestHold)]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [analytics, rangeDays, query, variantFilter, modifierFilter]);

  const variants = useMemo(() => {
    if (!analytics) return [];
    return Array.from(new Set(analytics.sessions.map((s) => s.variant).filter(Boolean))).sort();
  }, [analytics]);

  const modifiers = useMemo(() => {
    if (!analytics) return [];
    return Array.from(new Set(analytics.sessions.map((s) => s.modifier).filter(Boolean))).sort();
  }, [analytics]);

  const filteredChartSeries = useMemo(() => {
    return {
      reps: filteredSessions.map((s) => ({ label: s.date, value: s.bestReps })),
      hold: filteredSessions.map((s) => ({ label: s.date, value: s.bestHold })),
      volume: filteredSessions.map((s) => ({ label: s.date, value: s.volume })),
      score: filteredSessions.map((s) => ({ label: s.date, value: s.intensityScore })),
      w1: filteredSessions.map((s) => ({ label: s.date, value: s.w1 })),
      r1: filteredSessions.map((s) => ({ label: s.date, value: s.r1 })),
      t1: filteredSessions.map((s) => ({ label: s.date, value: s.t1 })),
    };
  }, [filteredSessions]);

  const filteredSummary = useMemo(() => {
    const sessions = filteredSessions;
    const totalSessions = sessions.length;
    const totalVolume = sessions.reduce((sum, s) => sum + s.volume, 0);
    const totalHold = sessions.reduce((sum, s) => sum + s.totalHold, 0);
    const totalReps = sessions.reduce((sum, s) => sum + s.totalReps, 0);

    const avg = (values: number[]) => (values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : 0);

    return {
      totalSessions,
      totalVolume: Number(totalVolume.toFixed(2)),
      totalHold,
      totalReps,
      avgVolume: Number(avg(sessions.map((s) => s.volume)).toFixed(2)),
      avgScore: Number(avg(sessions.map((s) => s.intensityScore)).toFixed(2)),
      avgW1: Number(avg(sessions.map((s) => s.w1)).toFixed(2)),
      avgR1: Number(avg(sessions.map((s) => s.r1)).toFixed(2)),
      avgT1: Number(avg(sessions.map((s) => s.t1)).toFixed(2)),
      bestWeight: Math.max(...sessions.map((s) => s.bestWeight), 0),
      bestReps: Math.max(...sessions.map((s) => s.bestReps), 0),
      bestHold: Math.max(...sessions.map((s) => s.bestHold), 0),
    };
  }, [filteredSessions]);

  const filteredDistributions = useMemo(() => {
    const byModifier = new Map<string, number>();
    const byVariant = new Map<string, number>();
    const byTier = new Map<string, number>();

    filteredSessions.forEach((s) => {
      byModifier.set(s.modifier || "unspecified", (byModifier.get(s.modifier || "unspecified") || 0) + 1);
      byVariant.set(s.variant || "default", (byVariant.get(s.variant || "default") || 0) + 1);
      byTier.set(`Tier ${s.level}`, (byTier.get(`Tier ${s.level}`) || 0) + 1);
    });

    return {
      modifier: Array.from(byModifier.entries()).map(([label, value]) => ({ label, value })),
      variant: Array.from(byVariant.entries()).map(([label, value]) => ({ label, value })),
      tier: Array.from(byTier.entries()).map(([label, value]) => ({ label, value })),
    };
  }, [filteredSessions]);

  const filteredHeatmap = useMemo(() => {
    const map = new Map<string, number>();
    filteredSessions.forEach((s) => {
      const date = s.date.slice(0, 10);
      map.set(date, (map.get(date) || 0) + 1);
    });
    return Array.from(map.entries()).map(([date, value]) => ({ label: date, value }));
  }, [filteredSessions]);

  const filteredCandles = useMemo(() => {
    return filteredSessions.map((s, idx) => {
      const prev = filteredSessions[idx - 1];
      const open = prev ? prev.intensityScore : s.intensityScore;
      const close = s.intensityScore;
      const high = Math.max(open, close, s.bestReps + s.bestHold);
      const low = Math.min(open, close, Math.max(0, s.intensityScore - 20));
      return { date: s.date, open, close, high, low };
    });
  }, [filteredSessions]);

  const filteredFrequencyScatter = useMemo(() => {
    const weekMap = new Map<string, { sessions: number; improvements: number[] }>();
    for (let i = 0; i < filteredSessions.length; i += 1) {
      const s = filteredSessions[i];
      const d = new Date(s.date);
      const weekStart = new Date(d);
      weekStart.setDate(d.getDate() - d.getDay());
      const week = weekStart.toISOString().slice(0, 10);
      const bucket = weekMap.get(week) || { sessions: 0, improvements: [] };
      bucket.sessions += 1;
      if (i > 0) {
        bucket.improvements.push(s.intensityScore - filteredSessions[i - 1].intensityScore);
      }
      weekMap.set(week, bucket);
    }

    return Array.from(weekMap.entries()).map(([week, bucket]) => ({
      x: bucket.sessions,
      y: bucket.improvements.length > 0 ? Number((bucket.improvements.reduce((sum, v) => sum + v, 0) / bucket.improvements.length).toFixed(2)) : 0,
      label: week,
    }));
  }, [filteredSessions]);

  const filteredBreakdowns = useMemo(() => {
    return {
      byVariant: aggregateSessionBreakdown(filteredSessions, (s) => s.variant),
      byModifier: aggregateSessionBreakdown(filteredSessions, (s) => s.modifier),
    };
  }, [filteredSessions]);

  const periodComparison = useMemo(() => {
    if (!analytics) return null;
    const textQuery = query.trim().toLowerCase();
    const baseFilter = (s: SessionPoint) => {
      if (variantFilter !== "all" && s.variant !== variantFilter) return false;
      if (modifierFilter !== "all" && s.modifier !== modifierFilter) return false;
      if (!textQuery) return true;
      return [s.modifier, s.variant, s.notes, String(s.level), String(s.totalReps), String(s.bestHold)]
        .join(" ")
        .toLowerCase()
        .includes(textQuery);
    };

    const filtered = analytics.sessions.filter(baseFilter);
    const pct = (current: number, previous: number) => {
      if (previous <= 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(2));
    };

    if (comparisonMode === "session") {
      const current = filtered.at(-1);
      const previous = filtered.at(-2);
      if (!current || !previous) return null;

      const currentVolume = Number(current.volume.toFixed(2));
      const previousVolume = Number(previous.volume.toFixed(2));
      const currentReps = current.totalReps;
      const previousReps = previous.totalReps;
      const currentHold = current.totalHold;
      const previousHold = previous.totalHold;

      return {
        mode: comparisonMode,
        modeLabel: "Session vs Session",
        windowDays: 0,
        currentSessions: 1,
        previousSessions: 1,
        currentVolume,
        previousVolume,
        volumeDeltaPct: pct(currentVolume, previousVolume),
        volumeDeltaAbs: Number((currentVolume - previousVolume).toFixed(2)),
        currentReps,
        previousReps,
        repsDeltaPct: pct(currentReps, previousReps),
        repsDeltaAbs: currentReps - previousReps,
        currentHold,
        previousHold,
        holdDeltaPct: pct(currentHold, previousHold),
        holdDeltaAbs: currentHold - previousHold,
      };
    }

    const derivedDays = comparisonMode === "week"
      ? 7
      : comparisonMode === "month"
      ? 30
      : Math.max(1, Number(customComparisonDays) || 30);

    const now = Date.now();
    const currentStart = now - derivedDays * 24 * 60 * 60 * 1000;
    const previousStart = currentStart - derivedDays * 24 * 60 * 60 * 1000;

    const currentRows = filtered.filter((s) => {
      const ts = new Date(s.date).getTime();
      return ts >= currentStart && ts <= now;
    });
    const previousRows = filtered.filter((s) => {
      const ts = new Date(s.date).getTime();
      return ts >= previousStart && ts < currentStart;
    });

    const sum = (rows: SessionPoint[], selector: (s: SessionPoint) => number) => rows.reduce((acc, row) => acc + selector(row), 0);
    const curVolume = sum(currentRows, (s) => s.volume);
    const prevVolume = sum(previousRows, (s) => s.volume);
    const curReps = sum(currentRows, (s) => s.totalReps);
    const prevReps = sum(previousRows, (s) => s.totalReps);
    const curHold = sum(currentRows, (s) => s.totalHold);
    const prevHold = sum(previousRows, (s) => s.totalHold);

    return {
      mode: comparisonMode,
      modeLabel: comparisonMode === "week" ? "Week vs Previous Week" : comparisonMode === "month" ? "Month vs Previous Month" : `Custom (${derivedDays}d) vs Previous`,
      windowDays: derivedDays,
      currentSessions: currentRows.length,
      previousSessions: previousRows.length,
      currentVolume: Number(curVolume.toFixed(2)),
      previousVolume: Number(prevVolume.toFixed(2)),
      volumeDeltaPct: pct(curVolume, prevVolume),
      volumeDeltaAbs: Number((curVolume - prevVolume).toFixed(2)),
      currentReps: curReps,
      previousReps: prevReps,
      repsDeltaPct: pct(curReps, prevReps),
      repsDeltaAbs: curReps - prevReps,
      currentHold: curHold,
      previousHold: prevHold,
      holdDeltaPct: pct(curHold, prevHold),
      holdDeltaAbs: curHold - prevHold,
    };
  }, [analytics, comparisonMode, customComparisonDays, query, variantFilter, modifierFilter]);

  const rawRows = useMemo(() => filteredSessions.slice().reverse(), [filteredSessions]);

  const summaryCards = analytics
    ? [
        { label: `${termLabel("trainingSession")}s`, value: `${filteredSummary.totalSessions} / ${analytics.summaries.totalSessions}` },
        { label: `${termLabel("frequency")}/Week`, value: analytics.summaries.sessionsPerWeek },
        { label: "Longest Streak", value: `${analytics.summaries.longestStreakDays}d` },
        { label: termLabel("volume"), value: filteredSummary.totalVolume },
        { label: "Time Under Tension", value: `${filteredSummary.totalHold}s` },
        { label: "Avg Intensity", value: filteredSummary.avgScore },
        {
          label: `${termLabel("personalRecord")} ${termLabel("weight")}`,
          value: filteredSummary.bestWeight > 0 ? `${filteredSummary.bestWeight} kg` : "-",
          isPr: filteredSummary.bestWeight > 0 && filteredSummary.bestWeight >= analytics.summaries.personalBests.bestWeight,
        },
        {
          label: `${termLabel("personalRecord")} ${termLabel("reps")}`,
          value: filteredSummary.bestReps,
          isPr: filteredSummary.bestReps > 0 && filteredSummary.bestReps >= analytics.summaries.personalBests.bestReps,
        },
        {
          label: `${termLabel("personalRecord")} ${termLabel("hold")}`,
          value: `${filteredSummary.bestHold}s`,
          isPr: filteredSummary.bestHold > 0 && filteredSummary.bestHold >= analytics.summaries.personalBests.bestHold,
        },
        { label: "Avg W1", value: filteredSummary.avgW1 },
        { label: "Avg R1", value: filteredSummary.avgR1 },
        { label: "Avg T1", value: `${filteredSummary.avgT1}s` },
      ]
    : [];

  const densitySparklines = useMemo(() => {
    return {
      weight: filteredSessions.slice(-24).map((s) => s.bestWeight),
      reps: filteredSessions.slice(-24).map((s) => s.bestReps),
      hold: filteredSessions.slice(-24).map((s) => s.bestHold),
      volume: filteredSessions.slice(-24).map((s) => s.volume),
    };
  }, [filteredSessions]);

  return (
    <PageLayout
      title={t("Technique Scroll", terminologyMode)}
      subtitle="Technique Spotlight Detail"
      sidebar={
        <div className="space-y-3">
          <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-3">
            <div className="space-y-2 text-sm">
              <div className="text-xs uppercase tracking-[0.18em] text-gold/70">Navigation</div>
              <Link href="/dashboard/exercises" className="block rounded border border-ink-light/25 px-3 py-2 text-mist-light hover:border-jade/40 hover:text-jade-light">
                Back To Atlas
              </Link>
            </div>
          </GlowCard>

          <GlowCard glow="none" className="border border-gold/20 bg-ink-dark/50 p-3">
            <div className="space-y-2 text-xs">
              <div className="uppercase tracking-[0.18em] text-gold/80">Exports</div>
              <button className="w-full rounded border border-ink-light/25 px-2 py-1 text-left text-mist-light hover:text-jade-light" onClick={() => analytics && downloadBlob("exercise-sessions.csv", toCsv(filteredSessions), "text/csv")}>Export CSV</button>
              <button className="w-full rounded border border-ink-light/25 px-2 py-1 text-left text-mist-light hover:text-jade-light" onClick={() => analytics && downloadBlob("exercise-analytics.json", JSON.stringify(payload, null, 2), "application/json")}>Export JSON</button>
              <button className="w-full rounded border border-ink-light/25 px-2 py-1 text-left text-mist-light hover:text-jade-light" onClick={() => window.print()}>Print / Save PDF</button>
            </div>
          </GlowCard>
        </div>
      }
      sidebarLabel="Detail"
    >
      <div className="space-y-4">
        <div className="sticky top-0 z-20 rounded border border-gold/20 bg-ink-dark/90 p-2 backdrop-blur">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-8">
            <GlowSelect
              label="View Mode"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as ViewMode)}
              options={[
                { value: "summary", label: "Summary" },
                { value: "analytics", label: "Analytics" },
                { value: "historical", label: "Historical" },
                { value: "comparison", label: "Comparison" },
                { value: "progression", label: "Progression" },
                { value: "goal", label: "Goal" },
                { value: "raw", label: "Raw Data" },
              ]}
            />
            <GlowSelect
              label="Date Range"
              value={rangeDays}
              onChange={(e) => setRangeDays(e.target.value)}
              options={[
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "180", label: "Last 180 days" },
                { value: "365", label: "Last 365 days" },
                { value: "0", label: "All time" },
              ]}
            />
            <GlowSelect
              label="Comparison"
              value={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.value as ComparisonMode)}
              options={[
                { value: "session", label: "Session" },
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
                { value: "custom", label: "Custom" },
              ]}
            />
            <GlowInput
              label="Custom Days"
              value={customComparisonDays}
              onChange={(e) => setCustomComparisonDays(e.target.value)}
              placeholder="e.g. 45"
            />
            <GlowInput label="Filter Sessions" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="modifier, note, level, volume" />
            <GlowSelect
              label="Variant"
              value={variantFilter}
              onChange={(e) => setVariantFilter(e.target.value)}
              options={[{ value: "all", label: "All variants" }, ...variants.map((v) => ({ value: v, label: v }))]}
            />
            <GlowSelect
              label="Modifier"
              value={modifierFilter}
              onChange={(e) => setModifierFilter(e.target.value)}
              options={[{ value: "all", label: "All modifiers" }, ...modifiers.map((v) => ({ value: v, label: v }))]}
            />
            <div className="flex items-end">
              <GlowButton variant="ghost" className="w-full" onClick={() => setShowAdvanced((v) => !v)}>{showAdvanced ? "Hide Dense Panels" : "Show Dense Panels"}</GlowButton>
            </div>
          </div>
        </div>

        {isLoading && <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-8 text-center text-mist-dark">Loading analytics console...</div>}

        {!isLoading && error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        {!isLoading && !error && !exercise && <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-8 text-center text-mist-dark">Exercise not found.</div>}

        {!isLoading && !error && exercise && analytics && (
          <>
            {(() => {
              const names = dualNames(exercise, terminologyMode);
              return (
                <GlowCard glow="none" className="border border-gold/25 bg-[linear-gradient(170deg,rgba(23,29,29,0.9),rgba(18,16,14,0.9))]">
                  <div className="space-y-3 p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-jade-light">Technique Spotlight</div>
                    <div>
                      <h1 className="text-2xl font-semibold text-cloud-white">{names.primary || "Unnamed Technique"}</h1>
                      {names.secondary && names.secondary !== names.primary && <p className="text-sm text-mist-light">{names.secondaryLabel}: {names.secondary}</p>}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="rounded border border-gold/35 bg-gold/10 px-2 py-1 text-gold">Difficulty: {t(exercise.difficulty, "normal")}</span>
                      <span className="rounded border border-jade/35 bg-jade-deep/20 px-2 py-1 text-jade-light">Type: {t(exercise.type, "normal")}</span>
                      {exercise.targetGroup && <span className="rounded border border-ink-light/20 px-2 py-1 text-mist-light">Category: {exercise.targetGroup}</span>}
                    </div>

                    <p className="whitespace-pre-wrap text-sm text-mist-light">{exercise.story || progression?.story || "No lore yet. This technique awaits a narrative."}</p>
                  </div>
                </GlowCard>
              );
            })()}

            {viewMode === "summary" && (
              <>
                <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50">
                  <div className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4 xl:grid-cols-6">
                    {summaryCards.map((item) => (
                      <div key={item.label} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <div className="text-[11px] uppercase tracking-[0.14em] text-gold/75">{item.label}</div>
                        <div className="mt-1 flex items-center gap-2 text-lg font-semibold text-cloud-white">
                          <span>{item.value}</span>
                          {item.isPr ? <span className="text-xs font-bold text-[#8B5CF6]">★ NEW PR</span> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </GlowCard>

                {periodComparison && (
                  <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50 p-3">
                    <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-gold/80">
                      Before/After Comparison: {periodComparison.modeLabel}
                    </div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <div className="text-[10px] uppercase text-mist-dark">Sessions</div>
                        <div className="text-sm text-mist-light">{periodComparison.previousSessions} → <span className="font-semibold text-cloud-white">{periodComparison.currentSessions}</span></div>
                        <DeltaBadge pct={periodComparison.previousSessions <= 0 ? (periodComparison.currentSessions > 0 ? 100 : 0) : ((periodComparison.currentSessions - periodComparison.previousSessions) / periodComparison.previousSessions) * 100} absValue={periodComparison.currentSessions - periodComparison.previousSessions} />
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <div className="text-[10px] uppercase text-mist-dark">{termLabel("volume")}</div>
                        <div className="text-sm text-mist-light">{periodComparison.previousVolume} → <span className="font-semibold text-cloud-white">{periodComparison.currentVolume}</span></div>
                        <DeltaBadge pct={periodComparison.volumeDeltaPct} absValue={periodComparison.volumeDeltaAbs} />
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <div className="text-[10px] uppercase text-mist-dark">{termLabel("reps")}</div>
                        <div className="text-sm text-mist-light">{periodComparison.previousReps} → <span className="font-semibold text-cloud-white">{periodComparison.currentReps}</span></div>
                        <DeltaBadge pct={periodComparison.repsDeltaPct} absValue={periodComparison.repsDeltaAbs} />
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <div className="text-[10px] uppercase text-mist-dark">{termLabel("hold")}</div>
                        <div className="text-sm text-mist-light">{periodComparison.previousHold}s → <span className="font-semibold text-cloud-white">{periodComparison.currentHold}s</span></div>
                        <DeltaBadge pct={periodComparison.holdDeltaPct} absValue={periodComparison.holdDeltaAbs} unit="s" />
                      </div>
                    </div>
                  </GlowCard>
                )}

                <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.16em] text-gold/80">Micro Trends</div>
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-xs text-mist-light">
                      <div className="mb-1 uppercase text-[10px] text-mist-dark">{termLabel("weight")}</div>
                      <MiniSparkline values={densitySparklines.weight} />
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-xs text-mist-light">
                      <div className="mb-1 uppercase text-[10px] text-mist-dark">{termLabel("reps")}</div>
                      <MiniSparkline values={densitySparklines.reps} />
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-xs text-mist-light">
                      <div className="mb-1 uppercase text-[10px] text-mist-dark">{termLabel("hold")}</div>
                      <MiniSparkline values={densitySparklines.hold} />
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-xs text-mist-light">
                      <div className="mb-1 uppercase text-[10px] text-mist-dark">{termLabel("volume")}</div>
                      <MiniSparkline values={densitySparklines.volume} />
                    </div>
                  </div>
                </GlowCard>

                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  <LineChartCard title="Performance Score Over Time" points={filteredChartSeries.score} />
                  <AreaChartCard title="Cumulative Volume Trend" points={filteredChartSeries.volume} />
                </div>
              </>
            )}

            {viewMode === "analytics" && (
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <LineChartCard title="Repetition Trajectory" points={filteredChartSeries.reps} />
                <LineChartCard title="Hold Duration Trajectory" points={filteredChartSeries.hold} />
                <BarChartCard title="Session Volume Bars" points={filteredChartSeries.volume} />
                <AreaChartCard title="W1 Progression Curve" points={filteredChartSeries.w1} />
                <AreaChartCard title="R1 Progression Curve" points={filteredChartSeries.r1} />
                <AreaChartCard title="T1 Progression Curve" points={filteredChartSeries.t1} />
                <ScatterChartCard title="Frequency vs Improvement" points={filteredFrequencyScatter} />
                <RadarChartCard
                  title="Multi-Dimensional Profile"
                  values={[
                    { label: "Strength", value: analytics.charts.radar.strength },
                    { label: "Endurance", value: analytics.charts.radar.endurance },
                    { label: "Consistency", value: analytics.charts.radar.consistency },
                    { label: "Velocity", value: analytics.charts.radar.velocity },
                    { label: "Density", value: analytics.charts.radar.density },
                  ]}
                />
                <HeatMapCard title="Calendar Consistency Heat" points={filteredHeatmap} />
                <GaugeCard title="Tier Advancement Gauge" value={analytics.charts.gauge.value} />
                <BoxPlotCard title="Performance Distribution" stats={analytics.charts.boxPlot} />
                <SparklineCard title="30 Day Sparkline" points={filteredChartSeries.score.map((d) => d.value).slice(-30)} />
                <StackedBarCard
                  title="Modifier Distribution"
                  rows={filteredDistributions.modifier.slice(0, 6).map((d) => ({ label: d.label, a: d.value, b: Math.max(0, Math.round(d.value * 0.3)), c: Math.max(0, Math.round(d.value * 0.15)) }))}
                />
                <PieChartCard title="Variant Allocation" points={filteredDistributions.variant} />
                <PieChartCard title="Tier Time Allocation" points={filteredDistributions.tier} />
                <CandlestickCard title="Session Range Candlestick" candles={filteredCandles.slice(-40)} />
                <FunnelCard title="Tier Completion Funnel" points={analytics.charts.funnel} />
              </div>
            )}

            {viewMode === "historical" && (
              <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Dense Session Ledger</div>
                <div className="space-y-2">
                  {rawRows.map((s, index) => {
                    const prev = rawRows[index + 1] || null;
                    const repsDelta = prev ? s.totalReps - prev.totalReps : 0;
                    const holdDelta = prev ? s.totalHold - prev.totalHold : 0;
                    const volDelta = prev ? Number((s.volume - prev.volume).toFixed(2)) : 0;
                    const repsPct = prev && prev.totalReps > 0 ? ((s.totalReps - prev.totalReps) / prev.totalReps) * 100 : s.totalReps > 0 ? 100 : 0;
                    const holdPct = prev && prev.totalHold > 0 ? ((s.totalHold - prev.totalHold) / prev.totalHold) * 100 : s.totalHold > 0 ? 100 : 0;
                    const volPct = prev && prev.volume > 0 ? ((s.volume - prev.volume) / prev.volume) * 100 : s.volume > 0 ? 100 : 0;
                    return (
                      <div key={s.id} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2">
                        <button className="flex w-full flex-col gap-2 text-left md:flex-row md:items-center md:justify-between" onClick={() => toggleSessionExpanded(s.id)}>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-mist-dark">{new Date(s.date).toLocaleDateString()}</span>
                            <span className="text-sm font-semibold text-cloud-white">{termLabel("progressionTier")} {s.level}</span>
                            <span className="text-xs text-mist-light">W:{s.bestWeight || "-"} R:{s.bestReps || "-"} T:{s.bestHold ? `${s.bestHold}s` : "-"}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <DeltaBadge pct={repsPct} absValue={repsDelta} />
                            <DeltaBadge pct={holdPct} absValue={holdDelta} unit="s" />
                            <DeltaBadge pct={volPct} absValue={volDelta} />
                            <MiniSparkline values={[s.w1, s.w2, s.w3, s.r1, s.r2, s.r3, s.t1, s.t2, s.t3].map((v) => Number(v || 0))} />
                          </div>
                        </button>

                        {expandedSessions[s.id] ? (
                          <div className="mt-2 grid grid-cols-2 gap-2 border-t border-ink-light/20 pt-2 text-xs text-mist-light md:grid-cols-4">
                            <div>W1/W2/W3: {s.w1 || "-"} / {s.w2 || "-"} / {s.w3 || "-"}</div>
                            <div>R1/R2/R3: {s.r1 || "-"} / {s.r2 || "-"} / {s.r3 || "-"}</div>
                            <div>T1/T2/T3: {s.t1 || "-"} / {s.t2 || "-"} / {s.t3 || "-"} sec</div>
                            <div>{termLabel("volume")}: {s.volume.toFixed(1)}</div>
                            <div>Intensity: {s.intensityScore.toFixed(1)}</div>
                            <div>Variant: {s.variant}</div>
                            <div>Modifier: {s.modifier}</div>
                            <div>Notes: {s.notes || "-"}</div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </GlowCard>
            )}

            {viewMode === "comparison" && payload && (
              <div className="space-y-4">
                <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50 p-4">
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Training Allocation: {payload.comparisons.trainingAllocation.thisExercisePct}% of all sessions
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      User Average Sessions / Exercise: {payload.comparisons.trainingAllocation.userAverageSessionsPerExercise}
                    </div>
                  </div>
                </GlowCard>

                <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Same Muscle Group Comparison</div>
                  <div className="space-y-2 text-sm">
                    {payload.comparisons.sameMuscle.map((row) => (
                      <div key={row.name} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">
                        {row.name}: {row.sessions} sessions, avg tier {row.avgLevel}, completions {row.completions}
                      </div>
                    ))}
                  </div>
                </GlowCard>

                <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Synergy Candidates</div>
                  <div className="space-y-2 text-sm">
                    {payload.comparisons.synergyCandidates.map((row) => (
                      <div key={row.name} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-mist-light">
                        {row.name}: synergy score {row.score}
                      </div>
                    ))}
                  </div>
                </GlowCard>

                {periodComparison && (
                  <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Window Comparison: {periodComparison.modeLabel}</div>
                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        Sessions: {periodComparison.previousSessions} {"->"} {periodComparison.currentSessions}
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        {termLabel("volume")}: {periodComparison.previousVolume} {"->"} {periodComparison.currentVolume}
                        <div><DeltaBadge pct={periodComparison.volumeDeltaPct} absValue={periodComparison.volumeDeltaAbs} /></div>
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        {termLabel("reps")}: {periodComparison.previousReps} {"->"} {periodComparison.currentReps}
                        <div><DeltaBadge pct={periodComparison.repsDeltaPct} absValue={periodComparison.repsDeltaAbs} /></div>
                      </div>
                      <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        TUT: {periodComparison.previousHold}s {"->"} {periodComparison.currentHold}s
                        <div><DeltaBadge pct={periodComparison.holdDeltaPct} absValue={periodComparison.holdDeltaAbs} unit="s" /></div>
                      </div>
                    </div>
                  </GlowCard>
                )}

                <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Variant And Modifier Breakdown (Filtered)</div>
                  <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {filteredBreakdowns.byVariant.slice(0, 8).map((row) => (
                      <div key={`variant-${row.label}`} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        Variant {row.label}: {row.sessions} sessions, avg score {row.avgIntensity}, best {row.bestReps} reps / {row.bestHold}s
                      </div>
                    ))}
                    {filteredBreakdowns.byModifier.slice(0, 8).map((row) => (
                      <div key={`modifier-${row.label}`} className="rounded border border-ink-light/20 bg-ink-dark/40 p-2 text-sm text-mist-light">
                        Modifier {row.label}: volume {row.totalVolume}, best weight {row.bestWeight}kg, total hold {row.totalHold}s
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>
            )}

            {viewMode === "progression" && (
              <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50 p-4">
                <div className="mb-3 text-xs uppercase tracking-[0.2em] text-gold/80">Cultivation Pathway Journey Map</div>
                <div className="space-y-3">
                  {analytics.tiers.map((tier) => {
                    const status = tier.completed ? "completed" : progression && tier.level === progression.currentLevel ? "active" : "locked";
                    const tierName = getTierDisplayName(tier, terminologyMode);
                    return (
                      <Link
                        key={tier.tierId}
                        href={`/dashboard/exercises/${params.id}/progression/${tier.tierId}`}
                        className={`block rounded border p-3 ${status === "completed" ? "border-jade/35 bg-jade-deep/20" : status === "active" ? "border-gold/35 bg-gold/10" : "border-ink-light/20 bg-ink-dark/50"}`}
                        title={`Best weight ${tier.bestWeight}kg, best reps ${tier.bestReps}, best hold ${tier.bestHold}s, volume ${tier.totalVolume.toFixed(1)}`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold text-cloud-white">Tier {tier.level}: {tierName}</div>
                            <div className="text-xs text-mist-light">{tier.completed ? `Completed ${tier.completedAt ? new Date(tier.completedAt).toLocaleDateString() : ""}` : status === "active" ? "Current working tier" : "Locked future tier"}</div>
                          </div>
                          <div className="text-xs text-mist-dark">Sessions: {tier.sessions} | Best weight: {tier.bestWeight > 0 ? `${tier.bestWeight}kg` : "-"}</div>
                        </div>
                        {showAdvanced && (
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-mist-light md:grid-cols-5">
                            <div>Best Weight: {tier.bestWeight > 0 ? `${tier.bestWeight}kg` : "-"}</div>
                            <div>Best Reps: {tier.bestReps || "-"}</div>
                            <div>Best Hold: {tier.bestHold ? `${tier.bestHold}s` : "-"}</div>
                            <div>Total Volume: {tier.totalVolume.toFixed(1)}</div>
                            <div>Time To Mastery: {tier.timeToMasteryDays != null ? `${tier.timeToMasteryDays} days` : "-"}</div>
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </GlowCard>
            )}

            {viewMode === "goal" && (
              <div className="space-y-4">
                <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50 p-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Next tier projection: {new Date(analytics.predictions.projectedNextTierDate).toLocaleDateString()} ({analytics.predictions.projectedTierDays} days)
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Predicted next PR: {new Date(analytics.predictions.predictedPrDate).toLocaleDateString()}
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Plateau: {analytics.predictions.plateauDetected ? "Detected" : "Not detected"}
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Deload guidance: {analytics.predictions.deloadRecommended ? "Recommend deload week" : "Current load acceptable"}
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Goal probability (reps): {analytics.predictions.goalProbabilities.next90DaysRepsGoalPct}%
                    </div>
                    <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-3 text-sm text-mist-light">
                      Goal probability (hold): {analytics.predictions.goalProbabilities.next90DaysHoldGoalPct}%
                    </div>
                  </div>
                </GlowCard>

                <LineChartCard title="Projected Intensity Momentum" points={analytics.charts.rolling14.map((d) => ({ label: d.date, value: d.value }))} />
              </div>
            )}

            {viewMode === "raw" && (
              <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50 p-4">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-gold/80">Raw Data Grid</div>
                <div className="overflow-x-auto rounded border border-ink-light/20">
                  <table className="w-full text-xs">
                    <thead className="bg-ink-dark/80 text-mist-light">
                      <tr>
                        {Object.keys(analytics.raw.logs[0] || { empty: "" }).map((k) => (
                          <th key={k} className="p-2 text-left">{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {analytics.raw.logs.map((row, idx) => (
                        <tr key={String(row.id || idx)} className="border-t border-ink-light/15 text-mist-light">
                          {Object.keys(analytics.raw.logs[0] || {}).map((k) => (
                            <td key={`${idx}-${k}`} className="max-w-[220px] truncate p-2">{String(row[k] ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlowCard>
            )}

            <div className="flex justify-end">
              <Link href="/dashboard/exercises">
                <GlowButton variant="ghost">Back To Atlas</GlowButton>
              </Link>
            </div>
          </>
        )}
      </div>
    </PageLayout>
  );
}
