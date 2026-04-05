"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
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
  const [attemptedParentsOnly, setAttemptedParentsOnly] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [hoveredActionKey, setHoveredActionKey] = useState<string | null>(null);

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

  const controlClassName =
    "w-full border rounded px-2 py-1.5 text-xs outline-none transition-all duration-150";

  return (
    <PageLayout
      title={t("Rank Up", "normal")}
      subtitle={t("Simple progression overview for calisthenics skills", "normal")}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        <div className="border rounded px-3 py-2" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--header-bg)" }}>
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            {t("Skills", "normal")}: {stats.total} | {t("Active (14d)", "normal")}: {stats.active} | {t("Sessions", "normal")}: {stats.totalSessions}
          </p>
        </div>

        <div className="border rounded overflow-hidden" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--surface)" }}>
          <div className="px-3 py-2 border-b" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--nyaa-table-head-bg)" }}>
            <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-secondary)" }}>{t("Filters", "normal")}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 p-2">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center" style={{ color: "var(--text-muted)" }}>
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
                className={controlClassName}
                style={{
                  borderColor: "var(--nyaa-table-grid)",
                  backgroundColor: "var(--surface)",
                  color: "var(--text-primary)",
                  paddingLeft: "1.75rem",
                  paddingRight: search ? "1.75rem" : undefined,
                }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute inset-y-0 right-1 flex items-center justify-center px-1"
                  style={{ color: "var(--text-muted)" }}
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
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value as ActivityFilter)}
              className={controlClassName}
              style={{
                borderColor: "var(--nyaa-table-grid)",
                backgroundColor: "var(--surface)",
                color: "var(--text-primary)",
              }}
            >
              <option value="all">{t("All Skills", "normal")}</option>
              <option value="active-7d">{t("Active (7 days)", "normal")}</option>
              <option value="active-14d">{t("Active (14 days)", "normal")}</option>
              <option value="active-30d">{t("Active (30 days)", "normal")}</option>
              <option value="stale">{t("Stale (30+ days ago)", "normal")}</option>
              <option value="never-attempted">{t("Never Attempted", "normal")}</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className={controlClassName}
              style={{
                borderColor: "var(--nyaa-table-grid)",
                backgroundColor: "var(--surface)",
                color: "var(--text-primary)",
              }}
            >
              <option value="recent">{t("Sort: Recently trained", "normal")}</option>
              <option value="performed">{t("Sort: Most sessions", "normal")}</option>
              <option value="least-sessions">{t("Sort: Least sessions", "normal")}</option>
              <option value="most-tiers">{t("Sort: Most tiers", "normal")}</option>
              <option value="name">{t("Sort: Name (A-Z)", "normal")}</option>
            </select>
            <button
              type="button"
              onClick={() => setAttemptedParentsOnly((prev) => !prev)}
              className="w-full rounded border px-2 py-1.5 text-xs transition-colors duration-150"
              style={{
                borderColor: attemptedParentsOnly ? "var(--accent)" : "var(--nyaa-table-grid)",
                color: attemptedParentsOnly ? "var(--accent)" : "var(--text-secondary)",
                backgroundColor: attemptedParentsOnly
                  ? "color-mix(in srgb, var(--accent) 10%, var(--surface))"
                  : "var(--surface)",
              }}
            >
              {attemptedParentsOnly ? t("Showing: Attempted Exercises", "normal") : t("Show Attempted Exercises Only", "normal")}
            </button>
          </div>
        </div>

        {errorMessage ? (
          <div className="border rounded px-3 py-2 text-xs" style={{ borderColor: "var(--danger)", color: "var(--danger)", backgroundColor: "color-mix(in srgb, var(--danger) 10%, var(--surface))" }}>
            {errorMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="border rounded px-3 py-6 text-sm" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
            {t("Loading rank-up data...", "normal")}
          </div>
        ) : null}

        {!loading && visibleSkills.length === 0 ? (
          <div className="border rounded px-3 py-6 text-sm" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--surface)", color: "var(--text-secondary)" }}>
            {t("No skills found for the current filters.", "normal")}
          </div>
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
              <div key={skill.id} className="border rounded overflow-hidden" style={{ borderColor: "var(--nyaa-table-grid)", backgroundColor: "var(--surface)" }}>
                <button
                  type="button"
                  onClick={() => toggleExpand(skill.id)}
                  aria-expanded={isExpanded}
                  className="w-full px-3 py-2 text-left border-b cursor-pointer transition-all duration-150 hover:opacity-95 active:opacity-80 focus-visible:opacity-100"
                  style={{
                    borderColor: "var(--nyaa-table-grid)",
                    backgroundColor: "var(--nyaa-table-head-bg)",
                    color: "var(--nyaa-table-head-text)",
                  }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex h-5 w-5 items-center justify-center border text-[10px] leading-none"
                        style={{ borderColor: "var(--nyaa-table-grid)", color: "var(--text-secondary)" }}
                      >
                        {isExpanded ? "-" : "+"}
                      </span>
                      <p
                        className="text-sm font-semibold transition-colors duration-150"
                        style={{ color: isExpanded ? "var(--link-hover)" : "var(--link)" }}
                      >
                        {skillDisplayName}
                      </p>
                    </div>
                    <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                      Sessions:{" "}
                      <span style={{ color: skill.performed > 0 ? "var(--accent)" : "var(--text-secondary)", fontWeight: skill.performed > 0 ? 600 : 400 }}>
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
                        <div className="space-y-2 p-2">
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
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]" style={{ color: rowDetailTextColor }}>
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
                        <tr>
                          <th className="px-2 py-1.5 text-left">Tier</th>
                          <th className="px-2 py-1.5 text-left">Attempts</th>
                          <th className="px-2 py-1.5 text-left">Best</th>
                          <th className="px-2 py-1.5 text-left">Best Reps</th>
                          <th className="px-2 py-1.5 text-left">Best Hold</th>
                          <th className="px-2 py-1.5 text-left">Best Weight</th>
                          <th className="px-2 py-1.5 text-left">Last</th>
                          <th className="px-2 py-1.5 text-left">Days Ago</th>
                          <th className="px-2 py-1.5 text-left">Show History</th>
                          <th className="px-2 py-1.5 text-left">Action</th>
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
              </div>
            );
          })}
      </div>
    </PageLayout>
  );
}
