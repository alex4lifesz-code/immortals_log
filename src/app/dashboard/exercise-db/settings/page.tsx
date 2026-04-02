"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import {
  getDefaultExerciseDbOptions,
  type ExerciseDbOptions,
} from "@/lib/exercise-db-settings";
import type { SimpleExercise } from "@/lib/exercise-types";

type RenamePair = { from: string; to: string };
type RenameState = {
  categories: RenamePair[];
  types: RenamePair[];
  muscles: RenamePair[];
  variants: RenamePair[];
};

type ExerciseVariantRow = {
  id: string;
  name: string;
  category: string;
  exerciseType: string;
  progression: string[];
  variants: string[];
};

function normalizeDraft(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const capitalizeFirst = (value: string) => {
    if (!value) return value;
    return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
  };

  for (const value of values) {
    const next = capitalizeFirst(value.trim());
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

function normalizeTypeLabel(value: string): string {
  const lower = value.trim().toLowerCase();
  if (lower === "weighted" || lower === "weight") return "Weighted";
  if (lower === "timed" || lower === "time" || lower === "hold") return "Timed";
  if (lower === "bodyweight" || lower === "bodytype" || lower === "body type" || lower === "body") return "Bodyweight";
  if (!value) return value;
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function normalizeTypeDraft(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = normalizeTypeLabel(value.trim());
    if (!next) continue;
    const key = next.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(next);
  }
  return out;
}

function OptionListEditor({
  title,
  subtitle,
  values,
  onAdd,
  onRename,
  onRemove,
  placeholder,
}: {
  title: string;
  subtitle: string;
  values: string[];
  onAdd: (value: string) => void;
  onRename: (from: string, to: string) => void;
  onRemove: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const commitRename = () => {
    if (!editingValue) return;
    onRename(editingValue, editDraft);
    setEditingValue(null);
    setEditDraft("");
  };

  return (
    <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
      <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
        <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>{title}</p>
        <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>{subtitle}</p>
      </div>

      <div className="space-y-2 p-3" style={{ backgroundColor: "var(--surface)" }}>
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 text-[11px] border px-2 py-1"
              style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)", borderRadius: "2px" }}
            >
              {editingValue === value ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingValue(null);
                      setEditDraft("");
                    }
                  }}
                  className="w-24 border px-1 py-0 text-[11px] outline-none"
                  style={{ borderColor: "var(--accent)", borderRadius: "2px", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingValue(value);
                    setEditDraft(value);
                  }}
                  className="text-left hover:underline"
                  style={{ color: "var(--text-primary)" }}
                  title="Click to edit"
                >
                  {value}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(`Are you sure you want to delete \"${value}\" from ${title}?`);
                  if (!confirmed) return;
                  onRemove(value);
                }}
                className="text-[11px] px-1"
                style={{ color: "var(--danger)" }}
                aria-label={`Remove ${value}`}
              >
                x
              </button>
            </span>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              onAdd(draft);
              setDraft("");
            }}
            className="flex-1 border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", borderRadius: "2px", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
            placeholder={placeholder}
          />
          <button
            type="button"
            onClick={() => {
              onAdd(draft);
              setDraft("");
            }}
            className="px-3 py-1.5 text-xs border transition-colors"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderRadius: "2px" }}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ExerciseRowLabelEditor({
  row,
  values,
  kind,
  emptyLabel,
  addPlaceholder,
  onSave,
}: {
  row: ExerciseVariantRow;
  values: string[];
  kind: "progression" | "variant";
  emptyLabel: string;
  addPlaceholder: string;
  onSave: (exerciseId: string, exerciseName: string, previousValues: string[], nextValues: string[]) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [editingValue, setEditingValue] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  const normalizeValue = (value: string) => {
    const trimmed = value.trim().slice(0, 60);
    if (!trimmed) return "";
    return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  };

  const dedupeValues = (list: string[]) => {
    return list.filter((value, index, all) => all.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index);
  };

  const persist = async (nextValues: string[]) => {
    const deduped = dedupeValues(nextValues);
    const before = values;
    const same = before.length === deduped.length && before.every((value, index) => value === deduped[index]);
    if (same) return;
    setSaving(true);
    try {
      await onSave(row.id, row.name, before, deduped);
      setDraft("");
      setEditingValue(null);
      setEditDraft("");
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  const addValue = async () => {
    const next = normalizeValue(draft);
    if (!next) return;
    if (values.some((item) => item.toLowerCase() === next.toLowerCase())) {
      setDraft("");
      setAdding(false);
      return;
    }
    await persist([...values, next]);
  };

  const removeValue = async (value: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete \"${value}\" from ${kind}s?`);
    if (!confirmed) return;
    await persist(values.filter((item) => item !== value));
  };

  const commitRename = async () => {
    if (!editingValue) return;
    const next = normalizeValue(editDraft);
    if (!next) {
      setEditingValue(null);
      setEditDraft("");
      return;
    }
    await persist(values.map((item) => (item === editingValue ? next : item)));
  };

  return (
    <div className="space-y-2">
      {values.length === 0 ? (
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{emptyLabel}</span>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <span
              key={`${row.id}:${kind}:${value}`}
              className="inline-flex items-center gap-1 text-[10px] border px-1.5 py-0.5"
              style={{
                borderColor: "color-mix(in srgb, var(--accent) 28%, var(--border))",
                color: "var(--text-primary)",
                backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)",
                borderRadius: "2px",
              }}
            >
              {editingValue === value ? (
                <input
                  autoFocus
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  onBlur={() => { void commitRename(); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commitRename();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setEditingValue(null);
                      setEditDraft("");
                    }
                  }}
                  className="w-24 border px-1 py-0 text-[10px] outline-none"
                  style={{ borderColor: "var(--accent)", borderRadius: "2px", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setEditingValue(value);
                    setEditDraft(value);
                  }}
                  className="text-left hover:underline"
                  style={{ color: "var(--text-primary)" }}
                  disabled={saving}
                  title="Click to edit"
                >
                  {value}
                </button>
              )}
              <button
                type="button"
                onClick={() => { void removeValue(value); }}
                className="px-1"
                style={{ color: "var(--danger)" }}
                disabled={saving}
                aria-label={`Remove ${value}`}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void addValue();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setDraft("");
              }
            }}
            className="flex-1 border px-2 py-1.5 text-xs outline-none"
            style={{ borderColor: "var(--border)", borderRadius: "2px", backgroundColor: "var(--surface)", color: "var(--text-primary)" }}
            placeholder={addPlaceholder}
            disabled={saving}
          />
          <button
            type="button"
            onClick={() => { void addValue(); }}
            className="px-2 py-1.5 text-xs border transition-colors"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderRadius: "2px" }}
            disabled={saving}
          >
            {saving ? "Saving..." : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAdding(false);
              setDraft("");
            }}
            className="px-2 py-1.5 text-xs border"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}
            disabled={saving}
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center justify-center w-5 h-5 text-xs border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", borderRadius: "2px" }}
            title={`Add ${kind}`}
            disabled={saving}
          >
            +
          </button>
        </div>
      )}

      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        Click a label to rename it.
      </p>
    </div>
  );
}

export default function ExerciseDbSettingsPage() {
  const router = useRouter();
  const defaults = useMemo(() => getDefaultExerciseDbOptions(), []);

  const [categories, setCategories] = useState<string[]>(defaults.categories);
  const [types, setTypes] = useState<string[]>(defaults.types);
  const [muscles, setMuscles] = useState<string[]>(defaults.muscles);
  const [variants, setVariants] = useState<string[]>(defaults.variants);
  const [exerciseVariantRows, setExerciseVariantRows] = useState<ExerciseVariantRow[]>([]);
  const [variantCategoryFilter, setVariantCategoryFilter] = useState("");
  const [variantTypeFilter, setVariantTypeFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string>("");
  const [initialOptions, setInitialOptions] = useState<ExerciseDbOptions>(defaults);
  const [pendingRenames, setPendingRenames] = useState<RenameState>({
    categories: [],
    types: [],
    muscles: [],
    variants: [],
  });

  const addUnique = useCallback((values: string[], value: string) => {
    const raw = value.trim().slice(0, 60);
    const next = raw ? `${raw.charAt(0).toUpperCase()}${raw.slice(1)}` : "";
    if (!next) return values;
    if (values.some((item) => item.toLowerCase() === next.toLowerCase())) return values;
    return [...values, next];
  }, []);

  const addTypeValue = useCallback((value: string) => {
    const normalized = normalizeTypeLabel(value.trim());
    if (!normalized) return;
    setTypes((prev) => addUnique(prev, normalized));
  }, [addUnique]);

  const updateExerciseMetadata = useCallback(async (
    exerciseId: string,
    exerciseName: string,
    previousProgression: string[],
    nextProgression: string[],
    previousVariants: string[],
    nextVariants: string[],
  ) => {
    const previousRows = exerciseVariantRows;
    setExerciseVariantRows((prev) => prev.map((row) => row.id === exerciseId
      ? { ...row, progression: nextProgression, variants: nextVariants }
      : row));

    try {
      await api.patch(`/api/exercise-library/${exerciseId}`, {
        progression: nextProgression,
        variations: nextVariants,
      });

      const beforeProgression = previousProgression.join(", ") || "—";
      const afterProgression = nextProgression.join(", ") || "—";
      if (beforeProgression !== afterProgression) {
        await api.post("/api/exercise-library/edit-history", {
          exerciseId,
          exerciseName,
          field: "Progression",
          beforeValue: beforeProgression,
          afterValue: afterProgression,
        });
      }

      const beforeValue = previousVariants.join(", ") || "—";
      const afterValue = nextVariants.join(", ") || "—";
      if (beforeValue !== afterValue) {
        await api.post("/api/exercise-library/edit-history", {
          exerciseId,
          exerciseName,
          field: "Variants",
          beforeValue,
          afterValue,
        });
      }
    } catch (error) {
      setExerciseVariantRows(previousRows);
      setMessage(`Failed to update progression/variants for ${exerciseName}.`);
      throw error;
    }
  }, [exerciseVariantRows]);

  const filteredExerciseVariantRows = useMemo(() => {
    return exerciseVariantRows.filter((row) => {
      if (variantCategoryFilter && row.category !== variantCategoryFilter) return false;
      if (variantTypeFilter && row.exerciseType !== variantTypeFilter) return false;
      return true;
    });
  }, [exerciseVariantRows, variantCategoryFilter, variantTypeFilter]);

  const hasUnsavedChanges = useMemo(() => {
    const listEquals = (a: string[], b: string[]) => {
      if (a.length !== b.length) return false;
      return a.every((value, index) => value === b[index]);
    };

    const nextOptions: ExerciseDbOptions = {
      categories: normalizeDraft(categories),
      types: normalizeTypeDraft(types),
      muscles: normalizeDraft(muscles),
      variants: normalizeDraft(variants),
    };

    const renameCount = pendingRenames.categories.length
      + pendingRenames.types.length
      + pendingRenames.muscles.length
      + pendingRenames.variants.length;

    return !listEquals(nextOptions.categories, initialOptions.categories)
      || !listEquals(nextOptions.types, initialOptions.types)
      || !listEquals(nextOptions.muscles, initialOptions.muscles)
      || !listEquals(nextOptions.variants, initialOptions.variants)
      || renameCount > 0;
  }, [categories, types, muscles, variants, pendingRenames, initialOptions]);

  useEffect(() => {
    const load = async () => {
      try {
        const [data, exerciseData] = await Promise.all([
          api.get<{ options?: ExerciseDbOptions }>("/api/exercise-library/db-settings"),
          api.get<{ exercises?: SimpleExercise[] }>("/api/exercise-library"),
        ]);
        const options = data.options ?? defaults;
        const normalizedInitial: ExerciseDbOptions = {
          categories: normalizeDraft(options.categories),
          types: normalizeTypeDraft(options.types),
          muscles: normalizeDraft(options.muscles),
          variants: normalizeDraft(options.variants),
        };
        setCategories(options.categories);
        setTypes(normalizeTypeDraft(options.types));
        setMuscles(options.muscles);
        setVariants(options.variants);
        setInitialOptions(normalizedInitial);
        setExerciseVariantRows(
          (exerciseData.exercises ?? []).map((exercise) => ({
            id: exercise.id,
            name: exercise.name,
            category: exercise.category,
            exerciseType: normalizeTypeLabel(exercise.exerciseType),
            progression: (exercise.progression ?? []).filter(Boolean),
            variants: (exercise.variations ?? []).map((item) => item.name).filter(Boolean),
          })),
        );
        setPendingRenames({ categories: [], types: [], muscles: [], variants: [] });
      } catch (error) {
        console.error("Failed to load exercise DB settings:", error);
        setMessage("Unable to load DB settings. Using defaults.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [defaults]);

  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm("You have unsaved DB setting changes. Leave without saving?");
      if (!confirmed) return;
    }
    router.push("/dashboard/exercises");
  }, [hasUnsavedChanges, router]);

  const registerRename = useCallback((key: keyof RenameState, from: string, to: string) => {
    const src = from.trim();
    const dest = to.trim();
    if (!src || !dest) return;
    if (src.toLowerCase() === dest.toLowerCase()) return;
    setPendingRenames((prev) => ({
      ...prev,
      [key]: [...prev[key], { from: src, to: dest }],
    }));
  }, []);

  const save = async () => {
    setMessage("");
    setSaving(true);
    try {
      const previousData = await api.get<{ options?: ExerciseDbOptions }>("/api/exercise-library/db-settings");
      const previous = previousData.options ?? defaults;

      const next = {
        categories: normalizeDraft(categories),
        types: normalizeTypeDraft(types),
        muscles: normalizeDraft(muscles),
        variants: normalizeDraft(variants),
      };

      const payload: ExerciseDbOptions = {
        categories: next.categories,
        types: next.types,
        muscles: next.muscles,
        variants: next.variants,
      };

      if (payload.categories.length === 0) {
        setMessage("Add at least one category.");
        setSaving(false);
        return;
      }
      if (payload.types.length === 0) {
        setMessage("Enable at least one type.");
        setSaving(false);
        return;
      }
      if (payload.muscles.length === 0) {
        setMessage("Add at least one muscle group.");
        setSaving(false);
        return;
      }

      await api.put("/api/exercise-library/db-settings", { options: payload, renames: pendingRenames });

      const formatValue = (values: string[]) => {
        const raw = values.join(", ") || "—";
        return raw.length > 500 ? `${raw.slice(0, 497)}...` : raw;
      };

      const changes: Array<{ field: string; beforeValue: string; afterValue: string }> = [];
      if (formatValue(previous.categories) !== formatValue(payload.categories)) {
        changes.push({
          field: "DB Categories",
          beforeValue: formatValue(previous.categories),
          afterValue: formatValue(payload.categories),
        });
      }
      if (formatValue(previous.types) !== formatValue(payload.types)) {
        changes.push({
          field: "DB Types",
          beforeValue: formatValue(previous.types),
          afterValue: formatValue(payload.types),
        });
      }
      if (formatValue(previous.muscles) !== formatValue(payload.muscles)) {
        changes.push({
          field: "DB Muscles",
          beforeValue: formatValue(previous.muscles),
          afterValue: formatValue(payload.muscles),
        });
      }
      if (formatValue(previous.variants) !== formatValue(payload.variants)) {
        changes.push({
          field: "DB Variants",
          beforeValue: formatValue(previous.variants),
          afterValue: formatValue(payload.variants),
        });
      }

      for (const change of changes) {
        await api.post("/api/exercise-library/edit-history", {
          exerciseId: "exercise-db-settings",
          exerciseName: "Exercise DB Settings",
          field: change.field,
          beforeValue: change.beforeValue,
          afterValue: change.afterValue,
        });
      }

      setMessage("DB settings saved.");
      setInitialOptions(payload);
      setPendingRenames({ categories: [], types: [], muscles: [], variants: [] });
    } catch (error) {
      console.error("Failed to save DB settings:", error);
      setMessage("Failed to save DB settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Exercise DB Settings" subtitle="Manage category, type, muscle, progression, and variant options" mobileContentPaddingClass="p-2 pb-24">
      <div className="nyaa-history-page space-y-2 px-0 py-2 sm:py-3">
        {loading ? (
          <div className="border px-3 py-8 text-sm text-center" style={{ borderColor: "var(--border)", borderRadius: "2px", backgroundColor: "var(--surface)", color: "var(--text-muted)" }}>
            Loading settings...
          </div>
        ) : (
          <div className="nyaa-history-table-shell space-y-3">
            <OptionListEditor
              title="Categories"
              subtitle="Shown when editing Category from Exercise DB"
              values={categories}
              onAdd={(value) => setCategories((prev) => addUnique(prev, value))}
              onRename={(from, to) => {
                setCategories((prev) => prev.map((item) => item === from ? to : item));
                registerRename("categories", from, to);
              }}
              onRemove={(value) => setCategories((prev) => prev.filter((item) => item !== value))}
              placeholder="Add category"
            />

            <OptionListEditor
              title="Types"
              subtitle="Shown when editing Type from Exercise DB"
              values={types}
              onAdd={(value) => addTypeValue(value)}
              onRename={(from, to) => {
                const normalizedTo = normalizeTypeLabel(to);
                setTypes((prev) => prev.map((item) => item === from ? normalizedTo : item));
                registerRename("types", from, normalizedTo);
              }}
              onRemove={(value) => setTypes((prev) => prev.filter((item) => item !== value))}
              placeholder="Add type"
            />

            <OptionListEditor
              title="Muscle Groups"
              subtitle="Shown when editing Muscles from Exercise DB"
              values={muscles}
              onAdd={(value) => setMuscles((prev) => addUnique(prev, value))}
              onRename={(from, to) => {
                setMuscles((prev) => prev.map((item) => item === from ? to : item));
                registerRename("muscles", from, to);
              }}
              onRemove={(value) => setMuscles((prev) => prev.filter((item) => item !== value))}
              placeholder="Add muscle group"
            />

            <div className="border overflow-hidden" style={{ borderColor: "var(--border)", borderRadius: "2px" }}>
              <div className="px-3 py-2 border-b" style={{ borderColor: "#f5f5f5", backgroundColor: "#f5f5f5" }}>
                <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Exercise Progressions and Variants</p>
                <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Review progression tracks and manage each exercise's unique variants here.</p>
              </div>
              <div className="flex flex-wrap gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}>
                <select
                  value={variantCategoryFilter}
                  onChange={(e) => setVariantCategoryFilter(e.target.value)}
                  className="px-2 py-1.5 text-[11px] outline-none border transition-colors cursor-pointer hover:border-accent/60 hover:bg-surface-hover focus:border-accent/70"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}
                >
                  <option value="">All Categories</option>
                  {categories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <select
                  value={variantTypeFilter}
                  onChange={(e) => setVariantTypeFilter(e.target.value)}
                  className="px-2 py-1.5 text-[11px] outline-none border transition-colors cursor-pointer hover:border-accent/60 hover:bg-surface-hover focus:border-accent/70"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--surface)", borderRadius: "2px" }}
                >
                  <option value="">All Types</option>
                  {types.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className="overflow-x-auto" style={{ backgroundColor: "var(--surface)" }}>
                <table className="w-full text-[11px] border-collapse" style={{ minWidth: "880px" }}>
                  <thead>
                    <tr>
                      <th className="px-2 py-2 text-center border-b whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)", width: "12%" }}>Category</th>
                      <th className="px-2 py-2 text-center border-b whitespace-nowrap" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)", width: "11%" }}>Type</th>
                      <th className="px-3 py-2 text-left border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)", width: "24%" }}>Exercise</th>
                      <th className="px-3 py-2 text-left border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)", width: "23%" }}>Progression</th>
                      <th className="px-3 py-2 text-left border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)" }}>Variants</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExerciseVariantRows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center border-b" style={{ borderColor: "var(--border)", color: "var(--text-muted)" }}>
                          No exercises found.
                        </td>
                      </tr>
                    ) : (
                      filteredExerciseVariantRows.map((row) => (
                        <tr key={row.id}>
                          <td className="px-2 py-2 align-top text-center border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                            <span
                              className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] whitespace-nowrap"
                              style={{
                                borderRadius: "2px",
                                backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)",
                              }}
                            >
                              {row.category}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-top text-center border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                            <span
                              className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] whitespace-nowrap"
                              style={{
                                borderRadius: "2px",
                                backgroundColor: "color-mix(in srgb, var(--border) 10%, transparent)",
                              }}
                            >
                              {row.exerciseType}
                            </span>
                          </td>
                          <td className="px-3 py-2 align-top border-b" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                            <div>{row.name}</div>
                          </td>
                          <td className="px-3 py-2 align-top border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                            <ExerciseRowLabelEditor
                              row={row}
                              values={row.progression}
                              kind="progression"
                              emptyLabel="No progression yet"
                              addPlaceholder="Add progression"
                              onSave={(exerciseId, exerciseName, previousValues, nextValues) => updateExerciseMetadata(
                                exerciseId,
                                exerciseName,
                                previousValues,
                                nextValues,
                                row.variants,
                                row.variants,
                              )}
                            />
                          </td>
                          <td className="px-3 py-2 border-b" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                            <ExerciseRowLabelEditor
                              row={row}
                              values={row.variants}
                              kind="variant"
                              emptyLabel="No variants yet"
                              addPlaceholder="Add variant"
                              onSave={(exerciseId, exerciseName, previousValues, nextValues) => updateExerciseMetadata(
                                exerciseId,
                                exerciseName,
                                row.progression,
                                row.progression,
                                previousValues,
                                nextValues,
                              )}
                            />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {message && (
              <p className="text-xs" style={{ color: message.includes("saved") ? "var(--state-success)" : "var(--danger)" }}>
                {message}
              </p>
            )}

            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={handleBack}
                className="px-3 py-1.5 text-xs border"
                style={{ borderColor: "var(--border)", borderRadius: "2px", color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}
              >
                Back to Exercise DB
              </button>
            </div>

            {hasUnsavedChanges && (
              <div
                className="border p-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderColor: "color-mix(in srgb, var(--accent) 38%, var(--border))", borderRadius: "2px", backgroundColor: "color-mix(in srgb, var(--accent) 8%, var(--surface))" }}
              >
                <div>
                  <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Unsaved changes detected</p>
                  <p className="text-[11px]" style={{ color: "var(--text-secondary)" }}>Review your edits and save to apply DB setting updates.</p>
                </div>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setCategories(initialOptions.categories);
                      setTypes(initialOptions.types);
                      setMuscles(initialOptions.muscles);
                      setVariants(initialOptions.variants);
                      setPendingRenames({ categories: [], types: [], muscles: [], variants: [] });
                      setMessage("Changes discarded.");
                    }}
                    className="px-3 py-1.5 text-xs border"
                    style={{ borderColor: "var(--border)", borderRadius: "2px", color: "var(--text-secondary)", backgroundColor: "var(--surface)" }}
                    disabled={saving}
                  >
                    Discard
                  </button>
                  <GlowButton onClick={save} variant="jade" size="sm" disabled={saving}>
                    {saving ? "Saving..." : "Save DB Settings"}
                  </GlowButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
