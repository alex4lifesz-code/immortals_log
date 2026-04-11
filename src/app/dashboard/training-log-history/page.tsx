"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { MemoTrainingLogTable } from "@/components/workout/TrainingLogTable";
import { useIsMobile } from "@/context/AppContext";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { api } from "@/lib/api-client";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { getExerciseDisplayName } from "@/lib/exercise-name";
import { isDeletedExerciseDescription } from "@/lib/pending-exercises";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique } from "@/lib/user-physique";
import type { UserPhysiqueSettings } from "@/lib/user-physique";
import type { ProgressionExercise } from "@/app/dashboard/workout/types";
import { stripBwPercentHint, getExerciseCategoryLabel } from "@/app/dashboard/workout/utils";

interface HistoryFilters {
  search: string;
  category: string;
  exerciseId: string;
  fromDate: string;
  toDate: string;
}

type MobileFilterPickerField = "category" | "exercise";

const DEFAULT_FILTERS: HistoryFilters = {
  search: "",
  category: "all",
  exerciseId: "all",
  fromDate: "",
  toDate: "",
};

export default function TrainingLogHistoryPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { settings } = useDisplaySettings();
  const displayTerminologyMode = !settings.showExerciseForeignLanguage && settings.languageMode === "english"
    ? "normal"
    : settings.terminologyMode;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [exercises, setExercises] = useState<ProgressionExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [physique, setPhysique] = useState<UserPhysiqueSettings>(DEFAULT_USER_PHYSIQUE);
  const [visibleUsers, setVisibleUsers] = useState<Array<{ id: string; name: string; username: string }>>([]);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [mobileUserPickerOpen, setMobileUserPickerOpen] = useState(false);
  const [mobileFilterPicker, setMobileFilterPicker] = useState<null | { field: MobileFilterPickerField; title: string }>(null);
  const fromDateInputRef = useRef<HTMLInputElement | null>(null);
  const toDateInputRef = useRef<HTMLInputElement | null>(null);

  const userId = user?.id ?? "";
  const targetUserId = searchParams.get("targetUserId") || "";
  const activeUserId = targetUserId || userId;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const loadUsers = async () => {
      try {
        const data = await api.get<{ users: Array<{ id: string; name: string; username: string }> }>("/api/users/public?scope=community");
        if (!cancelled) {
          setVisibleUsers(Array.isArray(data.users) ? data.users : []);
        }
      } catch {
        if (!cancelled) {
          setVisibleUsers([]);
        }
      }
    };

    void loadUsers();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setPhysique(DEFAULT_USER_PHYSIQUE);
      return;
    }
    setPhysique(loadUserPhysique(activeUserId || userId));
  }, [activeUserId, userId]);

  const fetchExercises = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({ logLimit: "200" });
      if (targetUserId) params.set("targetUserId", targetUserId);
      const data = await api.get<{ exercises: ProgressionExercise[] }>(`/api/progressions/history?${params.toString()}`);
      setExercises(data.exercises || []);
    } catch (err) {
      console.error("Failed to load training history:", err);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, userId]);

  useEffect(() => {
    setLoading(true);
    void fetchExercises();
  }, [fetchExercises]);

  const orderedVisibleUsers = useMemo(() => {
    if (!userId) return visibleUsers;

    const selfEntry = visibleUsers.find((u) => u.id === userId) ?? {
      id: userId,
      name: user?.name || "Me",
      username: user?.username || "",
    };
    const others = visibleUsers.filter((u) => u.id !== userId);
    return [selfEntry, ...others];
  }, [user?.name, user?.username, userId, visibleUsers]);

  const targetUserDisplayName = useMemo(() => {
    if (!targetUserId) return undefined;
    const target = orderedVisibleUsers.find((u) => u.id === targetUserId);
    if (!target) return undefined;
    return (target.name || target.username || "").trim() || undefined;
  }, [orderedVisibleUsers, targetUserId]);

  const selectedTargetUser = useMemo(() => {
    if (!targetUserId) return null;
    return orderedVisibleUsers.find((u) => u.id === targetUserId) ?? null;
  }, [orderedVisibleUsers, targetUserId]);

  const activeUserLabel = useMemo(() => {
    const activeUser = orderedVisibleUsers.find((u) => u.id === activeUserId || (!activeUserId && u.id === userId));
    if (activeUser) return activeUser.name || activeUser.username || "Me";
    return user?.name || user?.username || "Me";
  }, [activeUserId, orderedVisibleUsers, user?.name, user?.username, userId]);

  const categoryOptions = useMemo(() => {
    const unique = new Set<string>();
    for (const exercise of exercises) {
      unique.add(getExerciseCategoryLabel(exercise));
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [exercises]);

  const exerciseOptions = useMemo(() => {
    return exercises
      .filter((exercise) => {
        if (isDeletedExerciseDescription(exercise.story)) return false;
        return (exercise.userProgress ?? []).some((progress) => (progress.logs?.length ?? 0) > 0);
      })
      .map((exercise) => ({
        id: exercise.id,
        label: stripBwPercentHint(
          getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage),
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [displayTerminologyMode, exercises, settings.showExerciseForeignLanguage]);

  const activeCategoryLabel = useMemo(() => {
    if (filters.category === "all") return "All categories";
    return filters.category;
  }, [filters.category]);

  const activeExerciseLabel = useMemo(() => {
    if (filters.exerciseId === "all") return "All exercises";
    return exerciseOptions.find((option) => option.id === filters.exerciseId)?.label ?? "All exercises";
  }, [exerciseOptions, filters.exerciseId]);

  const mobileFilterPickerOptions = useMemo(() => {
    if (!mobileFilterPicker) return [] as Array<{ value: string; label: string }>;
    if (mobileFilterPicker.field === "category") {
      return [
        { value: "all", label: "All categories" },
        ...categoryOptions.map((category) => ({ value: category, label: category })),
      ];
    }

    return [
      { value: "all", label: "All exercises" },
      ...exerciseOptions.map((exercise) => ({ value: exercise.id, label: exercise.label })),
    ];
  }, [categoryOptions, exerciseOptions, mobileFilterPicker]);

  const mobileFilterPickerCurrentValue = useMemo(() => {
    if (!mobileFilterPicker) return "";
    return mobileFilterPicker.field === "category" ? filters.category : filters.exerciseId;
  }, [filters.category, filters.exerciseId, mobileFilterPicker]);

  const filteredExercises = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const category = filters.category;
    const selectedExerciseId = filters.exerciseId;
    const fromDateMs = filters.fromDate ? new Date(`${filters.fromDate}T00:00:00`).getTime() : null;
    const toDateMs = filters.toDate ? new Date(`${filters.toDate}T23:59:59`).getTime() : null;

    return exercises
      .map((exercise) => {
        // Status filtering should only include known exercises from history.
        if (isDeletedExerciseDescription(exercise.story)) return null;

        const displayName = stripBwPercentHint(
          getExerciseDisplayName(exercise, displayTerminologyMode, settings.showExerciseForeignLanguage),
        );
        const searchHaystack = [
          displayName,
          exercise.name,
          exercise.wuxiaName,
          exercise.englishName ?? "",
          exercise.vietnameseName ?? "",
        ].join(" ").toLowerCase();

        const categoryLabel = getExerciseCategoryLabel(exercise);
        const matchesSearch = !search || searchHaystack.includes(search);
        const matchesCategory = category === "all" || categoryLabel === category;
        const matchesExercise = selectedExerciseId === "all" || exercise.id === selectedExerciseId;
        if (!matchesSearch || !matchesCategory || !matchesExercise) return null;

        const nextUserProgress = (exercise.userProgress ?? []).map((progress) => {
          const nextLogs = (progress.logs ?? []).filter((log) => {
            if (fromDateMs != null || toDateMs != null) {
              const logMs = new Date(log.createdAt).getTime();
              if (fromDateMs != null && logMs < fromDateMs) return false;
              if (toDateMs != null && logMs > toDateMs) return false;
            }

            return true;
          });
          return { ...progress, logs: nextLogs };
        });

        const hasLogs = nextUserProgress.some((progress) => (progress.logs?.length ?? 0) > 0);
        if (!hasLogs) return null;

        return {
          ...exercise,
          userProgress: nextUserProgress,
        };
      })
      .filter((exercise): exercise is ProgressionExercise => exercise != null);
  }, [displayTerminologyMode, exercises, filters, settings.showExerciseForeignLanguage]);

  const visibleLogCount = useMemo(() => {
    return filteredExercises.reduce((sum, exercise) => {
      return sum + (exercise.userProgress ?? []).reduce((sub, progress) => sub + (progress.logs?.length ?? 0), 0);
    }, 0);
  }, [filteredExercises]);

  const totalLogCount = useMemo(() => {
    return exercises.reduce((sum, exercise) => {
      return sum + (exercise.userProgress ?? []).reduce((sub, progress) => sub + (progress.logs?.length ?? 0), 0);
    }, 0);
  }, [exercises]);

  const handleUserScopeChange = (nextUserId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (!nextUserId || nextUserId === userId) {
      params.delete("targetUserId");
    } else {
      params.set("targetUserId", nextUserId);
    }
    const next = params.toString();
    router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
  };

  useEffect(() => {
    setMobileUserPickerOpen(false);
  }, [activeUserId]);

  const openDatePicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    const input = ref.current;
    if (!input) return;
    input.focus({ preventScroll: true });
    const pickerInput = input as HTMLInputElement & { showPicker?: () => void };
    if (typeof pickerInput.showPicker === "function") {
      try {
        pickerInput.showPicker();
        return;
      } catch {
        // Fallback to click in environments that block showPicker.
      }
    }
    input.click();
  };

  const formatFilterDate = (value: string) => {
    if (!value) return "";
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString("en-GB");
  };

  return (
    <PageLayout
      title="Training Log History"
      subtitle="Filter and explore your archived training logs"
      mobileContentPaddingClass="p-2 pb-2"
    >
      <div className="nyaa-history-page space-y-6 px-0 py-2 sm:py-3">
        {loading ? (
          <GlowCard glow="jade" hoverable={false}>
            <p className="text-sm text-mist-dark text-center py-4">Loading history...</p>
          </GlowCard>
        ) : (
          <>
            {selectedTargetUser && (
              <GlowCard
                glow="none"
                hoverable={false}
                className="rounded-2xl border border-[#3b3f48] bg-[#2b2d31] shadow-[0_0_0_1px_rgba(88,101,242,0.2),0_12px_24px_rgba(0,0,0,0.35)]"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">Friend Profile</p>
                    <h3 className="mt-1 truncate text-lg font-semibold text-[#f2f3f5]">{selectedTargetUser.name || "Friend"}</h3>
                    <p className="text-xs text-[#b5bac1]">@{selectedTargetUser.username || "unknown"}</p>
                    <p className="mt-1 text-[11px] text-[#949ba4]">ID: {selectedTargetUser.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => router.push(DASHBOARD_ROUTES.friends)}
                      className="rounded-lg border border-[#3b3f48] bg-[#1e1f22] px-3 py-1.5 text-xs font-medium text-[#dbdee1] hover:text-[#f2f3f5]"
                    >
                      Open Friends
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUserScopeChange(userId)}
                      className="rounded-lg border border-[#5865f2]/55 bg-[#5865f2]/18 px-3 py-1.5 text-xs font-semibold text-[#dee1ff] hover:bg-[#5865f2]/28"
                    >
                      View My History
                    </button>
                  </div>
                </div>
              </GlowCard>
            )}

            <GlowCard
              glow="none"
              hoverable={false}
              className="rounded-2xl border border-ink-light/70 bg-ink-deep/80 shadow-[0_0_0_1px_color-mix(in_srgb,var(--jade-glow)_10%,transparent),var(--shadow-elev-1)]"
            >
              <h3 className="text-sm text-jade-glow uppercase tracking-wider mb-3">Filters</h3>
              <div className="grid gap-2 lg:grid-cols-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label htmlFor="history-user-scope-dedicated" className="text-[11px] text-jade-light uppercase tracking-[0.08em]">
                    View user
                  </label>
                  {isMobile ? (
                    <button
                      type="button"
                      onClick={() => setMobileUserPickerOpen(true)}
                      className="flex min-w-[170px] items-center justify-between rounded-lg border px-3 py-2 text-sm font-medium text-cloud-white"
                      style={{
                        borderColor: "color-mix(in srgb, var(--jade-glow) 28%, var(--border))",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                      }}
                      aria-label="Pick user"
                    >
                      <span className="truncate">{activeUserLabel}</span>
                      <span className="ml-2 text-xs text-mist-dark">▾</span>
                    </button>
                  ) : (
                    <select
                      id="history-user-scope-dedicated"
                      value={activeUserId || userId}
                      onChange={(event) => handleUserScopeChange(event.target.value)}
                      className="rounded-lg border px-2 py-1 text-xs text-cloud-white outline-none"
                      style={{
                        borderColor: "color-mix(in srgb, var(--jade-glow) 30%, var(--border))",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 84%, var(--ink-deep))",
                      }}
                    >
                      {orderedVisibleUsers.length === 0 ? (
                        <option value={userId}>{user?.name || "Me"}</option>
                      ) : (
                        orderedVisibleUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.id === userId ? `* ${u.name || u.username}` : (u.name || u.username)}
                          </option>
                        ))
                      )}
                    </select>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
                  <span className="text-xs text-mist-dark">
                    Showing {visibleLogCount} / {totalLogCount} logs
                  </span>
                  <GlowButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Reset filters
                  </GlowButton>
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                <input
                  type="text"
                  value={filters.search}
                  onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
                  placeholder="Search exercise"
                  className="rounded-lg border border-ink-light/30 bg-ink-dark px-2 py-1 text-xs text-cloud-white placeholder:text-mist-dark outline-none lg:col-span-2"
                />

                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMobileFilterPicker({ field: "category", title: "Category" })
}
                    className="flex items-center justify-between rounded-lg border border-ink-light/30 bg-ink-dark px-3 py-2 text-sm font-medium text-cloud-white"
                    aria-label="Pick category"
                  >
                    <span className="truncate">{activeCategoryLabel}</span>
                    <span className="ml-2 text-xs text-mist-dark">▾</span>
                  </button>
                ) : (
                  <select
                    value={filters.category}
                    onChange={(event) => setFilters((prev) => ({ ...prev, category: event.target.value }))}
                    className="rounded-lg border border-ink-light/30 bg-ink-dark px-2 py-1 text-xs text-cloud-white outline-none"
                  >
                    <option value="all">All categories</option>
                    {categoryOptions.map((category) => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                )}

                {isMobile ? (
                  <button
                    type="button"
                    onClick={() => setMobileFilterPicker({ field: "exercise", title: "Exercise" })}
                    className="flex items-center justify-between rounded-lg border border-ink-light/30 bg-ink-dark px-3 py-2 text-sm font-medium text-cloud-white"
                    aria-label="Pick exercise"
                  >
                    <span className="truncate">{activeExerciseLabel}</span>
                    <span className="ml-2 text-xs text-mist-dark">▾</span>
                  </button>
                ) : (
                  <select
                    value={filters.exerciseId}
                    onChange={(event) => setFilters((prev) => ({ ...prev, exerciseId: event.target.value }))}
                    className="rounded-lg border border-ink-light/30 bg-ink-dark px-2 py-1 text-xs text-cloud-white outline-none"
                  >
                    <option value="all">All exercises</option>
                    {exerciseOptions.map((exercise) => (
                      <option key={exercise.id} value={exercise.id}>{exercise.label}</option>
                    ))}
                  </select>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => openDatePicker(fromDateInputRef)}
                      className="h-full w-full rounded-lg border border-ink-light/30 bg-ink-dark px-2 py-1 text-left text-xs text-cloud-white"
                      aria-label="From date"
                    >
                      {formatFilterDate(filters.fromDate) || "Date from"}
                    </button>
                    <input
                      ref={fromDateInputRef}
                      type="date"
                      value={filters.fromDate}
                      onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => openDatePicker(toDateInputRef)}
                      className="h-full w-full rounded-lg border border-ink-light/30 bg-ink-dark px-2 py-1 text-left text-xs text-cloud-white"
                      aria-label="To date"
                    >
                      {formatFilterDate(filters.toDate) || "Date to"}
                    </button>
                    <input
                      ref={toDateInputRef}
                      type="date"
                      value={filters.toDate}
                      onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
                      className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              </div>
            </GlowCard>

            <GlowCard
              glow="none"
              hoverable={false}
              className="!p-0 overflow-hidden rounded-2xl border border-ink-light/70 bg-ink-deep/80 shadow-[0_0_0_1px_color-mix(in_srgb,var(--jade-glow)_10%,transparent),var(--shadow-elev-1)]"
            >
            <div className="nyaa-history-table-shell">
              <MemoTrainingLogTable
                exercises={filteredExercises}
                physique={physique}
                onRefresh={fetchExercises}
                userId={userId}
                historyTargetUserId={targetUserId || undefined}
                historyTargetUserName={targetUserDisplayName}
                trainingLogTitleOverride="Training Log History"
                hideInputSection
                forceDesktopTableOnMobile={isMobile}
                exerciseDetailSource="history"
              />
            </div>
            </GlowCard>
          </>
        )}
      </div>
      {isMobile && mobileUserPickerOpen && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[95] bg-black/65"
            onClick={() => setMobileUserPickerOpen(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[96] max-h-[72vh] w-[min(82vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-ink-light/30 bg-ink-deep"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-light/30 px-4 py-3">
              <p className="text-xs text-jade-glow font-semibold uppercase tracking-wider">
                View user
              </p>
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={() => setMobileUserPickerOpen(false)}
              >
                Close
              </GlowButton>
            </div>
            <div className="relative px-3 pb-3 pt-2">
              <div
                className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 border border-jade-glow/40 bg-jade-glow/10"
              />
              <div
                className="h-56 overflow-y-auto snap-y snap-mandatory"
                style={{ paddingTop: "90px", paddingBottom: "90px", scrollbarWidth: "none" }}
              >
                {(orderedVisibleUsers.length === 0
                  ? [{ id: userId, name: user?.name || "Me", username: user?.username || "" }]
                  : orderedVisibleUsers
                ).map((u) => {
                  const isActive = u.id === (activeUserId || userId);
                  const displayName = u.name || u.username || "Unknown";
                  return (
                    <button
                      key={`mobile-user-option-${u.id}`}
                      type="button"
                      onClick={() => {
                        handleUserScopeChange(u.id);
                        setMobileUserPickerOpen(false);
                      }}
                      className={`flex h-11 w-full snap-center items-center justify-center text-sm ${isActive ? "text-cloud-white font-bold" : "text-mist-dark font-medium"}`}
                    >
                      {displayName}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
      {isMobile && mobileFilterPicker && typeof document !== "undefined" && createPortal(
        <>
          <div
            className="fixed inset-0 z-[95] bg-black/65"
            onClick={() => setMobileFilterPicker(null)}
          />
          <div
            className="fixed left-1/2 top-1/2 z-[96] max-h-[72vh] w-[min(82vw,30rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-ink-light/30 bg-ink-deep"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-ink-light/30 px-4 py-3">
              <p className="text-xs text-jade-glow font-semibold uppercase tracking-wider">
                {mobileFilterPicker.title}
              </p>
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={() => setMobileFilterPicker(null)}
              >
                Close
              </GlowButton>
            </div>
            <div className="relative px-3 pb-3 pt-2">
              <div
                className="pointer-events-none absolute left-3 right-3 top-1/2 h-11 -translate-y-1/2 border border-jade-glow/40 bg-jade-glow/10"
              />
              <div
                className="h-56 overflow-y-auto snap-y snap-mandatory"
                style={{ paddingTop: "90px", paddingBottom: "90px", scrollbarWidth: "none" }}
              >
                {mobileFilterPickerOptions.map((option) => {
                  const isActive = option.value === mobileFilterPickerCurrentValue;
                  return (
                    <button
                      key={`mobile-${mobileFilterPicker.field}-option-${option.value || "all"}`}
                      type="button"
                      onClick={() => {
                        if (mobileFilterPicker.field === "category") {
                          setFilters((prev) => ({ ...prev, category: option.value }));
                        } else {
                          setFilters((prev) => ({ ...prev, exerciseId: option.value }));
                        }
                        setMobileFilterPicker(null);
                      }}
                      className={`flex h-11 w-full snap-center items-center justify-center text-sm ${isActive ? "text-cloud-white font-bold" : "text-mist-dark font-medium"}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>,
        document.body,
      )}
    </PageLayout>
  );
}
