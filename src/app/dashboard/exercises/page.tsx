"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import GlowInput, { GlowSelect } from "@/components/ui/GlowInput";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { DIFFICULTY_LEVELS, EXERCISE_TYPES } from "@/lib/constants";
import { getExerciseDisplayName, matchesLooseSearch } from "@/lib/exercise-name";
import { t } from "@/lib/terminology";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string | null;
  difficulty: string;
  type: string;
  story?: string | null;
  targetGroup?: string | null;
  createdAt?: string;
}

interface ProgressionTier {
  id: string;
  level: number;
  name: string;
  wuxiaName?: string;
  description?: string;
  targetHold?: number | null;
  targetReps?: number | null;
  targetRepsText?: string;
}

interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName?: string;
  category?: string;
  equipmentType?: string;
  primaryMuscles?: string;
  secondaryMuscles?: string;
  story?: string;
  tiers?: ProgressionTier[];
}

type SortMode = "featured" | "name-asc" | "name-desc" | "difficulty" | "newest";

function toLower(value: string | null | undefined): string {
  return (value || "").toLowerCase();
}

function parseCsv(raw: string | null | undefined): string[] {
  return (raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function getDifficultyIndex(value: string): number {
  const idx = DIFFICULTY_LEVELS.findIndex((d) => d === value);
  return idx === -1 ? 999 : idx;
}

function dualNames(exercise: Exercise, mode: "fantasy" | "normal") {
  const conventional = (exercise.name || "").trim();
  const cultivation = (exercise.wuxiaName || "").trim();

  if (mode === "fantasy") {
    return {
      primary: cultivation || conventional,
      secondaryLabel: "Conventional",
      secondary: conventional,
    };
  }

  return {
    primary: conventional || cultivation,
    secondaryLabel: "Cultivation",
    secondary: cultivation,
  };
}

export default function ExercisesPage() {
  const { user } = useAuth();
  const { isMobile } = useAppContext();
  const router = useRouter();
  const { settings } = useDisplaySettings();

  const terminologyMode = settings.terminologyMode;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [progressions, setProgressions] = useState<ProgressionExercise[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [query, setQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterMuscle, setFilterMuscle] = useState("");
  const [filterEquipment, setFilterEquipment] = useState("");
  const [filterProgressionOnly, setFilterProgressionOnly] = useState(false);

  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [visibleCount, setVisibleCount] = useState(24);

  const progressionLookup = useMemo(() => {
    const map = new Map<string, ProgressionExercise>();
    for (const p of progressions) {
      map.set(toLower(p.name), p);
      if (p.wuxiaName) map.set(toLower(p.wuxiaName), p);
    }
    return map;
  }, [progressions]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError("");

    try {
      const [exerciseRes, progressionRes] = await Promise.all([
        fetch("/api/exercises"),
        user?.id ? fetch(`/api/progressions?userId=${encodeURIComponent(user.id)}`) : Promise.resolve(null),
      ]);

      if (!exerciseRes.ok) throw new Error("Failed to load exercises.");

      const exerciseData = await exerciseRes.json();
      setExercises(Array.isArray(exerciseData.exercises) ? exerciseData.exercises : []);

      if (progressionRes && progressionRes.ok) {
        const progressionData = await progressionRes.json();
        setProgressions(Array.isArray(progressionData.exercises) ? progressionData.exercises : []);
      } else {
        setProgressions([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load atlas.");
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const ex of exercises) {
      for (const item of parseCsv(ex.targetGroup)) set.add(item);
      const prog = progressionLookup.get(toLower(ex.name)) || (ex.wuxiaName ? progressionLookup.get(toLower(ex.wuxiaName)) : undefined);
      for (const item of parseCsv(prog?.category)) set.add(item);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [exercises, progressionLookup]);

  const muscles = useMemo(() => {
    const set = new Set<string>();
    for (const p of progressions) {
      for (const item of parseCsv(p.primaryMuscles)) set.add(item);
      for (const item of parseCsv(p.secondaryMuscles)) set.add(item);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [progressions]);

  const equipment = useMemo(() => {
    const set = new Set<string>();
    for (const p of progressions) {
      for (const item of parseCsv(p.equipmentType)) set.add(item);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [progressions]);

  const matchFacet = (values: string[], filter: string): boolean => {
    if (!filter.trim()) return true;
    const needle = toLower(filter.trim());
    return values.some((v) => toLower(v).includes(needle));
  };

  const filtered = useMemo(() => {
    const q = query.trim();

    return exercises.filter((ex) => {
      const prog = progressionLookup.get(toLower(ex.name)) || (ex.wuxiaName ? progressionLookup.get(toLower(ex.wuxiaName)) : undefined);
      const hasProg = !!prog;

      if (filterProgressionOnly && !hasProg) return false;
      if (filterDifficulty && ex.difficulty !== filterDifficulty) return false;
      if (filterType && ex.type !== filterType) return false;

      if (!matchFacet([...parseCsv(ex.targetGroup), ...parseCsv(prog?.category)], filterCategory)) return false;
      if (!matchFacet([...parseCsv(prog?.primaryMuscles), ...parseCsv(prog?.secondaryMuscles)], filterMuscle)) return false;
      if (!matchFacet(parseCsv(prog?.equipmentType), filterEquipment)) return false;

      if (!q) return true;

      const searchable = [
        ex.name,
        ex.wuxiaName || "",
        ex.story || "",
        ex.type,
        ex.targetGroup || "",
        prog?.category || "",
        prog?.equipmentType || "",
        prog?.primaryMuscles || "",
        prog?.secondaryMuscles || "",
        prog?.story || "",
        ...(prog?.tiers || []).map((tier) => `${tier.level} ${tier.name} ${tier.wuxiaName || ""} ${tier.description || ""}`),
      ].join(" ");

      return searchable.toLowerCase().includes(q.toLowerCase()) || matchesLooseSearch(searchable, q);
    });
  }, [
    exercises,
    progressionLookup,
    query,
    filterDifficulty,
    filterType,
    filterCategory,
    filterMuscle,
    filterEquipment,
    filterProgressionOnly,
  ]);

  const sorted = useMemo(() => {
    const list = [...filtered];

    if (sortMode === "name-asc") {
      list.sort((a, b) => getExerciseDisplayName(a, terminologyMode).localeCompare(getExerciseDisplayName(b, terminologyMode)));
      return list;
    }

    if (sortMode === "name-desc") {
      list.sort((a, b) => getExerciseDisplayName(b, terminologyMode).localeCompare(getExerciseDisplayName(a, terminologyMode)));
      return list;
    }

    if (sortMode === "difficulty") {
      list.sort((a, b) => getDifficultyIndex(a.difficulty) - getDifficultyIndex(b.difficulty));
      return list;
    }

    if (sortMode === "newest") {
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      return list;
    }

    list.sort((a, b) => {
      const ap = progressionLookup.get(toLower(a.name)) || (a.wuxiaName ? progressionLookup.get(toLower(a.wuxiaName)) : undefined);
      const bp = progressionLookup.get(toLower(b.name)) || (b.wuxiaName ? progressionLookup.get(toLower(b.wuxiaName)) : undefined);
      const as = (ap ? 2 : 0) + (a.story ? 1 : 0) + (parseCsv(a.targetGroup).length > 0 ? 1 : 0);
      const bs = (bp ? 2 : 0) + (b.story ? 1 : 0) + (parseCsv(b.targetGroup).length > 0 ? 1 : 0);
      if (as !== bs) return bs - as;
      return getExerciseDisplayName(a, terminologyMode).localeCompare(getExerciseDisplayName(b, terminologyMode));
    });

    return list;
  }, [filtered, sortMode, terminologyMode, progressionLookup]);

  const visibleExercises = useMemo(() => sorted.slice(0, visibleCount), [sorted, visibleCount]);

  const activeFilterCount =
    (query ? 1 : 0) +
    (filterDifficulty ? 1 : 0) +
    (filterType ? 1 : 0) +
    (filterCategory ? 1 : 0) +
    (filterMuscle ? 1 : 0) +
    (filterEquipment ? 1 : 0) +
    (filterProgressionOnly ? 1 : 0);

  const applyInteractiveFilter = (kind: "difficulty" | "type" | "category" | "muscle" | "equipment" | "query", value: string) => {
    if (!value.trim()) return;
    setVisibleCount(24);
    if (kind === "difficulty") setFilterDifficulty(value);
    if (kind === "type") setFilterType(value);
    if (kind === "category") setFilterCategory(value);
    if (kind === "muscle") setFilterMuscle(value);
    if (kind === "equipment") setFilterEquipment(value);
    if (kind === "query") setQuery(value);
  };

  const quickTagClass = "rounded border border-ink-light/25 px-2 py-1 text-xs text-mist-light hover:border-jade/40 hover:text-jade-light";

  const sidebar = (
    <div className="space-y-4">
      <GlowCard glow="none" className="border border-jade/25 bg-ink-dark/50">
        <div className="space-y-3 p-3">
          <div className="text-xs uppercase tracking-[0.18em] text-gold/70">Atlas Filters</div>

          <GlowInput
            label="Search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisibleCount(24);
            }}
            placeholder="Search title, lore, category, muscles, equipment"
          />

          <GlowSelect label="Difficulty" value={filterDifficulty} onChange={(e) => { setFilterDifficulty(e.target.value); setVisibleCount(24); }} options={[{ value: "", label: "All" }, ...DIFFICULTY_LEVELS.map((d) => ({ value: d, label: t(d, "normal") }))]} />
          <GlowSelect label="Type" value={filterType} onChange={(e) => { setFilterType(e.target.value); setVisibleCount(24); }} options={[{ value: "", label: "All" }, ...EXERCISE_TYPES.map((d) => ({ value: d, label: t(d, "normal") }))]} />

          <GlowSelect
            label="Category"
            value={filterCategory}
            onChange={(e) => { setFilterCategory(e.target.value); setVisibleCount(24); }}
            options={[{ value: "", label: "All" }, ...categories.map((item) => ({ value: item, label: item }))]}
          />

          <GlowSelect
            label="Muscle"
            value={filterMuscle}
            onChange={(e) => { setFilterMuscle(e.target.value); setVisibleCount(24); }}
            options={[{ value: "", label: "All" }, ...muscles.map((item) => ({ value: item, label: item }))]}
          />

          <GlowSelect
            label="Equipment"
            value={filterEquipment}
            onChange={(e) => { setFilterEquipment(e.target.value); setVisibleCount(24); }}
            options={[{ value: "", label: "All" }, ...equipment.map((item) => ({ value: item, label: item }))]}
          />

          <label className="flex items-center gap-2 text-sm text-mist-light">
            <input type="checkbox" checked={filterProgressionOnly} onChange={(e) => { setFilterProgressionOnly(e.target.checked); setVisibleCount(24); }} />
            Show only cultivation pathways
          </label>

          <GlowButton
            variant="ghost"
            onClick={() => {
              setQuery("");
              setFilterDifficulty("");
              setFilterType("");
              setFilterCategory("");
              setFilterMuscle("");
              setFilterEquipment("");
              setFilterProgressionOnly(false);
              setVisibleCount(24);
            }}
          >
            Clear Seals
          </GlowButton>
        </div>
      </GlowCard>

      <GlowCard glow="none" className="border border-gold/25 bg-ink-dark/50">
        <div className="space-y-1 p-3 text-sm">
          <div className="text-gold/80">Total scrolls: {exercises.length}</div>
          <div className="text-mist-light">Matching scrolls: {sorted.length}</div>
          <div className="text-jade-light">With pathways: {sorted.filter((ex) => progressionLookup.has(toLower(ex.name)) || (ex.wuxiaName ? progressionLookup.has(toLower(ex.wuxiaName)) : false)).length}</div>
          <div className="text-mist-dark">Active seals: {activeFilterCount}</div>
        </div>
      </GlowCard>
    </div>
  );

  return (
    <PageLayout title={t("Technique Scroll", terminologyMode)} subtitle="Lore Atlas Explorer" sidebar={sidebar} sidebarLabel="Explore">
      <div className="space-y-4">
        <GlowCard glow="none" className="border border-gold/25 bg-[linear-gradient(165deg,rgba(35,28,22,0.85),rgba(18,16,14,0.9))]">
          <div className="space-y-2 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-gold/80">Grand Archive</div>
            <h2 className="text-xl font-semibold text-cloud-white">Wuxia Technique Lore Atlas</h2>
            <p className="text-sm leading-relaxed text-mist-light">
              Traverse collected martial records by realm, path, and discipline. Every badge and lore tag can be clicked to refine the atlas.
            </p>
          </div>
        </GlowCard>

        <GlowCard glow="none" className="border border-ink-light/20 bg-ink-dark/40">
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
            <GlowSelect
              label="Sort"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              options={[
                { value: "featured", label: "Featured Scrolls" },
                { value: "name-asc", label: "Name A-Z" },
                { value: "name-desc", label: "Name Z-A" },
                { value: "difficulty", label: "Difficulty" },
                { value: "newest", label: "Newest" },
              ]}
            />

            <GlowSelect
              label="View"
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as "grid" | "list")}
              options={[
                { value: "grid", label: "Scroll Cards" },
                { value: "list", label: "Archive List" },
              ]}
            />

            <div className="flex items-end gap-2">
              <GlowButton variant="blue" className="w-full" onClick={fetchData}>Refresh Atlas</GlowButton>
            </div>
          </div>
        </GlowCard>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2">
            {query && <button className={quickTagClass} onClick={() => setQuery("")}>Search: {query}</button>}
            {filterDifficulty && <button className={quickTagClass} onClick={() => setFilterDifficulty("")}>Difficulty: {t(filterDifficulty, "normal")}</button>}
            {filterType && <button className={quickTagClass} onClick={() => setFilterType("")}>Type: {t(filterType, "normal")}</button>}
            {filterCategory && <button className={quickTagClass} onClick={() => setFilterCategory("")}>Category: {filterCategory}</button>}
            {filterMuscle && <button className={quickTagClass} onClick={() => setFilterMuscle("")}>Muscle: {filterMuscle}</button>}
            {filterEquipment && <button className={quickTagClass} onClick={() => setFilterEquipment("")}>Equipment: {filterEquipment}</button>}
            {filterProgressionOnly && <button className={quickTagClass} onClick={() => setFilterProgressionOnly(false)}>Pathways only</button>}
          </div>
        )}

        {error && <div className="rounded border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">{error}</div>}

        {isLoading ? (
          <div className="rounded border border-ink-light/20 bg-ink-dark/40 p-8 text-center text-mist-dark">Loading exercise explorer...</div>
        ) : (
          <>
            <div className="flex items-center justify-between text-sm text-mist-dark">
              <div>Showing {Math.min(visibleExercises.length, sorted.length)} of {sorted.length} matching scrolls</div>
              <div>{isMobile ? "Tap a scroll to open details" : "Click a scroll to open details"}</div>
            </div>

            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 gap-2">
                {visibleExercises.map((exercise) => {
                  const progression = progressionLookup.get(toLower(exercise.name)) || (exercise.wuxiaName ? progressionLookup.get(toLower(exercise.wuxiaName)) : undefined);
                  const names = dualNames(exercise, terminologyMode);

                  return (
                    <div
                      role="button"
                      tabIndex={0}
                      key={exercise.id}
                      onClick={() => router.push(`/dashboard/exercises/${exercise.id}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          router.push(`/dashboard/exercises/${exercise.id}`);
                        }
                      }}
                      className="cursor-pointer rounded border border-ink-light/20 bg-[linear-gradient(170deg,rgba(25,23,21,0.75),rgba(17,16,15,0.8))] px-3 py-2 text-left transition-all hover:border-jade/35"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-cloud-white">{names.primary || "Unnamed Technique"}</div>
                          {names.secondary && names.secondary !== names.primary && (
                            <div className="truncate text-xs text-mist-light">{names.secondaryLabel}: {names.secondary}</div>
                          )}
                          <p className="mt-1 line-clamp-1 text-xs text-mist-dark">{exercise.story || progression?.story || "No lore available."}</p>
                        </div>

                        <div className="flex shrink-0 flex-wrap justify-end gap-1 text-xs text-mist-dark">
                          <button className="rounded border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-gold" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("difficulty", exercise.difficulty); }}>{exercise.difficulty}</button>
                          <button className="rounded border border-jade/30 bg-jade-deep/15 px-1.5 py-0.5 text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("type", exercise.type); }}>{exercise.type}</button>
                          {progression && <button className="rounded border border-jade-glow/30 px-1.5 py-0.5 text-jade-light" onClick={(e) => { e.stopPropagation(); setFilterProgressionOnly(true); }}>Pathway</button>}
                        </div>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-mist-dark">
                        {(exercise.targetGroup || progression?.category) && <button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("category", exercise.targetGroup || progression?.category || ""); }}>Category: {exercise.targetGroup || progression?.category}</button>}
                        {progression?.primaryMuscles && <button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("muscle", progression.primaryMuscles || ""); }}>Primary: {progression.primaryMuscles}</button>}
                        {progression?.equipmentType && <button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("equipment", progression.equipmentType || ""); }}>Equipment: {progression.equipmentType}</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="overflow-hidden rounded border border-gold/20 bg-ink-dark/40">
                <table className="w-full text-sm">
                  <thead className="bg-ink-dark/80 text-gold/80">
                    <tr>
                      <th className="p-2 text-left">Scroll</th>
                      <th className="p-2 text-left">Realm</th>
                      <th className="p-2 text-left">Path</th>
                      <th className="p-2 text-left">Discipline</th>
                      <th className="p-2 text-left">Pathway</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleExercises.map((exercise) => {
                      const progression = progressionLookup.get(toLower(exercise.name)) || (exercise.wuxiaName ? progressionLookup.get(toLower(exercise.wuxiaName)) : undefined);
                      const names = dualNames(exercise, terminologyMode);
                      return (
                        <tr
                          key={exercise.id}
                          className="cursor-pointer border-t border-ink-light/15 hover:bg-ink-dark/60"
                          onClick={() => router.push(`/dashboard/exercises/${exercise.id}`)}
                        >
                          <td className="p-2">
                            <div className="text-cloud-white">{names.primary || "Unnamed Technique"}</div>
                            {names.secondary && names.secondary !== names.primary && <div className="text-xs text-mist-light">{names.secondaryLabel}: {names.secondary}</div>}
                          </td>
                          <td className="p-2"><button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("difficulty", exercise.difficulty); }}>{exercise.difficulty}</button></td>
                          <td className="p-2"><button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("type", exercise.type); }}>{exercise.type}</button></td>
                          <td className="p-2"><button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); applyInteractiveFilter("category", exercise.targetGroup || progression?.category || ""); }}>{exercise.targetGroup || progression?.category || "-"}</button></td>
                          <td className="p-2"><button className="hover:text-jade-light" onClick={(e) => { e.stopPropagation(); setFilterProgressionOnly(true); }}>{progression ? `${(progression.tiers || []).length} tiers` : "-"}</button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {visibleExercises.length < sorted.length && (
              <div className="flex justify-center pt-2">
                <GlowButton variant="ghost" onClick={() => setVisibleCount((count) => count + 24)}>
                  Open More Scrolls
                </GlowButton>
              </div>
            )}
          </>
        )}
      </div>
    </PageLayout>
  );
}
