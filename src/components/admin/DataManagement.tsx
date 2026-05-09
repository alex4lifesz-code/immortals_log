"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { translateEnglishToLanguage } from "@/lib/language";

interface UserOption {
  id: string;
  username: string;
  name: string;
  sessionCount?: number;
  progressionLogCount?: number;
  _count?: {
    checkIns: number;
  };
}

type StatusState = {
  type: "idle" | "loading" | "success" | "error";
  message: string;
};

const INITIAL_STATUS: StatusState = { type: "idle", message: "" };

const BACKUP_FEATURES = [
  "User profile and settings",
  "Training logs and progression history",
  "Check-ins and pinned daily notes",
  "Exercise DB with tiers, variations, and modifiers",
];

export default function DataManagement() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const lt = (text: string) => translateEnglishToLanguage(text, settings.languageMode);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false);
  const [purgeStatus, setPurgeStatus] = useState<StatusState>(INITIAL_STATUS);
  const [exportStatus, setExportStatus] = useState<StatusState>(INITIAL_STATUS);
  const [importStatus, setImportStatus] = useState<StatusState>(INITIAL_STATUS);
  const [libraryReplaceExisting, setLibraryReplaceExisting] = useState(false);
  const [libraryExportStatus, setLibraryExportStatus] = useState<StatusState>(INITIAL_STATUS);
  const [libraryImportStatus, setLibraryImportStatus] = useState<StatusState>(INITIAL_STATUS);
  const [libraryPurgeStatus, setLibraryPurgeStatus] = useState<StatusState>(INITIAL_STATUS);
  const importInputRef = useRef<HTMLInputElement>(null);
  const libraryImportInputRef = useRef<HTMLInputElement>(null);

  const refreshUsers = async () => {
    try {
      const res = await fetch("/api/users", { credentials: "include" });
      const payload = await res.json();
      const users = Array.isArray(payload?.data?.users)
        ? payload.data.users
        : Array.isArray(payload?.users)
          ? payload.users
          : [];

      setAllUsers(users);
      setSelectedUserId((current) => {
        if (current && users.some((entry: UserOption) => entry.id === current)) {
          return current;
        }
        if (user?.id && users.some((entry: UserOption) => entry.id === user.id)) {
          return user.id;
        }
        return users[0]?.id || "";
      });
    } catch {
      setAllUsers([]);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refreshUsers();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user?.id]);

  const targetUserId = selectedUserId || user?.id || "";
  const targetUser = allUsers.find((entry) => entry.id === targetUserId);
  const targetUserName = targetUser?.name || user?.name || "Unknown";
  const targetUserSessionCount = targetUser?.sessionCount ?? targetUser?.progressionLogCount ?? 0;
  const targetUserCheckins = targetUser?._count?.checkIns ?? 0;

  const handleExport = async (format: "json" | "xlsx" = "json") => {
    if (!targetUserId) {
      setExportStatus({ type: "error", message: lt("Select a user before exporting.") });
      return;
    }

    setExportStatus({ type: "loading", message: format === "xlsx" ? lt("Preparing backup workbook...") : lt("Preparing backup package...") });

    try {
      const res = await fetch(`/api/admin/backup-studio/export?targetUserId=${encodeURIComponent(targetUserId)}&format=${format}`, {
        credentials: "include",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error?.message || payload?.error || lt("Export failed");
        setExportStatus({ type: "error", message });
        return;
      }

      const exerciseCount = Number(res.headers.get("X-Backup-Exercises") || 0);
      const logCount = Number(res.headers.get("X-Backup-Training-Logs") || 0);
      const checkinCount = Number(res.headers.get("X-Backup-Checkins") || 0);
      const noteCount = Number(res.headers.get("X-Backup-Notes") || 0);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const slug = targetUserName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "user";
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-studio-${slug}-${new Date().toISOString().slice(0, 10)}.${format}`;
      link.click();
      URL.revokeObjectURL(url);

      setExportStatus({
        type: "success",
        message: format === "xlsx"
          ? `Backup workbook exported: ${exerciseCount} exercises, ${logCount} logs, ${checkinCount} check-ins, ${noteCount} notes.`
          : `Backup exported: ${exerciseCount} exercises, ${logCount} logs, ${checkinCount} check-ins, ${noteCount} notes.`,
      });
    } catch (error) {
      setExportStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Export failed"),
      });
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!targetUserId) {
      setImportStatus({ type: "error", message: lt("Select a user before importing.") });
      return;
    }

    setImportStatus({ type: "loading", message: lt("Reading backup file...") });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const res = await fetch("/api/admin/backup-studio/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId,
          replaceExisting,
          backup,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error?.message || payload?.error || lt("Import failed");
        setImportStatus({ type: "error", message });
        return;
      }

      const message = payload?.data?.message || "Backup imported successfully.";
      setImportStatus({ type: "success", message });
      await refreshUsers();
    } catch (error) {
      setImportStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Import failed"),
      });
    }
  };

  const handlePurge = async () => {
    if (!targetUserId) {
      setPurgeStatus({ type: "error", message: lt("Select a user before purging.") });
      setShowPurgeConfirm(false);
      return;
    }

    setShowPurgeConfirm(false);
    setPurgeStatus({ type: "loading", message: lt("Purging user backup data...") });

    try {
      const res = await fetch("/api/admin/backup-studio/import", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId,
          confirm: true,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error?.message || payload?.error || lt("Purge failed");
        setPurgeStatus({ type: "error", message });
        return;
      }

      const message = payload?.data?.message || "User data purged successfully.";
      setPurgeStatus({ type: "success", message });
      await refreshUsers();
    } catch (error) {
      setPurgeStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Purge failed"),
      });
    }
  };

  const handleLibraryExport = async () => {
    setLibraryExportStatus({ type: "loading", message: lt("Preparing exercise library export...") });

    try {
      const res = await fetch("/api/exercise-library/studio", {
        credentials: "include",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        const message = payload?.error?.message || payload?.error || lt("Exercise library export failed");
        setLibraryExportStatus({ type: "error", message });
        return;
      }

      const count = Number(res.headers.get("X-Exercise-Count") || 0);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `application-exercise-library-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);

      setLibraryExportStatus({
        type: "success",
        message: `Application Exercise Library exported successfully (${count} exercises).`,
      });
    } catch (error) {
      setLibraryExportStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Exercise library export failed"),
      });
    }
  };

  const handleLibraryImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setLibraryImportStatus({ type: "loading", message: lt("Reading exercise library file...") });

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      const res = await fetch("/api/exercise-library/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          replaceExisting: libraryReplaceExisting,
          backup,
        }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error?.message || payload?.error || lt("Exercise library import failed");
        setLibraryImportStatus({ type: "error", message });
        return;
      }

      const message = payload?.data?.message || payload?.message || "Application Exercise Library imported successfully.";
      setLibraryImportStatus({ type: "success", message });
    } catch (error) {
      setLibraryImportStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Exercise library import failed"),
      });
    }
  };

  const handleLibraryPurge = async () => {
    const confirmed = typeof window !== "undefined"
      ? window.confirm(lt("Purge the shared Application Exercise Library? This clears the deployed library canvas and preserves user history for later restore."))
      : true;

    if (!confirmed) return;

    setLibraryPurgeStatus({ type: "loading", message: lt("Purging Application Exercise Library...") });

    try {
      const res = await fetch("/api/exercise-library/studio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirm: true }),
      });

      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message = payload?.error?.message || payload?.error || lt("Exercise DB purge failed");
        setLibraryPurgeStatus({ type: "error", message });
        return;
      }

      const message = payload?.data?.message || payload?.message || "Application Exercise Library purged successfully.";
      setLibraryPurgeStatus({ type: "success", message });
    } catch (error) {
      setLibraryPurgeStatus({
        type: "error",
        message: error instanceof Error ? error.message : lt("Exercise DB purge failed"),
      });
    }
  };

  return (
    <GlowCard glow="crimson" hoverable={false}>
      <div className="space-y-4">
        <div>
          <h3 className="text-sm uppercase tracking-wider text-crimson-glow">Backup Studio</h3>
          <p className="mt-2 text-xs text-mist-dark">
            The new studio now uses one unified JSON package for exporting and restoring user data plus the Exercise DB.
          </p>
        </div>

        <div className="rounded-xl border border-ink-light/50 bg-ink-mid/20 p-3">
          <label className="mb-1 block text-xs font-medium text-mist-light">Target cultivator</label>

          {allUsers.length > 0 ? (
            <select
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="w-full rounded-lg border border-ink-light bg-ink-dark px-3 py-2 text-sm text-cloud-white outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[0_0_12px_rgba(58,143,143,0.3)]"
            >
              {allUsers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name} ({entry.username})
                </option>
              ))}
            </select>
          ) : (
            <div
              className="rounded-lg px-3 py-2 text-xs"
              style={{
                borderWidth: 1,
                borderStyle: "solid",
                borderColor: "color-mix(in srgb, var(--difficulty-amber) 35%, transparent)",
                background: "color-mix(in srgb, var(--difficulty-amber) 12%, transparent)",
                color: "color-mix(in srgb, var(--difficulty-amber) 80%, var(--cloud-white) 20%)",
              }}
            >
              No user list loaded yet. Refresh the admin page or confirm admin access.
            </div>
          )}

          <div className="mt-3 grid gap-2 text-[11px] text-mist-dark sm:grid-cols-3">
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/60 px-2.5 py-2">
              <span className="block text-[10px] uppercase tracking-[0.08em]">Selected user</span>
              <span className="mt-1 block text-mist-light">{targetUserName}</span>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/60 px-2.5 py-2">
              <span className="block text-[10px] uppercase tracking-[0.08em]">Training logs</span>
              <span className="mt-1 block text-mist-light">{targetUserSessionCount}</span>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/60 px-2.5 py-2">
              <span className="block text-[10px] uppercase tracking-[0.08em]">Check-ins</span>
              <span className="mt-1 block text-mist-light">{targetUserCheckins}</span>
            </div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-mist-light">
            <input
              type="checkbox"
              checked={replaceExisting}
              onChange={(event) => setReplaceExisting(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-light bg-ink-dark accent-jade-glow"
            />
            Replace existing records during import
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-dashed border-ink-light/50 bg-ink-mid/15 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-cloud-white">Included in each package</p>
            <ul className="mt-2 space-y-1 text-xs text-mist-dark">
              {BACKUP_FEATURES.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border border-jade-glow/30 bg-jade-deep/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-jade-light">Restore mode</p>
            <p className="mt-2 text-xs text-mist-light">
              Import can merge into the selected user, or fully replace their existing backup data when the toggle is enabled.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-ink-light/50 bg-ink-mid/15 p-3">
          <div className="flex flex-wrap gap-3">
            <GlowButton variant="jade" size="sm" glow onClick={() => { void handleExport("json"); }}>
              Export Backup JSON
            </GlowButton>
            <GlowButton variant="blue" size="sm" onClick={() => { void handleExport("xlsx"); }}>
              Export Backup XLSX
            </GlowButton>
            <GlowButton variant="gold" size="sm" onClick={() => importInputRef.current?.click()}>
              Import Backup JSON
            </GlowButton>
            <GlowButton variant="crimson" size="sm" onClick={() => setShowPurgeConfirm(true)}>
              Purge User Data
            </GlowButton>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleImport}
              className="hidden"
            />
          </div>

          {exportStatus.type !== "idle" ? (
            <p className={`mt-3 text-xs ${
              exportStatus.type === "success"
                ? "text-jade-light"
                : exportStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {exportStatus.message}
            </p>
          ) : null}

          {importStatus.type !== "idle" ? (
            <p className={`mt-2 whitespace-pre-line text-xs ${
              importStatus.type === "success"
                ? "text-jade-light"
                : importStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {importStatus.message}
            </p>
          ) : null}

          {purgeStatus.type !== "idle" ? (
            <p className={`mt-2 whitespace-pre-line text-xs ${
              purgeStatus.type === "success"
                ? "text-jade-light"
                : purgeStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {purgeStatus.message}
            </p>
          ) : null}
        </div>

        <div className="rounded-xl border border-sky-400/25 bg-sky-500/5 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-sky-100">Application Exercise Library</p>
              <p className="text-xs text-mist-light">
                Manage the shared hidden library owner for deployment and the Exercise DB canvas.
              </p>
              <p className="text-[11px] text-mist-dark">
                Owner: Application Exercise Library (@__app_exercise_library__)
              </p>
            </div>

            <Link
              href="/dashboard/admin/exercises"
              className="inline-flex items-center justify-center rounded-lg border border-ink-light/50 px-3 py-2 text-xs font-medium text-mist-light transition hover:border-sky-300/45 hover:text-cloud-white"
            >
              Open full Exercise DB
            </Link>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-mist-light">
            <input
              type="checkbox"
              checked={libraryReplaceExisting}
              onChange={(event) => setLibraryReplaceExisting(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-ink-light bg-ink-dark accent-sky-300"
            />
            Replace existing library records during import
          </label>

          <div className="mt-3 flex flex-wrap gap-3">
            <GlowButton variant="jade" size="sm" glow onClick={handleLibraryExport}>
              Export Library JSON
            </GlowButton>
            <GlowButton variant="gold" size="sm" onClick={() => libraryImportInputRef.current?.click()}>
              Import Library JSON
            </GlowButton>
            <GlowButton variant="crimson" size="sm" onClick={handleLibraryPurge}>
              Purge Exercise DB
            </GlowButton>
            <input
              ref={libraryImportInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleLibraryImport}
              className="hidden"
            />
          </div>

          {libraryExportStatus.type !== "idle" ? (
            <p className={`mt-3 text-xs ${
              libraryExportStatus.type === "success"
                ? "text-jade-light"
                : libraryExportStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {libraryExportStatus.message}
            </p>
          ) : null}

          {libraryImportStatus.type !== "idle" ? (
            <p className={`mt-2 whitespace-pre-line text-xs ${
              libraryImportStatus.type === "success"
                ? "text-jade-light"
                : libraryImportStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {libraryImportStatus.message}
            </p>
          ) : null}

          {libraryPurgeStatus.type !== "idle" ? (
            <p className={`mt-2 whitespace-pre-line text-xs ${
              libraryPurgeStatus.type === "success"
                ? "text-jade-light"
                : libraryPurgeStatus.type === "error"
                  ? "text-crimson-light"
                  : "text-mist-light"
            }`}>
              {libraryPurgeStatus.message}
            </p>
          ) : null}
        </div>
      </div>

      <GlowModal
        isOpen={showPurgeConfirm}
        onClose={() => setShowPurgeConfirm(false)}
        title="Confirm User Data Purge"
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-light">
            This will permanently delete backup-related user data for <span className="font-semibold text-crimson-light">{targetUserName}</span>, including training logs, check-ins, notes, settings, and profile data. The Exercise DB is preserved.
          </p>
          <p className="text-xs text-mist-dark">
            This action cannot be undone. Please confirm only if you are sure.
          </p>
          <div className="flex gap-3">
            <GlowButton variant="crimson" glow className="flex-1" onClick={handlePurge}>
              Confirm Purge
            </GlowButton>
            <GlowButton variant="ghost" className="flex-1" onClick={() => setShowPurgeConfirm(false)}>
              Cancel
            </GlowButton>
          </div>
        </div>
      </GlowModal>
    </GlowCard>
  );
}
