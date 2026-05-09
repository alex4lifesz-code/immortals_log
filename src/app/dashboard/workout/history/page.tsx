"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import SearchField from "@/components/ui/SearchField";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { translateEnglishToLanguage } from "@/lib/language";
import type { ProgressionExercise, ProgressionLog } from "../types";

type WorkoutHistoryEntry = {
  id: string;
  exerciseId: string;
  exerciseName: string;
  category: string;
  progressionLabel: string;
  log: ProgressionLog;
  sourceType: "individual" | "combo";
};

function compareLogRecency(a: Pick<ProgressionLog, "id" | "createdAt">, b: Pick<ProgressionLog, "id" | "createdAt">): number {
  const timeDiff = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  if (timeDiff !== 0) return timeDiff;
  return b.id.localeCompare(a.id);
}

function formatRelativeRecentDate(
  dateLike: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy" = "dd-mmm-yyyy",
  timeZone?: string,
): string {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) return `${Math.max(1, Math.floor(diffMs / minuteMs))}m ago`;
  if (diffMs < dayMs) return `${Math.max(1, Math.floor(diffMs / hourMs))}h ago`;
  if (diffMs < 14 * dayMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return formatDateWithPreference(new Date(timestamp), dateFormat, timeZone);
}

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);

  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<WorkoutHistoryEntry[]>([]);
  const [search, setSearch] = useState("");

  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";

  useEffect(() => {
    if (!user?.id) {
      setEntries([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const data = await api.get<{ exercises: ProgressionExercise[] }>("/api/progressions/history?logLimit=200&exerciseLimit=5000");
        if (cancelled) return;

        const source = Array.isArray(data.exercises) ? data.exercises : [];
        const nextEntries = source
          .flatMap((exercise) => {
            const logs = [...(exercise.userProgress?.[0]?.logs ?? [])].sort(compareLogRecency);
            if (logs.length === 0) return [] as WorkoutHistoryEntry[];
            return logs.map((log) => ({
              id: log.id,
              exerciseId: exercise.id,
              exerciseName: exercise.name,
              category: (exercise.category || "Other").trim() || "Other",
              progressionLabel: exercise.tiers.find((tier) => tier.level === log.level)?.name ?? `Progression ${log.level}`,
              log,
              sourceType: "individual" as const,
            }));
          })
          .sort((a, b) => compareLogRecency(a.log, b.log));

        const entriesByTimestamp = new Map<string, WorkoutHistoryEntry[]>();
        nextEntries.forEach((entry) => {
          const existing = entriesByTimestamp.get(entry.log.createdAt) ?? [];
          existing.push(entry);
          entriesByTimestamp.set(entry.log.createdAt, existing);
        });

        entriesByTimestamp.forEach((entriesAtTimestamp) => {
          if (entriesAtTimestamp.length < 2) return;
          const distinctExerciseCount = new Set(entriesAtTimestamp.map((entry) => entry.exerciseId)).size;
          if (distinctExerciseCount < 2) return;
          entriesAtTimestamp.forEach((entry) => {
            entry.sourceType = "combo";
          });
        });

        setEntries(nextEntries);
      } catch {
        if (!cancelled) setEntries([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => {
      const variant = entry.log.variant?.trim() || "";
      const notes = entry.log.notes?.trim() || "";
      return `${entry.exerciseName} ${entry.category} ${entry.progressionLabel} ${variant} ${notes}`.toLowerCase().includes(query);
    });
  }, [entries, search]);

  return (
    <PageLayout
      title={lt("Workout History")}
      subtitle={lt("Tap an entry to view full details")}
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3">
        <section
          className="overflow-hidden rounded-xl border"
          style={{
            borderColor: "color-mix(in srgb, var(--ink-light) 58%, transparent)",
            backgroundColor: "color-mix(in srgb, var(--ink-deep) 95%, var(--ink-mid))",
          }}
        >
          <div
            className="border-b px-3 py-2.5 sm:px-4"
            style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 40%, transparent)" }}
          >
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder={lt("Search exercise history")}
              aria-label={lt("Search exercise history")}
              className="rounded-lg py-2 text-sm text-cloud-white"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-mid) 88%, var(--ink-deep))",
              }}
            />
          </div>

          <div>
            {loading ? (
              <div className="px-4 py-8 text-sm text-mist-light">{lt("Loading workout history...")}</div>
            ) : visibleEntries.length === 0 ? (
              <div className="px-4 py-8 text-sm text-mist-light">{lt("No workout history found.")}</div>
            ) : (
              visibleEntries.map((entry) => {
                const variationValue = entry.log.variant?.trim() || "-";
                const composedExerciseName = `${variationValue !== "-" ? `${variationValue} ` : ""}${entry.progressionLabel} ${entry.exerciseName}`.replace(/\s+/g, " ").trim();
                return (
                  <button
                    key={`workout-history-entry-${entry.id}`}
                    type="button"
                    onClick={() => router.push(`/dashboard/workout/history/${encodeURIComponent(entry.id)}`)}
                    className="mx-1 my-0.5 rounded-md px-3 py-2.5 text-left"
                    style={{
                      width: "calc(100% - 0.5rem)",
                      backgroundColor: "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="truncate text-sm font-normal italic leading-tight" style={{ color: "var(--text-muted)" }}>
                              {composedExerciseName}
                          </p>
                          {entry.sourceType === "combo" ? (
                            <span
                              className="shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em]"
                              style={{
                                borderColor: "color-mix(in srgb, var(--gold) 54%, transparent)",
                                backgroundColor: "color-mix(in srgb, var(--gold) 14%, transparent)",
                                color: "var(--gold)",
                              }}
                            >
                              {lt("Combo")}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                        {formatRelativeRecentDate(entry.log.createdAt, dateFormat, settings.timeZone)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
