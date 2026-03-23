"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import { GlowModal } from "@/components/ui/GlowCard";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  TierStandard,
  WeightStandardRecord,
  ExerciseWithStandards,
  DEFAULT_MALE_STANDARDS,
  DEFAULT_FEMALE_STANDARDS,
  TIER_NAMES,
  TIER_COLORS,
  recordToTiers,
} from "@/lib/weight-standards";

// ── Weight Standards Editor Modal ──

interface EditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  exercise: ExerciseWithStandards | null;
  userId: string;
  onSaved: () => void;
}

function WeightStandardsEditorModal({ isOpen, onClose, exercise, userId, onSaved }: EditorModalProps) {
  const [activeTab, setActiveTab] = useState<"MALE" | "FEMALE">("MALE");
  const [maleTiers, setMaleTiers] = useState<TierStandard[]>([...DEFAULT_MALE_STANDARDS]);
  const [femaleTiers, setFemaleTiers] = useState<TierStandard[]>([...DEFAULT_FEMALE_STANDARDS]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [previewBw, setPreviewBw] = useState(70);

  useEffect(() => {
    if (isOpen && exercise) {
      setMaleTiers(
        exercise.maleStandard
          ? recordToTiers(exercise.maleStandard)
          : DEFAULT_MALE_STANDARDS.map((t) => ({ ...t }))
      );
      setFemaleTiers(
        exercise.femaleStandard
          ? recordToTiers(exercise.femaleStandard)
          : DEFAULT_FEMALE_STANDARDS.map((t) => ({ ...t }))
      );
      setError("");
      setActiveTab("MALE");
    }
  }, [isOpen, exercise]);

  const currentTiers = activeTab === "MALE" ? maleTiers : femaleTiers;
  const setCurrentTiers = activeTab === "MALE" ? setMaleTiers : setFemaleTiers;

  const updateTierValue = (tierIndex: number, field: "minPercentage" | "maxPercentage", value: number) => {
    setCurrentTiers((prev) => {
      const next = prev.map((t) => ({ ...t }));
      next[tierIndex][field] = value;

      // Auto-connect: if changing max, set next tier's min to match
      if (field === "maxPercentage" && tierIndex < 5) {
        next[tierIndex + 1].minPercentage = value;
      }
      // Auto-connect: if changing min, set prev tier's max to match
      if (field === "minPercentage" && tierIndex > 0) {
        next[tierIndex - 1].maxPercentage = value;
      }

      return next;
    });
  };

  const handleSave = async () => {
    if (!exercise) return;
    setSaving(true);
    setError("");

    try {
      // Save male standards
      const maleRes = await fetch(`/api/admin/weight-standards/${exercise.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gender: "MALE", tiers: maleTiers }),
      });
      if (!maleRes.ok) {
        const err = await maleRes.json();
        throw new Error(err.error || "Failed to save male standards");
      }

      // Save female standards
      const femaleRes = await fetch(`/api/admin/weight-standards/${exercise.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ gender: "FEMALE", tiers: femaleTiers }),
      });
      if (!femaleRes.ok) {
        const err = await femaleRes.json();
        throw new Error(err.error || "Failed to save female standards");
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const copyFromDefaults = () => {
    if (activeTab === "MALE") {
      setMaleTiers(DEFAULT_MALE_STANDARDS.map((t) => ({ ...t })));
    } else {
      setFemaleTiers(DEFAULT_FEMALE_STANDARDS.map((t) => ({ ...t })));
    }
  };

  const copyFromOtherGender = () => {
    if (activeTab === "MALE") {
      setMaleTiers(femaleTiers.map((t) => ({ ...t })));
    } else {
      setFemaleTiers(maleTiers.map((t) => ({ ...t })));
    }
  };

  if (!exercise) return null;

  return (
    <GlowModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Weight Standards"
      panelClassName="!max-w-2xl"
    >
      <div className="space-y-4">
        <div className="text-sm font-semibold text-cloud-white">{exercise.name}</div>

        {error && (
          <div className="rounded-lg border border-crimson/40 bg-crimson-deep/20 px-3 py-2 text-xs text-crimson-light">
            {error}
          </div>
        )}

        {/* Gender Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("MALE")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              activeTab === "MALE"
                ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                : "border-ink-light bg-ink-dark text-mist-light hover:border-jade/30"
            }`}
          >
            ♂️ Male
          </button>
          <button
            onClick={() => setActiveTab("FEMALE")}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              activeTab === "FEMALE"
                ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                : "border-ink-light bg-ink-dark text-mist-light hover:border-jade/30"
            }`}
          >
            ♀️ Female
          </button>
        </div>

        {/* Tier Table */}
        <div className="rounded-xl border border-ink-light/30 overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 bg-ink-mid/30 border-b border-ink-light/20 text-[10px] font-semibold uppercase tracking-wider text-mist-dark">
            <span>Tier</span>
            <span className="text-center">Min %</span>
            <span className="text-center">Max %</span>
          </div>
          <div className="divide-y divide-ink-light/15">
            {currentTiers.map((tier, i) => (
              <div key={tier.tier} className="grid grid-cols-[1fr_100px_100px] gap-2 px-3 py-2 items-center">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: TIER_COLORS[i] }}
                  />
                  <span className="text-xs text-cloud-white">
                    Tier {tier.tier}: {TIER_NAMES[i]}
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={tier.minPercentage}
                  onChange={(e) => updateTierValue(i, "minPercentage", Number(e.target.value))}
                  disabled={i === 0}
                  className="w-full bg-ink-dark border border-ink-light/40 rounded-lg px-2 py-1.5 text-xs text-cloud-white text-center outline-none focus:border-jade-glow/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={tier.maxPercentage}
                  onChange={(e) => updateTierValue(i, "maxPercentage", Number(e.target.value))}
                  disabled={i === 5}
                  className="w-full bg-ink-dark border border-ink-light/40 rounded-lg px-2 py-1.5 text-xs text-cloud-white text-center outline-none focus:border-jade-glow/50 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-ink-light/20 bg-ink-mid/20 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-mist-dark uppercase tracking-wider">Preview</span>
            <input
              type="number"
              min={1}
              step={5}
              value={previewBw}
              onChange={(e) => setPreviewBw(Math.max(1, Number(e.target.value)))}
              className="w-16 bg-ink-dark border border-ink-light/40 rounded px-2 py-0.5 text-[11px] text-cloud-white text-center outline-none focus:border-jade-glow/50"
            />
            <span className="text-[10px] text-mist-dark">kg {activeTab === "MALE" ? "♂️" : "♀️"}</span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {currentTiers.map((tier, i) => {
              const minKg = ((tier.minPercentage / 100) * previewBw).toFixed(1);
              const maxKg = tier.maxPercentage >= 999 ? "∞" : ((tier.maxPercentage / 100) * previewBw).toFixed(1);
              return (
                <span
                  key={i}
                  className="text-[10px]"
                  style={{ color: TIER_COLORS[i] }}
                >
                  T{tier.tier}: {minKg}–{maxKg}kg
                </span>
              );
            })}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <button
            onClick={copyFromDefaults}
            className="px-3 py-1.5 text-[11px] rounded-lg border border-ink-light/40 text-mist-light hover:bg-ink-mid/30 transition-colors"
          >
            📋 Load Defaults
          </button>
          <button
            onClick={copyFromOtherGender}
            className="px-3 py-1.5 text-[11px] rounded-lg border border-ink-light/40 text-mist-light hover:bg-ink-mid/30 transition-colors"
          >
            📋 Copy from {activeTab === "MALE" ? "Female" : "Male"}
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-ink-light/20">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-mist-light hover:text-cloud-white transition-colors"
          >
            Cancel
          </button>
          <GlowButton onClick={handleSave} variant="jade" size="sm" glow disabled={saving}>
            {saving ? "Saving..." : "Save Standards"}
          </GlowButton>
        </div>
      </div>
    </GlowModal>
  );
}

// ── Sidebar ──

function WeightStandardsSidebar() {
  return (
    <div className="space-y-3">
      <GlowCard glow="jade" hoverable={false}>
        <h3 className="text-xs text-jade-glow uppercase mb-2">Weight Standards</h3>
        <p className="text-xs text-mist-dark">
          Configure gender-specific strength standards for exercises. These determine user tier calculations
          based on bodyweight percentage.
        </p>
      </GlowCard>
      <GlowCard glow="blue" hoverable={false}>
        <h3 className="text-xs text-mountain-blue-glow uppercase mb-2">Tier System</h3>
        <div className="space-y-1">
          {TIER_NAMES.map((name, i) => (
            <div key={name} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TIER_COLORS[i] }} />
              <span className="text-[10px] text-mist-light">Tier {i + 1}: {name}</span>
            </div>
          ))}
        </div>
      </GlowCard>
    </div>
  );
}

// ── Export / Import Helpers ──

interface ExportExercise {
  exerciseId: string;
  exerciseName: string;
  category: string;
  male: TierStandard[];
  female: TierStandard[];
}

function buildExportData(exercises: ExerciseWithStandards[]): ExportExercise[] {
  return exercises.map((ex) => ({
    exerciseId: ex.id,
    exerciseName: ex.name,
    category: ex.category,
    male: ex.maleStandard
      ? recordToTiers(ex.maleStandard)
      : DEFAULT_MALE_STANDARDS.map((t) => ({ ...t })),
    female: ex.femaleStandard
      ? recordToTiers(ex.femaleStandard)
      : DEFAULT_FEMALE_STANDARDS.map((t) => ({ ...t })),
  }));
}

function downloadJson(data: unknown, filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportSingle(exercise: ExerciseWithStandards) {
  const data = { exercises: buildExportData([exercise]) };
  const safeName = exercise.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();
  downloadJson(data, `weight-standards_${safeName}.json`);
}

function exportBulk(exercises: ExerciseWithStandards[]) {
  const data = { exercises: buildExportData(exercises) };
  const date = new Date().toISOString().slice(0, 10);
  downloadJson(data, `weight-standards_all_${date}.json`);
}

// ── Import Results Modal ──

interface ImportResult {
  exerciseName: string;
  status: string;
  error?: string;
}

interface ImportResultsModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: { imported: number; skipped: number; errors: number; total: number } | null;
  results: ImportResult[];
}

function ImportResultsModal({ isOpen, onClose, summary, results }: ImportResultsModalProps) {
  if (!summary) return null;

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Import Results" panelClassName="!max-w-lg">
      <div className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-4 gap-2">
          <div className="rounded-lg bg-ink-mid/30 px-2 py-2 text-center">
            <p className="text-lg font-bold text-cloud-white">{summary.total}</p>
            <p className="text-[9px] text-mist-dark uppercase">Total</p>
          </div>
          <div className="rounded-lg bg-green-900/20 border border-green-700/30 px-2 py-2 text-center">
            <p className="text-lg font-bold text-green-400">{summary.imported}</p>
            <p className="text-[9px] text-green-400/70 uppercase">Imported</p>
          </div>
          <div className="rounded-lg bg-amber-900/20 border border-amber-700/30 px-2 py-2 text-center">
            <p className="text-lg font-bold text-amber-400">{summary.skipped}</p>
            <p className="text-[9px] text-amber-400/70 uppercase">Skipped</p>
          </div>
          <div className="rounded-lg bg-red-900/20 border border-red-700/30 px-2 py-2 text-center">
            <p className="text-lg font-bold text-crimson-light">{summary.errors}</p>
            <p className="text-[9px] text-crimson-light/70 uppercase">Errors</p>
          </div>
        </div>

        {/* Detail list */}
        {results.length > 0 && (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-ink-light/20">
            <div className="divide-y divide-ink-light/15">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="text-xs">
                    {r.status === "imported" ? "✅" : r.status === "skipped" ? "⚠️" : "❌"}
                  </span>
                  <span className="text-xs text-cloud-white flex-1 truncate">{r.exerciseName}</span>
                  {r.error && <span className="text-[10px] text-crimson-light truncate max-w-[200px]">{r.error}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-ink-light/20">
          <GlowButton onClick={onClose} variant="jade" size="sm">
            Done
          </GlowButton>
        </div>
      </div>
    </GlowModal>
  );
}

// ── Main Page ──

export default function WeightStandardsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = user?.role === "admin";

  const [exercises, setExercises] = useState<ExerciseWithStandards[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "configured" | "unconfigured">("all");
  const [genderFilter, setGenderFilter] = useState<"all" | "male" | "female">("all");

  // Editor modal state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingExercise, setEditingExercise] = useState<ExerciseWithStandards | null>(null);

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<ImportResult[]>([]);
  const [importSummary, setImportSummary] = useState<{ imported: number; skipped: number; errors: number; total: number } | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch("/api/admin/weight-standards", { credentials: "include" });
      if (res.status === 403) {
        router.push("/dashboard");
        return;
      }
      const data = await res.json();
      if (data.exercises) setExercises(data.exercises);
    } catch (err) {
      console.error("Failed to fetch weight standards:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, router]);

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) {
      router.push("/dashboard");
      return;
    }
    fetchData();
  }, [user, isAdmin, fetchData, router]);

  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!ex.name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter === "configured") {
        if (!ex.maleStandard && !ex.femaleStandard) return false;
      }
      if (statusFilter === "unconfigured") {
        if (ex.maleStandard && ex.femaleStandard) return false;
      }
      if (genderFilter === "male") {
        if (!ex.maleStandard) return false;
      }
      if (genderFilter === "female") {
        if (!ex.femaleStandard) return false;
      }
      return true;
    });
  }, [exercises, searchQuery, statusFilter, genderFilter]);

  const handleEdit = (exercise: ExerciseWithStandards) => {
    setEditingExercise(exercise);
    setEditorOpen(true);
  };

  const handleDelete = async (exerciseId: string) => {
    if (!user?.id) return;
    if (!confirm("Remove all weight standards for this exercise? It will revert to defaults.")) return;
    try {
      await fetch(`/api/admin/weight-standards/${exerciseId}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchData();
    } catch (err) {
      console.error("Failed to delete:", err);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    // Reset input so the same file can be re-selected
    e.target.value = "";

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.exercises || !Array.isArray(data.exercises)) {
        setImportSummary({ imported: 0, skipped: 0, errors: 1, total: 0 });
        setImportResults([{ exerciseName: "—", status: "error", error: "Invalid format: missing 'exercises' array" }]);
        setImportModalOpen(true);
        return;
      }

      const res = await fetch("/api/admin/weight-standards/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ exercises: data.exercises }),
      });

      const result = await res.json();
      if (!res.ok) {
        setImportSummary({ imported: 0, skipped: 0, errors: 1, total: 0 });
        setImportResults([{ exerciseName: "—", status: "error", error: result.error || "Import failed" }]);
      } else {
        setImportSummary(result.summary);
        setImportResults(result.results);
        fetchData();
      }
      setImportModalOpen(true);
    } catch (err) {
      setImportSummary({ imported: 0, skipped: 0, errors: 1, total: 0 });
      setImportResults([{ exerciseName: "—", status: "error", error: err instanceof Error ? err.message : "Failed to parse file" }]);
      setImportModalOpen(true);
    } finally {
      setImporting(false);
    }
  };

  if (!user || !isAdmin) {
    return (
      <PageLayout
        title="Weight Standards"
        subtitle="Manage exercise strength standards"
        sidebar={<WeightStandardsSidebar />}
        sidebarLabel="Weight Standards"
      >
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="text-5xl opacity-50">🔒</div>
          <h3 className="text-lg font-semibold text-crimson-light">Access Restricted</h3>
          <p className="text-sm text-mist-dark text-center max-w-md">
            Weight Standards management is reserved for administrators.
          </p>
          <GlowButton variant="ghost" size="sm" onClick={() => router.push("/dashboard")}>
            ← Return to Dashboard
          </GlowButton>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Weight Standards"
      subtitle="Configure gender-specific strength standards"
      sidebar={<WeightStandardsSidebar />}
      sidebarLabel="Weight Standards"
    >
      <div className="px-1 py-3 sm:px-0 sm:py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-cloud-white uppercase tracking-wider">Weight Standards Management</h2>
            <p className="text-[11px] text-mist-dark mt-0.5">Configure gender-specific strength standards for exercises</p>
          </div>
          <div className="flex items-center gap-2">
            <GlowButton
              variant="gold"
              size="sm"
              onClick={() => exportBulk(exercises)}
              disabled={exercises.length === 0}
            >
              📤 Export All
            </GlowButton>
            <GlowButton
              variant="blue"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Importing…" : "📥 Import"}
            </GlowButton>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFile}
            />
            <GlowButton variant="ghost" size="sm" onClick={() => router.push("/dashboard/admin")}>
              ← Back
            </GlowButton>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-mist-dark pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search exercises..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-ink-dark/80 border border-ink-light/40 rounded-lg pl-10 pr-4 py-2.5 text-sm text-cloud-white placeholder:text-mist-dark/60 outline-none transition-all duration-200 focus:border-jade-glow/60"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as "all" | "configured" | "unconfigured")}
              className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="all">All Status</option>
              <option value="configured">Configured</option>
              <option value="unconfigured">Unconfigured</option>
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value as "all" | "male" | "female")}
              className="bg-ink-dark border border-ink-light/40 rounded-lg px-2.5 py-1.5 text-[11px] text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="all">All Genders</option>
              <option value="male">♂️ Male Configured</option>
              <option value="female">♀️ Female Configured</option>
            </select>
          </div>
        </div>

        {/* Exercise Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-mist-mid text-sm animate-pulse">Loading exercises…</p>
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-3">
            <div className="text-4xl opacity-40">⚖️</div>
            <p className="text-sm text-mist-dark">
              {exercises.length === 0 ? "No exercises found. Add exercises in the Exercise Library first." : "No matching exercises"}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-ink-light/30 overflow-hidden">
            {/* Table Header */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_140px_140px_90px] gap-2 px-3 py-2 bg-ink-mid/30 border-b border-ink-light/20 text-[10px] font-semibold uppercase tracking-wider text-mist-dark">
              <span>Exercise</span>
              <span className="text-center">♂️ Male</span>
              <span className="text-center">♀️ Female</span>
              <span></span>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-ink-light/15">
              <AnimatePresence mode="popLayout">
                {filteredExercises.map((ex) => {
                  const hasMale = !!ex.maleStandard;
                  const hasFemale = !!ex.femaleStandard;

                  return (
                    <motion.div
                      key={ex.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="group grid grid-cols-1 sm:grid-cols-[1fr_140px_140px_90px] gap-1 sm:gap-2 px-3 py-2.5 hover:bg-ink-mid/20 transition-colors items-center"
                    >
                      {/* Exercise name */}
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-cloud-white font-medium truncate">{ex.name}</span>
                        <span className="text-[10px] text-mist-dark">{ex.category}</span>
                      </div>

                      {/* Male status */}
                      <div className="flex items-center justify-center gap-1.5">
                        {hasMale ? (
                          <span className="text-[10px] text-green-400 flex items-center gap-1">
                            ✅ 6 tiers set
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                            ⚠️ Not set
                          </span>
                        )}
                      </div>

                      {/* Female status */}
                      <div className="flex items-center justify-center gap-1.5">
                        {hasFemale ? (
                          <span className="text-[10px] text-green-400 flex items-center gap-1">
                            ✅ 6 tiers set
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-400/70 flex items-center gap-1">
                            ⚠️ Not set
                          </span>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => exportSingle(ex)}
                          className="px-2 py-1 text-[11px] rounded border border-gold/30 text-gold hover:bg-gold/10 transition-colors"
                          title="Export standards"
                        >
                          📤
                        </button>
                        <button
                          onClick={() => handleEdit(ex)}
                          className="px-2 py-1 text-[11px] rounded border border-jade/30 text-jade-light hover:bg-jade-deep/20 transition-colors"
                          title="Edit standards"
                        >
                          ✏️
                        </button>
                        {(hasMale || hasFemale) && (
                          <button
                            onClick={() => handleDelete(ex.id)}
                            className="px-2 py-1 text-[11px] rounded border border-crimson/30 text-crimson-light hover:bg-crimson-deep/20 transition-colors"
                            title="Remove standards"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        <div className="text-[11px] text-mist-dark">
          Showing {filteredExercises.length} of {exercises.length} exercises
        </div>
      </div>

      {/* Editor Modal */}
      {user?.id && (
        <WeightStandardsEditorModal
          isOpen={editorOpen}
          onClose={() => setEditorOpen(false)}
          exercise={editingExercise}
          userId={user.id}
          onSaved={fetchData}
        />
      )}

      {/* Import Results Modal */}
      <ImportResultsModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        summary={importSummary}
        results={importResults}
      />
    </PageLayout>
  );
}
