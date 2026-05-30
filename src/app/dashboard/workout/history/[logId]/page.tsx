"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { formatDateWithPreference } from "@/lib/constants";
import { translateEnglishToLanguage } from "@/lib/language";
import { formatSetValue, type TimedUnitPref, type WeightUnit } from "@/lib/unit-conversion";
import type { ProgressionExercise, ProgressionLog } from "../../types";
import { parseModifierWithBand } from "../../utils";

type WorkoutMetricRow = { weight: string; reps: string };

type WorkoutHistoryDetail = {
  exerciseId: string;
  exerciseName: string;
  category: string;
  progressionLabel: string;
  log: ProgressionLog;
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

function getWorkoutMetricRows(log: ProgressionLog, displayUnit: WeightUnit = "kg", timedUnit: TimedUnitPref = "seconds"): WorkoutMetricRow[] {
  const hasHold = log.holdTime != null || log.holdTime2 != null || log.holdTime3 != null;
  const primaryRows = (hasHold
    ? [log.holdTime, log.holdTime2, log.holdTime3]
    : [log.weight1, log.weight2, log.weight3]
  )
    .map((metric, index) => {
      const reps = [log.reps1, log.reps2, log.reps3][index];
      if (metric == null && reps == null) return null;
      return {
        weight: metric == null ? "-" : formatSetValue(metric, hasHold ? "timed" : "weighted", displayUnit, undefined, timedUnit),
        reps: reps == null ? "-" : String(reps),
      };
    })
    .filter((row): row is WorkoutMetricRow => Boolean(row));

  const extraRows = Array.isArray(log.dynamicSetRows) ? log.dynamicSetRows : [];
  const rows = [...primaryRows, ...extraRows].filter((row) => row.weight !== "-" || row.reps !== "-");
  return rows.length > 0 ? rows : [{ weight: "-", reps: "-" }];
}

function normalizeGripLikeValue(value: string | null | undefined): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!normalized) return "";
  if (normalized.includes("neutral")) return "Neutral";
  if (normalized.includes("underhand") || normalized.includes("supinated") || normalized.includes("chin up")) return "Underhand";
  if (normalized.includes("overhand") || normalized.includes("pronated")) return "Overhand";
  if (normalized.includes("wide")) return "Wide";
  if (normalized.includes("close") || normalized.includes("narrow")) return "Close";
  if (normalized.includes("false")) return "False";
  if (normalized.includes("mixed")) return "Mixed";
  if (normalized.includes("ring")) return "Rings";
  if (normalized.includes("grip")) {
    return normalized
      .split(" ")
      .filter((part) => part !== "grip")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  }
  return "";
}

function getTextDisplayValue(value: string | null | undefined, emptyLabel = "-"): string {
  const trimmed = value?.trim() || "";
  if (!trimmed || trimmed === "-") return emptyLabel;
  return trimmed;
}

export default function WorkoutHistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ logId?: string | string[] }>();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);

  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WorkoutHistoryDetail | null>(null);

  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const weightUnit: WeightUnit = settings.defaultWeightUnit ?? "kg";
  const timedUnit: TimedUnitPref = settings.defaultTimedUnit ?? "seconds";

  const logId = useMemo(() => {
    const raw = params?.logId;
    return Array.isArray(raw) ? raw[0] || "" : raw || "";
  }, [params]);

  useEffect(() => {
    if (!user?.id || !logId) {
      setDetail(null);
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
        let found: WorkoutHistoryDetail | null = null;

        for (const exercise of source) {
          const logs = [...(exercise.userProgress?.[0]?.logs ?? [])].sort(compareLogRecency);
          const matched = logs.find((log) => log.id === logId);
          if (!matched) continue;

          found = {
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            category: (exercise.category || "Other").trim() || "Other",
            progressionLabel: exercise.tiers.find((tier) => tier.level === matched.level)?.name ?? `Progression ${matched.level}`,
            log: matched,
          };
          break;
        }

        setDetail(found);
      } catch {
        if (!cancelled) setDetail(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [logId, user?.id]);

  const composedExerciseName = useMemo(() => {
    if (!detail) return "";
    const variationValue = detail.log.variant?.trim() || "-";
    return `${variationValue !== "-" ? `${variationValue} ` : ""}${detail.progressionLabel} ${detail.exerciseName}`.replace(/\s+/g, " ").trim();
  }, [detail]);

  const metricRows = useMemo(() => {
    if (!detail) return [] as WorkoutMetricRow[];
    return getWorkoutMetricRows(detail.log, weightUnit, timedUnit);
  }, [detail, timedUnit, weightUnit]);

  return (
    <PageLayout
      title={lt("Workout History")}
      subtitle={lt("Session details")}
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
          <div className="border-b px-3 py-2.5 sm:px-4" style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)" }}>
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => router.push("/dashboard/workout/history")}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md"
                style={{ color: "var(--mist-light)", backgroundColor: "transparent" }}
                aria-label={lt("Back to history list")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold" style={{ color: "var(--jade-light)" }}>
                  {composedExerciseName || lt("Exercise")}
                </h3>
                <p className="mt-0.5 text-[9px] uppercase tracking-[0.1em]" style={{ color: "var(--mist-light)" }}>
                  {lt("Workout History")}
                </p>
              </div>
              {!loading && detail ? (
                <span className="shrink-0 pt-0.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                  {formatRelativeRecentDate(detail.log.createdAt, dateFormat, settings.timeZone)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="px-3 py-3 sm:px-4">
            {loading ? (
              <div className="py-8 text-sm text-mist-light">{lt("Loading workout detail...")}</div>
            ) : !detail ? (
              <div className="py-8 text-sm text-mist-light">{lt("Workout detail not found.")}</div>
            ) : (
              <article className="space-y-0.5 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                {(() => {
                  const progressionValue = detail.progressionLabel?.trim() || "-";
                  const parentValue = detail.exerciseName?.trim() || "-";
                  const variationValue = detail.log.variant?.trim() || "-";
                  const parsedModifier = parseModifierWithBand(detail.log.modifier);
                  const setupFromColumn = (detail.log.setupOption || "").trim();
                  const setupFromModifier = normalizeGripLikeValue(parsedModifier.setupOption);
                  const setupFromVariant = normalizeGripLikeValue(detail.log.variant);
                  const setupFromBaseModifier = normalizeGripLikeValue(parsedModifier.baseModifier);
                  const setupValue = getTextDisplayValue(
                    setupFromColumn || setupFromModifier || setupFromVariant || setupFromBaseModifier,
                    "-",
                  );
                  const modValue = getTextDisplayValue((parsedModifier.baseModifier || "").trim(), "-");
                  const notesValue = detail.log.notes?.trim() || "";
                  const leftDetailRows = [
                    { label: `${lt("Parent")}:`, value: parentValue, valueColor: "var(--cloud-white)" },
                    { label: `${lt("Progression")}:`, value: progressionValue, valueColor: "var(--jade-light)" },
                    { label: `${lt("Variant")}:`, value: variationValue, valueColor: "var(--mountain-blue-glow)" },
                    { label: `${lt("Grip / Props")}:`, value: setupValue, valueColor: "var(--gold-glow)" },
                    { label: `${lt("Mod")}:`, value: modValue, valueColor: "var(--gold-glow)" },
                    { label: `${lt("Notes")}:`, value: notesValue, valueColor: "var(--text-secondary)" },
                  ];
                  const alignedDetailRowCount = Math.max(leftDetailRows.length, metricRows.length);

                  return Array.from({ length: alignedDetailRowCount }, (_, index) => {
                    const left = leftDetailRows[index];
                    const metric = metricRows[index] ?? { weight: "-", reps: "-" };
                    return (
                      <div key={`detail-row-${detail.log.id}-${index}`} className="grid grid-cols-2 gap-x-3">
                        <div className="min-w-0">
                          {left ? (
                            <div className="truncate">
                              <span style={{ color: "var(--text-muted)" }}>{left.label}</span>{" "}
                              <span style={{ color: left.valueColor }}>{left.value}</span>
                            </div>
                          ) : (
                            <span aria-hidden="true">&nbsp;</span>
                          )}
                        </div>
                        <div className="min-w-0 grid grid-cols-2 gap-x-3">
                          {metric.weight !== "-" ? (
                            <span className="truncate" style={{ color: "var(--mountain-blue-glow)" }}>
                              <span style={{ color: "var(--text-muted)" }}>{lt("Weight")}: </span>{metric.weight}
                            </span>
                          ) : (
                            <span aria-hidden="true" />
                          )}
                          {metric.reps !== "-" ? (
                            <span className="truncate" style={{ color: "var(--forest)" }}>
                              <span style={{ color: "var(--text-muted)" }}>{lt("Reps")}: </span>{metric.reps}
                            </span>
                          ) : (
                            <span aria-hidden="true" />
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}

                <div className="mt-1 grid grid-cols-[96px_minmax(0,1fr)] gap-x-3">
                  <span style={{ color: "var(--text-muted)" }}>{lt("Logged")}:</span>
                  <span>{formatDateWithPreference(new Date(detail.log.createdAt), dateFormat, settings.timeZone)}</span>
                </div>
              </article>
            )}
          </div>
        </section>
      </div>
    </PageLayout>
  );
}
