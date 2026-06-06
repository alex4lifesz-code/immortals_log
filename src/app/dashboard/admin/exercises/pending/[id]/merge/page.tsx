"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { api } from "@/lib/api-client";
import type { SimpleExercise } from "@/lib/exercise-types";

function normalize(value: string | null | undefined): string {
  return String(value || "").trim();
}

function dedupe(values: Array<string | null | undefined>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = normalize(raw);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export default function AddPendingToExistingExercisePage() {
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const pendingId = Array.isArray(params?.id) ? params.id[0] ?? "" : params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [allExercises, setAllExercises] = useState<SimpleExercise[]>([]);
  const [selectedParentExerciseId, setSelectedParentExerciseId] = useState("");
  const [selectedProgression, setSelectedProgression] = useState("");
  const [selectedVariant, setSelectedVariant] = useState("");
  const [selectedGrip, setSelectedGrip] = useState("");
  const [selectedEquipment, setSelectedEquipment] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const data = await api.get<{ exercises: SimpleExercise[] }>("/api/exercise-library");
        if (cancelled) return;
        const exercises = data.exercises || [];
        setAllExercises(exercises);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load exercise data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const pendingExercise = useMemo(() => {
    return allExercises.find((exercise) => exercise.id === pendingId && exercise.isPendingAddition) || null;
  }, [allExercises, pendingId]);

  const parentExerciseOptions = useMemo(() => {
    return allExercises
      .filter((exercise) => !exercise.isPendingAddition)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  }, [allExercises]);

  const selectedParent = useMemo(() => {
    return parentExerciseOptions.find((exercise) => exercise.id === selectedParentExerciseId) || null;
  }, [parentExerciseOptions, selectedParentExerciseId]);

  const pendingProgressionDefaults = dedupe(pendingExercise?.progression || []);
  const pendingVariantDefaults = dedupe((pendingExercise?.variations || []).map((variation) => variation.name));
  const pendingGripDefaults = dedupe(pendingExercise?.setupOptions || []);
  const pendingEquipmentDefaults = dedupe(pendingExercise?.equipment || []);

  const progressionOptions = useMemo(() => {
    return dedupe([...(selectedParent?.progression || []), ...pendingProgressionDefaults]);
  }, [pendingProgressionDefaults, selectedParent?.progression]);

  const variantOptions = useMemo(() => {
    return dedupe([
      ...((selectedParent?.variations || []).map((variation) => variation.name)),
      ...pendingVariantDefaults,
    ]);
  }, [pendingVariantDefaults, selectedParent?.variations]);

  const gripOptions = useMemo(() => {
    return dedupe([...(selectedParent?.setupOptions || []), ...pendingGripDefaults]);
  }, [pendingGripDefaults, selectedParent?.setupOptions]);

  const equipmentOptions = useMemo(() => {
    return dedupe([...(selectedParent?.equipment || []), ...pendingEquipmentDefaults]);
  }, [pendingEquipmentDefaults, selectedParent?.equipment]);

  useEffect(() => {
    if (!selectedParent) {
      setSelectedProgression("");
      setSelectedVariant("");
      setSelectedGrip("");
      setSelectedEquipment("");
      return;
    }

    setSelectedProgression((prev) => {
      if (prev && progressionOptions.some((item) => item.toLowerCase() === prev.toLowerCase())) return prev;
      return pendingProgressionDefaults[0] || progressionOptions[0] || "";
    });

    setSelectedVariant((prev) => {
      if (prev && variantOptions.some((item) => item.toLowerCase() === prev.toLowerCase())) return prev;
      return pendingVariantDefaults[0] || variantOptions[0] || "";
    });

    setSelectedGrip((prev) => {
      if (prev && gripOptions.some((item) => item.toLowerCase() === prev.toLowerCase())) return prev;
      return pendingGripDefaults[0] || gripOptions[0] || "";
    });

    setSelectedEquipment((prev) => {
      if (prev && equipmentOptions.some((item) => item.toLowerCase() === prev.toLowerCase())) return prev;
      return pendingEquipmentDefaults[0] || equipmentOptions[0] || "";
    });
  }, [
    equipmentOptions,
    gripOptions,
    pendingEquipmentDefaults,
    pendingGripDefaults,
    pendingProgressionDefaults,
    pendingVariantDefaults,
    progressionOptions,
    selectedParent,
    variantOptions,
  ]);

  const canSubmit = Boolean(pendingExercise && selectedParentExerciseId) && !saving;

  const handleSubmit = async () => {
    if (!pendingExercise || !selectedParentExerciseId) {
      setError("Choose a parent exercise first.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      await api.post(`/api/exercise-library/${pendingExercise.id}/pending`, {
        action: "add-to-existing",
        parentExerciseId: selectedParentExerciseId,
        progressionName: selectedProgression || null,
        variantName: selectedVariant || null,
        setupOption: selectedGrip || null,
        equipmentName: selectedEquipment || null,
      });

      setMessage("Pending exercise data added to the selected exercise.");
      setTimeout(() => {
        router.push("/dashboard/admin/exercises");
      }, 700);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to add pending exercise to existing exercise.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout title="Add Pending To Existing Exercise" mobileContentPaddingClass="px-3 py-3">
      <GlowCard glow="jade" className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[color:var(--text-primary)]">Add pending exercise to an existing exercise</h2>
            <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
              Select the parent exercise, then map progression, variant, grip, and equipment values.
            </p>
          </div>
          <Link href="/dashboard/admin/exercises" className="text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
            Back
          </Link>
        </div>

        {loading ? <p className="text-sm text-[color:var(--text-secondary)]">Loading...</p> : null}
        {error ? <p className="text-sm text-[color:var(--danger-hover)]">{error}</p> : null}
        {message ? <p className="text-sm text-[color:var(--jade-glow)]">{message}</p> : null}

        {!loading && pendingExercise ? (
          <div className="space-y-4">
            <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)" }}>
              <p className="font-semibold text-[color:var(--text-primary)]">Pending: {pendingExercise.name}</p>
              <p className="mt-1 text-[color:var(--text-secondary)]">
                Progression: {pendingProgressionDefaults.join(", ") || "-"} | Variants: {pendingVariantDefaults.join(", ") || "-"}
              </p>
              <p className="mt-1 text-[color:var(--text-secondary)]">
                Grip: {pendingGripDefaults.join(", ") || "-"} | Equipment: {pendingEquipmentDefaults.join(", ") || "-"}
              </p>
            </div>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Parent exercise</span>
              <select
                value={selectedParentExerciseId}
                onChange={(event) => setSelectedParentExerciseId(event.target.value)}
                className="h-10 w-full rounded-md border px-3 text-sm"
                style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}
              >
                <option value="">Select parent exercise</option>
                {parentExerciseOptions.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedParent ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Progression</span>
                  <select value={selectedProgression} onChange={(event) => setSelectedProgression(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                    <option value="">Do not add progression</option>
                    {progressionOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Variant</span>
                  <select value={selectedVariant} onChange={(event) => setSelectedVariant(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                    <option value="">Do not add variant</option>
                    {variantOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Grip</span>
                  <select value={selectedGrip} onChange={(event) => setSelectedGrip(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                    <option value="">Do not add grip</option>
                    {gripOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs uppercase tracking-[0.08em] text-[color:var(--text-muted)]">Equipment</span>
                  <select value={selectedEquipment} onChange={(event) => setSelectedEquipment(event.target.value)} className="h-10 w-full rounded-md border px-3 text-sm" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)", backgroundColor: "color-mix(in srgb, var(--surface) 90%, black)" }}>
                    <option value="">Do not add equipment</option>
                    {equipmentOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
            ) : null}

            <div className="flex justify-end gap-2">
              <Link href="/dashboard/admin/exercises" className="inline-flex h-10 items-center rounded-md border px-3 text-xs" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 45%, transparent)" }}>
                Cancel
              </Link>
              <GlowButton onClick={() => void handleSubmit()} disabled={!canSubmit} variant="jade" size="sm">
                {saving ? "Saving..." : "Add to existing exercise"}
              </GlowButton>
            </div>
          </div>
        ) : null}

        {!loading && !pendingExercise ? (
          <p className="text-sm text-[color:var(--text-secondary)]">Pending exercise not found.</p>
        ) : null}
      </GlowCard>
    </PageLayout>
  );
}
