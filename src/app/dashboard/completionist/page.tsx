"use client";

import React from "react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useIsMobile } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { t } from "@/lib/terminology";
import type { ProgressionExercise, ProgressionLog } from "../workout/types";

type TierStats = {
  attempts: number;
  bestReps: number | null;
  bestHoldSeconds: number | null;
  bestWeight: number | null;
  lastPerformedAt: string | null;
};

type CompletionistSkill = {
  id: string;
  name: string;
  wuxiaName?: string;
  englishName?: string;
  vietnameseName?: string;
  tierNames: string[];
  tierStats: TierStats[];
  category: string;
  performed: number;
  lastLogAt: string | null;
  sessions14d: number;
};

type ProgressionsResponse = { exercises: ProgressionExercise[] };
type CategoryFilter = "all" | string;
type ActivityFilter = "all" | "active-7d" | "active-14d" | "active-30d" | "stale" | "never-attempted";
type SortBy = "recent" | "performed" | "least-sessions" | "name" | "most-tiers";
type MobileFilterPickerField = "category" | "activity" | "sort";

interface MobileFilterPickerState {
  field: MobileFilterPickerField;
  title: string;
}

function getPrimaryCategory(category: string | null | undefined): string {
  const raw = String(category || "").trim();
  if (!raw) return "Other";
  const first = raw.split(",")[0].trim();
  return first || "Other";
}

function getLogsWithinDays(logs: ProgressionLog[], days: number): ProgressionLog[] {
  const now = Date.now();
  const limit = days * 24 * 60 * 60 * 1000;
  return logs.filter((log) => now - new Date(log.createdAt).getTime() <= limit);
}

function getBestReps(log: ProgressionLog): number | null {
  const reps = [log.reps1, log.reps2, log.reps3, log.reps].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return reps.length > 0 ? Math.max(...reps) : null;
}

function getBestHold(log: ProgressionLog): number | null {
  const holds = [log.holdTime, log.holdTime2, log.holdTime3].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return holds.length > 0 ? Math.max(...holds) : null;
}

function getBestWeight(log: ProgressionLog): number | null {
  const weights = [log.weight1, log.weight2, log.weight3].filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  return weights.length > 0 ? Math.max(...weights) : null;
}

function formatBest(stat: TierStats): string {
  if (stat.bestWeight != null) return `${stat.bestWeight} kg`;
  if (stat.bestReps != null) return `${stat.bestReps} reps`;
  if (stat.bestHoldSeconds != null) return `${stat.bestHoldSeconds}s hold`;
  return "-";
}

function formatDate(value: string | null): string {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";
  return date.toLocaleDateString();
}

function formatDaysAgo(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return "Today";
  if (days === 1) return "1 day";
  return `${days} days`;
}

// --- Motivational helpers ---

function getCompletionTitle(pct: number): string {
  if (pct >= 100) return "🏆 Immortal Completionist";
  if (pct >= 90) return "🌟 Near Perfection";
  if (pct >= 75) return "🔥 Relentless";
  if (pct >= 50) return "⚡ Halfway There";
  if (pct >= 25) return "🌱 Growing Strong";
  if (pct >= 10) return "🚶 The Journey Begins";
  return "🥚 Untapped Potential";
}

function getMotivationalMessage(pct: number, attempted: number, total: number): string {
  const remaining = total - attempted;
  if (pct >= 100) return "You've attempted every single exercise. True mastery.";
  if (pct >= 90) return `Only ${remaining} exercise${remaining === 1 ? "" : "s"} left. The finish line is in sight!`;
  if (pct >= 75) return `${remaining} exercises remain. You're in elite territory now.`;
  if (pct >= 50) return `${remaining} exercises to go. Past the halfway mark — keep pushing!`;
  if (pct >= 25) return `${remaining} exercises waiting. Every new attempt expands your capability.`;
  if (attempted > 0) return `${remaining} exercises untouched. Explore something new today!`;
  return "Your journey awaits. Try your first exercise to begin!";
}

function getCategoryEmoji(category: string): string {
  const lower = category.toLowerCase();
  if (lower.includes("calisthenics")) return "🤸";
  if (lower.includes("yoga")) return "🧘";
  if (lower.includes("gym")) return "🏋️";
  return "💪";
}

// --- Progress Ring Component ---

function ProgressRing({ percent, size = 80, strokeWidth = 6 }: { percent: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(percent, 100) / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--ink-light)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={percent >= 100 ? "var(--gold, #ffd700)" : "var(--jade-glow)"}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold" style={{ color: percent >= 100 ? "var(--gold, #ffd700)" : "var(--cloud-white)" }}>
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}

// --- Category Progress Bar ---

function CategoryProgressBar({ category, attempted, total, totalSessions }: { category: string; attempted: number; total: number; totalSessions: number }) {
  const pct = total > 0 ? (attempted / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-cloud-white font-medium">
          {getCategoryEmoji(category)} {category}
        </span>
        <span className="text-mist-dark">
          {attempted}/{total}
          <span className="ml-1 text-jade-glow font-semibold">({Math.round(pct)}%)</span>
          <span className="ml-1.5 text-cloud-white/60">{totalSessions} sessions</span>
        </span>
      </div>
      <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: "var(--ink-light)" }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(pct, 100)}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            backgroundColor: pct >= 100 ? "var(--gold, #ffd700)" : "var(--jade-glow)",
          }}
        />
      </div>
    </div>
  );
}

// =====================================================
// MAIN COMPONENT
// =====================================================

export default function CompletionistPage() {
  const isMobile = useIsMobile();
  const { settings } = useDisplaySettings();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [skills, setSkills] = useState<CompletionistSkill[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [mobileFilterPicker, setMobileFilterPicker] = useState<MobileFilterPickerState | null>(null);
  const [mobileFilterCanScrollDown, setMobileFilterCanScrollDown] = useState(false);
  const mobileFilterWheelScrollRef = useRef<HTMLDivElement | null>(null);
  const [attemptedParentsOnly, setAttemptedParentsOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [hoveredActionKey, setHoveredActionKey] = useState<string | null>(null);

  const categoryFilterOptions: Array<{ value: CategoryFilter; label: string }> = useMemo(() => {
    const cats = new Set<string>();
    for (const s of skills) {
      if (s.category) cats.add(s.category);
    }
    const sorted = [...cats].sort((a, b) => a.localeCompare(b));
    return [
      { value: "all" as CategoryFilter, label: t("All Categories", "normal") },
      ...sorted.map((c) => ({ value: c as CategoryFilter, label: c })),
    ];
  }, [skills]);

  const activityFilterOptions: Array<{ value: ActivityFilter; label: string }> = [
    { value: "all", label: t("All Skills", "normal") },
    { value: "active-7d", label: t("Active (7 days)", "normal") },
    { value: "active-14d", label: t("Active (14 days)", "normal") },
    { value: "active-30d", label: t("Active (30 days)", "normal") },
    { value: "stale", label: t("Stale (30+ days ago)", "normal") },
    { value: "never-attempted", label: t("Never Attempted", "normal") },
  ];

  const sortByOptions: Array<{ value: SortBy; label: string }> = [
    { value: "recent", label: t("Sort: Recently trained", "normal") },
    { value: "performed", label: t("Sort: Most sessions", "normal") },
    { value: "least-sessions", label: t("Sort: Least sessions", "normal") },
    { value: "most-tiers", label: t("Sort: Most tiers", "normal") },
    { value: "name", label: t("Sort: Name (A-Z)", "normal") },
  ];

  useEffect(() => {
    const loadSkills = async () => {
      setLoading(true);
      setErrorMessage("");
      try {
        const data = await api.get<ProgressionsResponse>("/api/progressions");
        const mapped: CompletionistSkill[] = (data.exercises ?? [])
          .map((exercise) => {
            const tierNames = (exercise.tiers ?? [])
              .slice()
              .sort((a, b) => a.level - b.level)
              .map((tier) => String(tier.name || "").trim())
              .filter(Boolean);

            const fallbackTierNames = tierNames.length > 0 ? tierNames : [exercise.name];
            const logs = exercise.userProgress?.[0]?.logs ?? [];

            const tierStats = fallbackTierNames.map((_, index) => {
              const level = index + 1;
              const levelLogs = logs.filter((log) => (Number(log.level) || 0) === level);
              const bestReps = levelLogs.map(getBestReps).filter((value): value is number => value != null);
              const bestHold = levelLogs.map(getBestHold).filter((value): value is number => value != null);
              const bestWeight = levelLogs.map(getBestWeight).filter((value): value is number => value != null);
              const lastPerformedAt = levelLogs.length
                ? levelLogs
                    .map((log) => log.createdAt)
                    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
                : null;

              return {
                attempts: levelLogs.length,
                bestReps: bestReps.length ? Math.max(...bestReps) : null,
                bestHoldSeconds: bestHold.length ? Math.max(...bestHold) : null,
                bestWeight: bestWeight.length ? Math.max(...bestWeight) : null,
                lastPerformedAt,
              };
            });

            const lastLogAt = logs.length
              ? logs
                  .map((log) => log.createdAt)
                  .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
              : null;

            return {
              id: exercise.id,
              name: exercise.name,
              wuxiaName: exercise.wuxiaName,
              englishName: exercise.englishName,
              vietnameseName: exercise.vietnameseName,
              category: getPrimaryCategory(exercise.category),
              tierNames: fallbackTierNames,
              tierStats,
              performed: logs.length,
              lastLogAt,
              sessions14d: getLogsWithinDays(logs, 14).length,
            };
          })
          .filter((skill) => skill.tierNames.length > 0);

        setSkills(mapped);
      } catch (error) {
        console.error("Failed to load completionist data", error);
        setErrorMessage("Could not load data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    void loadSkills();
  }, []);

  // --- Completionist stats ---

  const completionStats = useMemo(() => {
    const total = skills.length;
    const attempted = skills.filter((s) => s.performed > 0).length;
    const pct = total > 0 ? (attempted / total) * 100 : 0;

    const byCategoryMap = new Map<string, { attempted: number; total: number; totalSessions: number }>();
    for (const s of skills) {
      const cat = s.category || "Other";
      const prev = byCategoryMap.get(cat) || { attempted: 0, total: 0, totalSessions: 0 };
      prev.total += 1;
      prev.totalSessions += s.performed;
      if (s.performed > 0) prev.attempted += 1;
      byCategoryMap.set(cat, prev);
    }
    const byCategory = [...byCategoryMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([category, data]) => ({ category, ...data }));

    const active14d = skills.filter((s) => s.sessions14d > 0).length;
    const totalSessions = skills.reduce((sum, s) => sum + s.performed, 0);

    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const recentDiscoveries = skills.filter((s) => {
      if (s.performed === 0 || !s.lastLogAt) return false;
      const lastMs = new Date(s.lastLogAt).getTime();
      return s.performed <= 2 && (now - lastMs) <= 30 * DAY;
    }).length;

    return { total, attempted, pct, byCategory, active14d, totalSessions, recentDiscoveries };
  }, [skills]);

  const stats = useMemo(() => {
    const total = skills.length;
    const active = skills.filter((s) => s.sessions14d > 0).length;
    const totalSessions = skills.reduce((sum, s) => sum + s.performed, 0);
    return { total, active, totalSessions };
  }, [skills]);

  const visibleSkills = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;

    let list = skills.filter((skill) => {
      const lastMs = skill.lastLogAt ? new Date(skill.lastLogAt).getTime() : 0;
      const daysSinceLast = lastMs ? Math.floor((now - lastMs) / DAY) : Infinity;

      if (categoryFilter !== "all" && skill.category.toLowerCase() !== categoryFilter.toLowerCase()) return false;
      if (attemptedParentsOnly && skill.performed === 0) return false;
      if (activityFilter === "active-7d" && daysSinceLast > 7) return false;
      if (activityFilter === "active-14d" && daysSinceLast > 14) return false;
      if (activityFilter === "active-30d" && daysSinceLast > 30) return false;
      if (activityFilter === "stale" && (skill.performed === 0 || daysSinceLast <= 30)) return false;
      if (activityFilter === "never-attempted" && skill.performed > 0) return false;
      if (!q) return true;
      const displayName = getExerciseDisplayName(
        {
          name: skill.englishName || skill.name,
          wuxiaName: skill.vietnameseName || skill.wuxiaName,
          englishName: skill.englishName,
          vietnameseName: skill.vietnameseName,
        },
        displayTerminologyMode,
        settings.showExerciseForeignLanguage,
      ).toLowerCase();
      const canonicalName = (skill.englishName || skill.name || "").toLowerCase();
      const altName = (skill.vietnameseName || skill.wuxiaName || "").toLowerCase();
      return displayName.includes(q) || canonicalName.includes(q) || altName.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "performed") return b.performed - a.performed;
      if (sortBy === "least-sessions") return a.performed - b.performed;
      if (sortBy === "most-tiers") return b.tierNames.length - a.tierNames.length;
      const aTime = a.lastLogAt ? new Date(a.lastLogAt).getTime() : 0;
      const bTime = b.lastLogAt ? new Date(b.lastLogAt).getTime() : 0;
      return bTime - aTime;
    });

    return list;
  }, [skills, search, categoryFilter, activityFilter, sortBy, attemptedParentsOnly, displayTerminologyMode, settings.showExerciseForeignLanguage]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const mobileFilterPickerOptions = useMemo(() => {
    if (!mobileFilterPicker) return [] as Array<{ value: string; label: string }>;
    if (mobileFilterPicker.field === "category") {
      return categoryFilterOptions.map((option) => ({ value: option.value, label: option.label }));
    }
    if (mobileFilterPicker.field === "activity") {
      return activityFilterOptions.map((option) => ({ value: option.value, label: option.label }));
    }
    return sortByOptions.map((option) => ({ value: option.value, label: option.label }));
  }, [mobileFilterPicker, categoryFilterOptions, activityFilterOptions, sortByOptions]);

  const mobileFilterPickerCurrentValue = useMemo(() => {
    if (!mobileFilterPicker) return "";
    if (mobileFilterPicker.field === "category") return categoryFilter;
    return mobileFilterPicker.field === "activity" ? activityFilter : sortBy;
  }, [mobileFilterPicker, categoryFilter, activityFilter, sortBy]);

  useEffect(() => {
    if (!mobileFilterPicker) return;
    const scroller = mobileFilterWheelScrollRef.current;
    if (!scroller) return;

    const itemHeight = 44;
    const viewportHeight = 224;
    const sidePadding = (viewportHeight - itemHeight) / 2;
    const selectedIndex = Math.max(
      0,
      mobileFilterPickerOptions.findIndex((option) => option.value === mobileFilterPickerCurrentValue),
    );
    const targetTop = selectedIndex * itemHeight - sidePadding;

    const applyScrollPosition = () => {
      scroller.scrollTop = Math.max(0, targetTop);
    };

    applyScrollPosition();
    const rafId = window.requestAnimationFrame(applyScrollPosition);
    const timeoutId = window.setTimeout(applyScrollPosition, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [mobileFilterPicker, mobileFilterPickerOptions, mobileFilterPickerCurrentValue]);

  useEffect(() => {
    if (!mobileFilterPicker) {
      setMobileFilterCanScrollDown(false);
      return;
    }
    const scroller = mobileFilterWheelScrollRef.current;
    if (!scroller) return;

    const updateScrollHints = () => {
      const canScrollDown = scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 4;
      setMobileFilterCanScrollDown(canScrollDown);
    };

    updateScrollHints();
    const rafId = window.requestAnimationFrame(updateScrollHints);
    const timeoutId = window.setTimeout(updateScrollHints, 120);
    scroller.addEventListener("scroll", updateScrollHints, { passive: true });
    window.addEventListener("resize", updateScrollHints);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      scroller.removeEventListener("scroll", updateScrollHints);
      window.removeEventListener("resize", updateScrollHints);
    };
  }, [mobileFilterPicker, mobileFilterPickerOptions]);

  const controlClassName =
    "w-full border rounded px-2 py-1.5 text-xs outline-none transition-all duration-150";

  // =====================================================
  // RENDER
  // =====================================================

  return (
    <PageLayout
      title={t("Completionist", "normal")}
      subtitle={t("Attempt every exercise. Leave nothing untried.", "normal")}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="completionist-modern space-y-6 px-0 py-2 sm:py-3">

        {/* ===== COMPLETIONIST HERO / MOTIVATION SECTION ===== */}
        {!loading && skills.length > 0 && (
          isMobile ? (
            /* --- MOBILE: Compact motivational card --- */
            <GlowCard glow={completionStats.pct >= 100 ? "gold" : "jade"} hoverable={false} className="completionist-modern-hero-mobile">
              <div className="flex items-center gap-4">
                <ProgressRing percent={completionStats.pct} size={72} strokeWidth={5} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-cloud-white truncate">
                    {getCompletionTitle(completionStats.pct)}
                  </p>
                  <p className="text-[11px] text-mist-dark leading-snug mt-0.5">
                    {getMotivationalMessage(completionStats.pct, completionStats.attempted, completionStats.total)}
                  </p>
                  <div className="flex gap-3 mt-2 text-[10px] text-mist-dark">
                    <span>
                      <span className="text-jade-glow font-semibold">{completionStats.attempted}</span>/{completionStats.total} tried
                    </span>
                    <span>
                      <span className="text-jade-glow font-semibold">{completionStats.totalSessions}</span> sessions
                    </span>
                  </div>
                </div>
              </div>
              {/* Category mini-bars */}
              <div className="mt-3 space-y-2">
                {completionStats.byCategory.map((cat) => (
                  <CategoryProgressBar
                    key={cat.category}
                    category={cat.category}
                    attempted={cat.attempted}
                    total={cat.total}
                    totalSessions={cat.totalSessions}
                  />
                ))}
              </div>
            </GlowCard>
          ) : (
            /* --- DESKTOP: Spacious motivational dashboard --- */
            <div className="grid grid-cols-[280px_1fr] gap-4">
              {/* Left: Ring + Title */}
              <GlowCard glow={completionStats.pct >= 100 ? "gold" : "jade"} hoverable={false} className="completionist-modern-hero-main">
                <div className="flex flex-col items-center text-center py-3">
                  <ProgressRing percent={completionStats.pct} size={120} strokeWidth={8} />
                  <p className="mt-3 text-base font-bold text-cloud-white">
                    {getCompletionTitle(completionStats.pct)}
                  </p>
                  <p className="text-xs text-mist-dark leading-relaxed mt-1 max-w-[220px]">
                    {getMotivationalMessage(completionStats.pct, completionStats.attempted, completionStats.total)}
                  </p>
                </div>
                {/* Quick stats grid */}
                <div className="grid grid-cols-2 gap-2 mt-2 pt-3 border-t border-ink-light">
                  <div className="text-center">
                    <p className="text-lg font-bold text-jade-glow">{completionStats.attempted}</p>
                    <p className="text-[10px] text-mist-dark uppercase tracking-wider">Attempted</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-cloud-white">{completionStats.total}</p>
                    <p className="text-[10px] text-mist-dark uppercase tracking-wider">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-cloud-white">{completionStats.totalSessions}</p>
                    <p className="text-[10px] text-mist-dark uppercase tracking-wider">Sessions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-jade-glow">{completionStats.active14d}</p>
                    <p className="text-[10px] text-mist-dark uppercase tracking-wider">Active (14d)</p>
                  </div>
                </div>
              </GlowCard>

              {/* Right: Category breakdown */}
              <GlowCard glow="jade" hoverable={false} className="completionist-modern-hero-side">
                <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-4">
                  {t("Category Progress", "normal")}
                </h3>
                <div className="space-y-3">
                  {completionStats.byCategory.map((cat) => (
                    <CategoryProgressBar
                      key={cat.category}
                      category={cat.category}
                      attempted={cat.attempted}
                      total={cat.total}
                      totalSessions={cat.totalSessions}
                    />
                  ))}
                </div>
                {/* Recently discovered */}
                {completionStats.recentDiscoveries > 0 && (
                  <div className="mt-4 pt-3 border-t border-ink-light">
                    <p className="text-xs text-mist-dark">
                      🆕 <span className="text-jade-glow font-semibold">{completionStats.recentDiscoveries}</span> new exercise{completionStats.recentDiscoveries !== 1 ? "s" : ""} discovered in the last 30 days
                    </p>
                  </div>
                )}
                {/* Challenge prompt */}
                {completionStats.pct < 100 && (
                  <div
                    className="mt-4 rounded-lg border px-3 py-2"
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                      backgroundColor: "color-mix(in srgb, var(--jade-glow) 5%, var(--surface))",
                    }}
                  >
                    <p className="text-xs text-cloud-white font-medium">
                      🎯 Challenge: Try {Math.min(5, completionStats.total - completionStats.attempted)} new exercise{Math.min(5, completionStats.total - completionStats.attempted) !== 1 ? "s" : ""} this week
                    </p>
                    <p className="text-[10px] text-mist-dark mt-0.5">
                      Filter by &quot;Never Attempted&quot; to find exercises you haven&apos;t tried yet.
                    </p>
                  </div>
                )}
              </GlowCard>
            </div>
          )
        )}

        {/* ===== OVERVIEW STATS ===== */}
        <GlowCard glow="jade" hoverable={false} className="completionist-modern-overview">
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">{t("Overview", "normal")}</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-mist-dark">{t("Skills", "normal")}: <span className="text-cloud-white font-semibold">{stats.total}</span></span>
            <span className="text-mist-dark">{t("Active (14d)", "normal")}: <span className="text-jade-glow font-semibold">{stats.active}</span></span>
            <span className="text-mist-dark">{t("Sessions", "normal")}: <span className="text-cloud-white font-semibold">{stats.totalSessions}</span></span>
          </div>
        </GlowCard>

        {/* ===== FILTERS ===== */}
        <GlowCard glow="jade" hoverable={false} className="completionist-modern-filters">
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">{t("Filters", "normal")}</h3>
          {isMobile ? (
            /* --- MOBILE: stacked filter buttons --- */
            <div className="grid gap-2.5">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-mist-dark">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search skill...", "normal")}
                  style={{
                    paddingLeft: "1.75rem",
                    paddingRight: search ? "1.75rem" : undefined,
                  }}
                  className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-1 flex items-center justify-center px-1 text-mist-dark"
                    aria-label={t("Clear search", "normal")}
                    title={t("Clear", "normal")}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setMobileFilterPicker({ field: "category", title: t("Category", "normal") })}
                className={`${controlClassName} flex items-center justify-between border-ink-light bg-ink-dark text-cloud-white`}
                aria-label={t("Category filter", "normal")}
              >
                <span>
                  {categoryFilterOptions.find((option) => option.value === categoryFilter)?.label ?? t("All Categories", "normal")}
                </span>
                <span aria-hidden>▾</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterPicker({ field: "activity", title: t("Activity", "normal") })}
                className={`${controlClassName} flex items-center justify-between border-ink-light bg-ink-dark text-cloud-white`}
                aria-label={t("Activity filter", "normal")}
              >
                <span>
                  {activityFilterOptions.find((option) => option.value === activityFilter)?.label ?? t("All Skills", "normal")}
                </span>
                <span aria-hidden>▾</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterPicker({ field: "sort", title: t("Sort", "normal") })}
                className={`${controlClassName} flex items-center justify-between border-ink-light bg-ink-dark text-cloud-white`}
                aria-label={t("Sort filter", "normal")}
              >
                <span>
                  {sortByOptions.find((option) => option.value === sortBy)?.label ?? t("Sort: Recently trained", "normal")}
                </span>
                <span aria-hidden>▾</span>
              </button>
              <button
                type="button"
                onClick={() => setAttemptedParentsOnly((prev) => !prev)}
                className="w-full rounded-lg border px-2 py-1.5 text-xs transition-colors duration-150"
                style={{
                  borderColor: attemptedParentsOnly ? "var(--jade-glow)" : "var(--border)",
                  color: attemptedParentsOnly ? "var(--jade-glow)" : "var(--text-secondary)",
                  backgroundColor: attemptedParentsOnly
                    ? "color-mix(in srgb, var(--jade-glow) 10%, var(--surface))"
                    : "var(--ink-dark)",
                }}
              >
                {attemptedParentsOnly ? t("Showing: Attempted Exercises", "normal") : t("Show Attempted Exercises Only", "normal")}
              </button>
            </div>
          ) : (
            /* --- DESKTOP: inline row of filters --- */
            <div className="grid gap-2.5 grid-cols-5">
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-mist-dark">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                    <circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M13.5 13.5L18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("Search skill...", "normal")}
                  style={{
                    paddingLeft: "1.75rem",
                    paddingRight: search ? "1.75rem" : undefined,
                  }}
                  className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute inset-y-0 right-1 flex items-center justify-center px-1 text-mist-dark"
                    aria-label={t("Clear search", "normal")}
                    title={t("Clear", "normal")}
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none" aria-hidden>
                      <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
                className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
              >
                {categoryFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
              >
                {activityFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
              >
                {sortByOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setAttemptedParentsOnly((prev) => !prev)}
                className="w-full rounded-lg border px-2 py-1.5 text-xs transition-colors duration-150"
                style={{
                  borderColor: attemptedParentsOnly ? "var(--jade-glow)" : "var(--border)",
                  color: attemptedParentsOnly ? "var(--jade-glow)" : "var(--text-secondary)",
                  backgroundColor: attemptedParentsOnly
                    ? "color-mix(in srgb, var(--jade-glow) 10%, var(--surface))"
                    : "var(--ink-dark)",
                }}
              >
                {attemptedParentsOnly ? t("Showing: Attempted Exercises", "normal") : t("Show Attempted Exercises Only", "normal")}
              </button>
            </div>
          )}
        </GlowCard>

        {/* ===== ERROR / LOADING / EMPTY ===== */}
        {errorMessage ? (
          <GlowCard glow="crimson" hoverable={false}>
            <p className="text-xs text-crimson-light">{errorMessage}</p>
          </GlowCard>
        ) : null}

        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark">{t("Loading rank-up data...", "normal")}</p>
          </GlowCard>
        ) : null}

        {!loading && visibleSkills.length === 0 ? (
          <GlowCard glow="none" hoverable={false}>
            <p className="text-sm text-mist-dark">{t("No skills found for the current filters.", "normal")}</p>
          </GlowCard>
        ) : null}

        {/* ===== EXERCISE LIST ===== */}
        {!loading && (
          isMobile ? (
            /* --- MOBILE: Collapsible card-based list --- */
            visibleSkills.map((skill) => {
              const isExpanded = Boolean(expandedIds[skill.id]);
              const skillDisplayName = getExerciseDisplayName(
                {
                  name: skill.englishName || skill.name,
                  wuxiaName: skill.vietnameseName || skill.wuxiaName,
                  englishName: skill.englishName,
                  vietnameseName: skill.vietnameseName,
                },
                displayTerminologyMode,
                settings.showExerciseForeignLanguage,
              );
              const hasAttempted = skill.performed > 0;
              return (
                <GlowCard key={skill.id} glow="jade" hoverable={false} className="completionist-modern-skill-mobile overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(skill.id)}
                    aria-expanded={isExpanded}
                    className="w-full px-3 py-2 text-left border-b border-ink-light cursor-pointer transition-all duration-150 hover:bg-ink-dark/50 active:opacity-80 focus-visible:opacity-100"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center border border-ink-light text-[10px] leading-none text-mist-dark"
                      >
                        {isExpanded ? "-" : "+"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {hasAttempted ? (
                            <span className="text-jade-glow text-xs">✓</span>
                          ) : (
                            <span className="text-mist-dark/40 text-xs">○</span>
                          )}
                          <p
                            className="text-sm font-semibold truncate transition-colors duration-150"
                            style={{ color: isExpanded ? "var(--jade-glow)" : "var(--cloud-white)" }}
                          >
                            {skillDisplayName}
                          </p>
                        </div>
                      </div>
                      <span className="text-[10px] text-mist-dark shrink-0">
                        {getCategoryEmoji(skill.category)}
                      </span>
                    </div>
                    <p className="text-[11px] text-mist-dark mt-1 ml-7">
                      Sessions:{" "}
                      <span className={skill.performed > 0 ? "text-jade-glow font-semibold" : "text-mist-dark"}>
                        {skill.performed}
                      </span>
                      {" "}| Last: {formatDate(skill.lastLogAt)} | Tiers: {skill.tierNames.length}
                    </p>
                  </button>

                  <AnimatePresence initial={false}>
                    {isExpanded ? (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="space-y-2.5 p-2.5">
                          {skill.tierNames.map((tierName, index) => {
                            const stat = skill.tierStats[index];
                            const showKey = `show-${skill.id}-${index}`;
                            const trainKey = `train-${skill.id}-${index}`;
                            const attemptCount = stat?.attempts ?? 0;
                            const isZeroAttempt = attemptCount === 0;
                            const rowTextColor = "var(--text-primary)";
                            const rowDetailTextColor = isZeroAttempt
                              ? "color-mix(in srgb, var(--text-secondary) 78%, var(--surface) 22%)"
                              : rowTextColor;
                            const rowBgColor = isZeroAttempt
                              ? "color-mix(in srgb, var(--surface) 88%, black)"
                              : "color-mix(in srgb, var(--surface) 96%, var(--border))";
                            const lastPerformedAt = stat?.lastPerformedAt ?? null;
                            const daysAgoLabel = formatDaysAgo(lastPerformedAt);
                            const href = `/dashboard/train/input/${encodeURIComponent(`${skill.id}-${index + 1}`)}?prefillExerciseId=${encodeURIComponent(skill.id)}&prefillExercise=${encodeURIComponent(skill.name)}&prefillProgression=${encodeURIComponent(tierName)}`;
                            const historyHref = `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(skill.id)}?progressionLevel=${index + 1}`;

                            return (
                              <div
                                key={`${skill.id}-tier-mobile-${index}`}
                                className={`rounded border p-2 ${isZeroAttempt ? "rank-up-inactive" : ""}`}
                                style={{
                                  borderColor: "var(--nyaa-table-grid)",
                                  backgroundColor: rowBgColor,
                                  color: rowTextColor,
                                }}
                              >
                                <div className="mb-1 text-sm font-semibold" style={{ color: rowTextColor }}>{tierName}</div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]" style={{ color: rowDetailTextColor }}>
                                  <span>Attempts: {attemptCount}</span>
                                  <span>Best: {stat ? formatBest(stat) : "-"}</span>
                                  <span>Best Reps: {stat?.bestReps != null ? `${stat.bestReps}` : "-"}</span>
                                  <span>Best Hold: {stat?.bestHoldSeconds != null ? `${stat.bestHoldSeconds}s` : "-"}</span>
                                  <span>Best Weight: {stat?.bestWeight != null ? `${stat.bestWeight} kg` : "-"}</span>
                                  <span>Last: {formatDate(lastPerformedAt)}</span>
                                  <span>Days Ago: {daysAgoLabel}</span>
                                </div>
                                <div className="mt-2 flex gap-2">
                                  <Link
                                    href={historyHref}
                                    onMouseEnter={() => setHoveredActionKey(showKey)}
                                    onMouseLeave={() => setHoveredActionKey((prev) => (prev === showKey ? null : prev))}
                                    onFocus={() => setHoveredActionKey(showKey)}
                                    onBlur={() => setHoveredActionKey((prev) => (prev === showKey ? null : prev))}
                                    className="inline-flex flex-1 items-center justify-center gap-1 border px-2 py-1 text-[11px] font-medium transition-all duration-150 active:opacity-75"
                                    style={{
                                      borderColor: hoveredActionKey === showKey
                                        ? "var(--link-hover)"
                                        : isZeroAttempt
                                          ? "color-mix(in srgb, var(--text-muted) 14%, var(--border))"
                                          : "color-mix(in srgb, var(--link) 30%, var(--border))",
                                      color: hoveredActionKey === showKey
                                        ? "var(--link-hover)"
                                        : isZeroAttempt
                                          ? "color-mix(in srgb, var(--text-muted) 52%, var(--surface))"
                                          : "var(--link)",
                                      backgroundColor:
                                        hoveredActionKey === showKey
                                          ? "color-mix(in srgb, var(--link) 14%, var(--surface))"
                                          : isZeroAttempt
                                            ? "color-mix(in srgb, var(--text-muted) 26%, var(--surface))"
                                            : "color-mix(in srgb, var(--link) 6%, var(--surface))",
                                    }}
                                  >
                                    Show ↗
                                  </Link>
                                  <Link
                                    href={href}
                                    onMouseEnter={() => setHoveredActionKey(trainKey)}
                                    onMouseLeave={() => setHoveredActionKey((prev) => (prev === trainKey ? null : prev))}
                                    onFocus={() => setHoveredActionKey(trainKey)}
                                    onBlur={() => setHoveredActionKey((prev) => (prev === trainKey ? null : prev))}
                                    className="inline-flex flex-1 items-center justify-center gap-1 border px-2 py-1 text-[11px] font-medium transition-all duration-150 active:opacity-75"
                                    style={{
                                      borderColor:
                                        hoveredActionKey === trainKey
                                          ? "var(--link-hover)"
                                          : "var(--link)",
                                      color:
                                        hoveredActionKey === trainKey
                                          ? "var(--link-hover)"
                                          : "var(--link)",
                                      backgroundColor:
                                        hoveredActionKey === trainKey
                                          ? "color-mix(in srgb, var(--link) 16%, var(--surface))"
                                          : "color-mix(in srgb, var(--link) 7%, var(--surface))",
                                    }}
                                  >
                                    Train
                                  </Link>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </GlowCard>
              );
            })
          ) : (
            /* --- DESKTOP: Rich table-based exercise grid --- */
            <GlowCard glow="jade" hoverable={false} className="completionist-modern-skill-desktop">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-ink-light">
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase w-8">✓</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Exercise</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Category</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Tiers</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Sessions</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Last Trained</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Days Ago</th>
                      <th className="px-3 py-2 text-left text-xs text-jade-glow uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSkills.map((skill) => {
                      const isExpanded = Boolean(expandedIds[skill.id]);
                      const hasAttempted = skill.performed > 0;
                      const skillDisplayName = getExerciseDisplayName(
                        {
                          name: skill.englishName || skill.name,
                          wuxiaName: skill.vietnameseName || skill.wuxiaName,
                          englishName: skill.englishName,
                          vietnameseName: skill.vietnameseName,
                        },
                        displayTerminologyMode,
                        settings.showExerciseForeignLanguage,
                      );

                      const rowBg = hasAttempted ? "transparent" : "color-mix(in srgb, var(--surface) 88%, black)";

                      return (
                        <React.Fragment key={skill.id}>
                          <tr
                            className="border-b border-ink-light/50 cursor-pointer hover:bg-ink-dark/30 transition-colors duration-100"
                            style={{ backgroundColor: rowBg }}
                            onClick={() => toggleExpand(skill.id)}
                          >
                            <td className="px-3 py-2.5">
                              {hasAttempted ? (
                                <span className="text-jade-glow text-sm">✓</span>
                              ) : (
                                <span className="text-mist-dark/40 text-sm">○</span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span
                                className="font-semibold text-sm transition-colors duration-150"
                                style={{ color: isExpanded ? "var(--jade-glow)" : hasAttempted ? "var(--cloud-white)" : "var(--text-secondary)" }}
                              >
                                {skillDisplayName}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-mist-dark">
                              {getCategoryEmoji(skill.category)} {skill.category}
                            </td>
                            <td className="px-3 py-2.5 text-cloud-white">{skill.tierNames.length}</td>
                            <td className="px-3 py-2.5">
                              <span className={skill.performed > 0 ? "text-jade-glow font-semibold" : "text-mist-dark"}>
                                {skill.performed}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-mist-dark">{formatDate(skill.lastLogAt)}</td>
                            <td className="px-3 py-2.5 text-mist-dark">{formatDaysAgo(skill.lastLogAt)}</td>
                            <td className="px-3 py-2.5">
                              <span className="text-mist-dark text-[11px]">
                                {isExpanded ? "▲ Collapse" : "▼ Expand"}
                              </span>
                            </td>
                          </tr>
                          <AnimatePresence initial={false}>
                            {isExpanded ? (
                              <motion.tr
                                key={`${skill.id}-expanded-row`}
                                initial={{ opacity: 1 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12, ease: [0.22, 1, 0.36, 1] }}
                              >
                                <td colSpan={8} className="p-0">
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
                                    style={{ overflow: "hidden" }}
                                  >
                                    <div className="px-4 py-3" style={{ backgroundColor: "color-mix(in srgb, var(--surface) 95%, var(--jade-glow) 5%)" }}>
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-ink-light/30">
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Tier</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Attempts</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Best</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Best Reps</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Best Hold</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Best Weight</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Last</th>
                                          <th className="px-2 py-1.5 text-left text-[10px] text-jade-glow/70 uppercase">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {skill.tierNames.map((tierName, index) => {
                                          const stat = skill.tierStats[index];
                                          const showKey = `show-${skill.id}-${index}`;
                                          const trainKey = `train-${skill.id}-${index}`;
                                          const attemptCount = stat?.attempts ?? 0;
                                          const isZeroAttempt = attemptCount === 0;
                                          const lastPerformedAt = stat?.lastPerformedAt ?? null;
                                          const href = `${DASHBOARD_ROUTES.workoutHistory}?prefillExerciseId=${encodeURIComponent(skill.id)}&prefillExercise=${encodeURIComponent(skill.name)}&prefillProgression=${encodeURIComponent(tierName)}`;
                                          const historyHref = `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(skill.id)}?progressionLevel=${index + 1}`;

                                          return (
                                            <tr
                                              key={`${skill.id}-tier-${index}`}
                                              className={`transition-colors duration-100 ${isZeroAttempt ? "" : "hover:bg-ink-dark/20"}`}
                                              style={{
                                                color: isZeroAttempt ? "var(--text-secondary)" : "var(--text-primary)",
                                                opacity: isZeroAttempt ? 0.7 : 1,
                                              }}
                                            >
                                              <td className="px-2 py-1.5 font-medium">{tierName}</td>
                                              <td className="px-2 py-1.5">{attemptCount}</td>
                                              <td className="px-2 py-1.5">{stat ? formatBest(stat) : "-"}</td>
                                              <td className="px-2 py-1.5">{stat?.bestReps != null ? `${stat.bestReps}` : "-"}</td>
                                              <td className="px-2 py-1.5">{stat?.bestHoldSeconds != null ? `${stat.bestHoldSeconds}s` : "-"}</td>
                                              <td className="px-2 py-1.5">{stat?.bestWeight != null ? `${stat.bestWeight} kg` : "-"}</td>
                                              <td className="px-2 py-1.5">{formatDate(lastPerformedAt)}</td>
                                              <td className="px-2 py-1.5">
                                                <div className="flex gap-1.5">
                                                  <Link
                                                    href={historyHref}
                                                    onMouseEnter={() => setHoveredActionKey(showKey)}
                                                    onMouseLeave={() => setHoveredActionKey((prev) => (prev === showKey ? null : prev))}
                                                    className="inline-flex items-center gap-1 border rounded px-2 py-0.5 font-medium transition-all duration-150"
                                                    style={{
                                                      borderColor: hoveredActionKey === showKey
                                                        ? "var(--link-hover)"
                                                        : isZeroAttempt
                                                          ? "color-mix(in srgb, var(--text-muted) 14%, var(--border))"
                                                          : "color-mix(in srgb, var(--link) 30%, var(--border))",
                                                      color: hoveredActionKey === showKey
                                                        ? "var(--link-hover)"
                                                        : isZeroAttempt
                                                          ? "color-mix(in srgb, var(--text-muted) 52%, var(--surface))"
                                                          : "var(--link)",
                                                      backgroundColor:
                                                        hoveredActionKey === showKey
                                                          ? "color-mix(in srgb, var(--link) 14%, var(--surface))"
                                                          : "color-mix(in srgb, var(--link) 4%, transparent)",
                                                    }}
                                                  >
                                                    Show ↗
                                                  </Link>
                                                  <Link
                                                    href={href}
                                                    onMouseEnter={() => setHoveredActionKey(trainKey)}
                                                    onMouseLeave={() => setHoveredActionKey((prev) => (prev === trainKey ? null : prev))}
                                                    className="inline-flex items-center gap-1 border rounded px-2 py-0.5 font-medium transition-all duration-150"
                                                    style={{
                                                      borderColor:
                                                        hoveredActionKey === trainKey
                                                          ? "var(--link-hover)"
                                                          : "var(--link)",
                                                      color:
                                                        hoveredActionKey === trainKey
                                                          ? "var(--link-hover)"
                                                          : "var(--link)",
                                                      backgroundColor:
                                                        hoveredActionKey === trainKey
                                                          ? "color-mix(in srgb, var(--link) 16%, var(--surface))"
                                                          : "color-mix(in srgb, var(--link) 5%, transparent)",
                                                    }}
                                                  >
                                                    Train
                                                  </Link>
                                                </div>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                    </div>
                                  </motion.div>
                                </td>
                              </motion.tr>
                            ) : null}
                          </AnimatePresence>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Desktop summary footer */}
              <div className="flex items-center justify-between border-t border-ink-light px-3 py-2 mt-1 text-[11px] text-mist-dark">
                <span>
                  Showing {visibleSkills.length} of {skills.length} exercises
                </span>
                <span>
                  <span className="text-jade-glow font-semibold">{visibleSkills.filter((s) => s.performed > 0).length}</span> attempted
                  {" / "}
                  <span className="text-mist-dark">{visibleSkills.filter((s) => s.performed === 0).length}</span> remaining
                </span>
              </div>
            </GlowCard>
          )
        )}

        {/* ===== MOBILE FILTER PICKER PORTAL ===== */}
        {isMobile && typeof document !== "undefined" &&
          createPortal(
            <AnimatePresence>
              {mobileFilterPicker && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[95] bg-black/65"
                    onClick={() => setMobileFilterPicker(null)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 16, scale: 0.98 }}
                    className="fixed left-1/2 top-1/2 z-[96] max-h-[72vh] w-[min(82vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-ink-light bg-ink-deep"
                    style={{ boxShadow: "var(--shadow-elev-2)" }}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-ink-light px-4 py-3">
                      <p className="text-sm text-jade-glow uppercase tracking-wider">
                        {mobileFilterPicker.title}
                      </p>
                      <GlowButton variant="ghost" size="sm" onClick={() => setMobileFilterPicker(null)}>
                        {t("Close", "normal")}
                      </GlowButton>
                    </div>

                    <div className="relative px-3 pb-3 pt-2">
                      <div
                        className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 rounded border border-jade-glow/40 bg-jade-glow/10"
                      />
                      <div
                        ref={mobileFilterWheelScrollRef}
                        className="h-56 overflow-y-auto snap-y snap-mandatory"
                        style={{
                          paddingTop: "90px",
                          paddingBottom: "90px",
                          scrollbarWidth: "none",
                        }}
                      >
                        {mobileFilterPickerOptions.map((option) => {
                          const isActive = option.value === mobileFilterPickerCurrentValue;
                          return (
                            <button
                              key={`${mobileFilterPicker.field}-wheel-${option.value}`}
                              type="button"
                              onClick={() => {
                                if (mobileFilterPicker.field === "category") {
                                  setCategoryFilter(option.value as CategoryFilter);
                                } else if (mobileFilterPicker.field === "activity") {
                                  setActivityFilter(option.value as ActivityFilter);
                                } else {
                                  setSortBy(option.value as SortBy);
                                }
                                setMobileFilterPicker(null);
                              }}
                              className="flex h-11 w-full snap-center items-center justify-center text-sm"
                              style={{
                                color: isActive ? "var(--cloud-white)" : "var(--text-secondary)",
                                fontWeight: isActive ? 700 : 500,
                              }}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                      {mobileFilterCanScrollDown && (
                        <>
                          <div
                            className="pointer-events-none absolute bottom-3 left-3 right-3 h-10"
                            style={{
                              background: "linear-gradient(to bottom, color-mix(in srgb, var(--surface) 0%, transparent), color-mix(in srgb, var(--surface) 92%, transparent))",
                            }}
                          />
                          <motion.div
                            className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2"
                            animate={{ y: [0, 4, 0], opacity: [0.65, 1, 0.65] }}
                            transition={{ duration: 1.15, ease: "easeInOut", repeat: Infinity }}
                            style={{ color: "var(--text-secondary)" }}
                          >
                            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" aria-hidden>
                              <path d="M5 8l5 5 5-5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </motion.div>
                        </>
                      )}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>,
            document.body,
          )}
      </div>
    </PageLayout>
  );
}
