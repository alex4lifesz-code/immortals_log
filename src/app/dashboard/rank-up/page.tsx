"use client";

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

type RankUpSkill = {
  id: string;
  name: string;
  wuxiaName?: string;
  englishName?: string;
  vietnameseName?: string;
  tierNames: string[];
  tierStats: TierStats[];
  performed: number;
  lastLogAt: string | null;
  sessions14d: number;
};

type ProgressionsResponse = { exercises: ProgressionExercise[] };
type ActivityFilter = "all" | "active-7d" | "active-14d" | "active-30d" | "stale" | "never-attempted";
type SortBy = "recent" | "performed" | "least-sessions" | "name" | "most-tiers";
type MobileFilterPickerField = "activity" | "sort";

interface MobileFilterPickerState {
  field: MobileFilterPickerField;
  title: string;
}

function isCalisthenicsCategory(category: string | null | undefined): boolean {
  const lower = String(category || "").trim().toLowerCase();
  return lower.includes("calisthenics") || lower.includes("cali");
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

export default function RankUpPage() {
  const isMobile = useIsMobile();
  const { settings } = useDisplaySettings();
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [skills, setSkills] = useState<RankUpSkill[]>([]);
  const [search, setSearch] = useState("");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [mobileFilterPicker, setMobileFilterPicker] = useState<MobileFilterPickerState | null>(null);
  const [mobileFilterCanScrollDown, setMobileFilterCanScrollDown] = useState(false);
  const mobileFilterWheelScrollRef = useRef<HTMLDivElement | null>(null);
  const [attemptedParentsOnly, setAttemptedParentsOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [hoveredActionKey, setHoveredActionKey] = useState<string | null>(null);

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
        const mapped: RankUpSkill[] = (data.exercises ?? [])
          .filter((exercise) => isCalisthenicsCategory(exercise.category))
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
        console.error("Failed to load rank-up skills", error);
        setErrorMessage("Could not load rank-up data. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    };

    void loadSkills();
  }, []);

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
        settings.terminologyMode,
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
  }, [skills, search, activityFilter, sortBy, attemptedParentsOnly, settings.terminologyMode, settings.showExerciseForeignLanguage]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const mobileFilterPickerOptions = useMemo(() => {
    if (!mobileFilterPicker) return [] as Array<{ value: string; label: string }>;
    if (mobileFilterPicker.field === "activity") {
      return activityFilterOptions.map((option) => ({ value: option.value, label: option.label }));
    }
    return sortByOptions.map((option) => ({ value: option.value, label: option.label }));
  }, [mobileFilterPicker, activityFilterOptions, sortByOptions]);

  const mobileFilterPickerCurrentValue = useMemo(() => {
    if (!mobileFilterPicker) return "";
    return mobileFilterPicker.field === "activity" ? activityFilter : sortBy;
  }, [mobileFilterPicker, activityFilter, sortBy]);

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

  return (
    <PageLayout
      title={t("Rank Up", "normal")}
      subtitle={t("Simple progression overview for calisthenics skills", "normal")}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-6 px-0 py-2 sm:py-3">
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">{t("Overview", "normal")}</h3>
          <div className="flex flex-wrap gap-4 text-xs">
            <span className="text-mist-dark">{t("Skills", "normal")}: <span className="text-cloud-white font-semibold">{stats.total}</span></span>
            <span className="text-mist-dark">{t("Active (14d)", "normal")}: <span className="text-jade-glow font-semibold">{stats.active}</span></span>
            <span className="text-mist-dark">{t("Sessions", "normal")}: <span className="text-cloud-white font-semibold">{stats.totalSessions}</span></span>
          </div>
        </GlowCard>

        <GlowCard glow="jade" hoverable={false}>
          <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">{t("Filters", "normal")}</h3>
          <div className="grid gap-2.5 sm:grid-cols-3">
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
            {isMobile ? (
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
            ) : (
              <select
                value={activityFilter}
                onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
                className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
              >
                {activityFilterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
            {isMobile ? (
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
            ) : (
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
                className={`${controlClassName} border-ink-light bg-ink-dark text-cloud-white`}
              >
                {sortByOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            )}
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
        </GlowCard>

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

        {!loading &&
          visibleSkills.map((skill) => {
            const isExpanded = Boolean(expandedIds[skill.id]);
            const skillDisplayName = getExerciseDisplayName(
              {
                name: skill.englishName || skill.name,
                wuxiaName: skill.vietnameseName || skill.wuxiaName,
                englishName: skill.englishName,
                vietnameseName: skill.vietnameseName,
              },
              settings.terminologyMode,
              settings.showExerciseForeignLanguage,
            );
            return (
              <GlowCard key={skill.id} glow="jade" hoverable={false} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(skill.id)}
                  aria-expanded={isExpanded}
                  className="w-full px-3 py-2 text-left border-b border-ink-light cursor-pointer transition-all duration-150 hover:bg-ink-dark/50 active:opacity-80 focus-visible:opacity-100"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center border border-ink-light text-[10px] leading-none text-mist-dark"
                      >
                        {isExpanded ? "-" : "+"}
                      </span>
                      <p
                        className="text-sm font-semibold transition-colors duration-150"
                        style={{ color: isExpanded ? "var(--jade-glow)" : "var(--cloud-white)" }}
                      >
                        {skillDisplayName}
                      </p>
                    </div>
                    <p className="text-[11px] text-mist-dark">
                      Sessions:{" "}
                      <span className={skill.performed > 0 ? "text-jade-glow font-semibold" : "text-mist-dark"}>
                        {skill.performed}
                      </span>
                      {" "}| Last: {formatDate(skill.lastLogAt)} | Tiers: {skill.tierNames.length}
                    </p>
                  </div>
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
                      {isMobile ? (
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
                      ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-ink-light">
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Tier</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Attempts</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Best</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Best Reps</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Best Hold</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Best Weight</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Last</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Days Ago</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Show History</th>
                          <th className="px-2 py-1.5 text-left text-xs text-jade-glow uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {skill.tierNames.map((tierName, index) => {
                          const stat = skill.tierStats[index];
                          const showKey = `show-${skill.id}-${index}`;
                          const trainKey = `train-${skill.id}-${index}`;
                          const attemptCount = stat?.attempts ?? 0;
                          const isZeroAttempt = attemptCount === 0;
                          const rowTextColor = "var(--text-primary)";
                          const rowBgColor = isZeroAttempt
                            ? "color-mix(in srgb, var(--surface) 88%, black)"
                            : "transparent";
                          const cellStyle = {
                            backgroundColor: rowBgColor,
                            color: rowTextColor,
                          };
                          const lastPerformedAt = stat?.lastPerformedAt ?? null;
                          const daysAgoLabel = formatDaysAgo(lastPerformedAt);
                          const href = `${DASHBOARD_ROUTES.workoutHistory}?prefillExerciseId=${encodeURIComponent(skill.id)}&prefillExercise=${encodeURIComponent(skill.name)}&prefillProgression=${encodeURIComponent(tierName)}`;
                          const historyHref = `${DASHBOARD_ROUTES.workoutHistory}/${encodeURIComponent(skill.id)}?progressionLevel=${index + 1}`;
                          return (
                            <tr
                              key={`${skill.id}-tier-${index}`}
                              className={`transition-colors duration-150 ${isZeroAttempt ? "rank-up-inactive" : "hover:opacity-90"}`}
                              style={{
                                opacity: 1,
                                color: rowTextColor,
                                backgroundColor: rowBgColor,
                                filter: "none",
                              }}
                            >
                              <td className="px-2 py-1.5" style={cellStyle}>{tierName}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{attemptCount}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{stat ? formatBest(stat) : "-"}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{stat?.bestReps != null ? `${stat.bestReps}` : "-"}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{stat?.bestHoldSeconds != null ? `${stat.bestHoldSeconds}s` : "-"}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{stat?.bestWeight != null ? `${stat.bestWeight} kg` : "-"}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{formatDate(lastPerformedAt)}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>{daysAgoLabel}</td>
                              <td className="px-2 py-1.5" style={cellStyle}>
                                <Link
                                  href={historyHref}
                                  onMouseEnter={() => setHoveredActionKey(showKey)}
                                  onMouseLeave={() => setHoveredActionKey((prev) => (prev === showKey ? null : prev))}
                                  onFocus={() => setHoveredActionKey(showKey)}
                                  onBlur={() => setHoveredActionKey((prev) => (prev === showKey ? null : prev))}
                                  className="inline-flex items-center gap-1 border px-2 py-1 font-medium transition-all duration-150 active:opacity-75"
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
                                    boxShadow:
                                      hoveredActionKey === showKey
                                        ? "0 0 0 1px color-mix(in srgb, var(--link) 35%, transparent)"
                                        : "none",
                                    transform: hoveredActionKey === showKey ? "translateY(-1px)" : "translateY(0)",
                                  }}
                                >
                                  Show ↗
                                </Link>
                              </td>
                              <td className="px-2 py-1.5" style={cellStyle}>
                                <Link
                                  href={href}
                                  onMouseEnter={() => setHoveredActionKey(trainKey)}
                                  onMouseLeave={() => setHoveredActionKey((prev) => (prev === trainKey ? null : prev))}
                                  onFocus={() => setHoveredActionKey(trainKey)}
                                  onBlur={() => setHoveredActionKey((prev) => (prev === trainKey ? null : prev))}
                                  className="inline-flex items-center gap-1 border px-2 py-1 font-medium transition-all duration-150 active:opacity-75"
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
                                    boxShadow:
                                      hoveredActionKey === trainKey
                                        ? "0 0 0 1px color-mix(in srgb, var(--link) 45%, transparent)"
                                        : "none",
                                    transform: hoveredActionKey === trainKey ? "translateY(-1px)" : "translateY(0)",
                                  }}
                                >
                                  Train
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                        </table>
                      </div>
                      )}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </GlowCard>
            );
          })}

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
                                if (mobileFilterPicker.field === "activity") {
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
