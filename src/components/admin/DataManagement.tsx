"use client";

import { useState, useRef, useEffect } from "react";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import type * as XLSXTypes from "xlsx";

async function loadXLSX(): Promise<typeof XLSXTypes> {
  return import("xlsx");
}

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

export default function DataManagement() {
  const { user } = useAuth();

  // User selection for targeted operations
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  // Fetch all users for the dropdown
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users", { credentials: "include" });
        const data = await res.json();
        if (data.users) {
          setAllUsers(data.users);
          if (user?.id) setSelectedUserId(user.id);
        }
      } catch {}
    }
    fetchUsers();
  }, [user?.id]);

  // The effective user ID for user-specific operations
  const targetUserId = selectedUserId || user?.id || "";
  const targetUser = allUsers.find(u => u.id === targetUserId);
  const targetUserName = targetUser?.name || user?.name || "Unknown";
  const targetUserSessionCount = targetUser?.sessionCount ?? targetUser?.progressionLogCount ?? 0;

  // Training log state
  const xlsxInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [removeStatus, setRemoveStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [sessionExportStatus, setSessionExportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  // Check-in data management state
  const checkinXlsxInputRef = useRef<HTMLInputElement>(null);
  const [checkinImportStatus, setCheckinImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [checkinExportStatus, setCheckinExportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [removeCheckinStatus, setRemoveCheckinStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [showRemoveCheckinConfirm, setShowRemoveCheckinConfirm] = useState(false);

  // Exercise library import/export state
  const exerciseJsonInputRef = useRef<HTMLInputElement>(null);
  const [exerciseImportStatus, setExerciseImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [exerciseExportStatus, setExerciseExportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });

  // ── Training Log Import ──
  const handleXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUserId) return;

    setImportStatus({ type: "loading", message: "Parsing spreadsheet..." });

    try {
      const XLSX = await loadXLSX();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        setImportStatus({ type: "error", message: "Spreadsheet is empty" });
        return;
      }

      // Build a column key resolver: for each row key, strip whitespace/BOM and lowercase
      const firstRowKeys = Object.keys(rows[0]);
      const resolveKey = (patterns: string[]): string | null => {
        for (const rk of firstRowKeys) {
          const clean = rk.replace(/[\u200B\uFEFF\u00A0]/g, "").trim().toLowerCase();
          for (const p of patterns) {
            if (clean === p.toLowerCase()) return rk;
          }
        }
        // Fallback: partial/substring match
        for (const rk of firstRowKeys) {
          const clean = rk.replace(/[\u200B\uFEFF\u00A0]/g, "").trim().toLowerCase();
          for (const p of patterns) {
            if (clean.includes(p.toLowerCase()) || p.toLowerCase().includes(clean)) return rk;
          }
        }
        return null;
      };

      const dateKey = resolveKey(["date", "day", "datum"]);
      const createdAtKey = resolveKey(["createdat", "created at", "timestamp", "datetime", "date time"]);
      let exerciseKey = resolveKey(["exercise", "name", "technique", "movement"]);
      const exerciseIdKey = resolveKey(["exerciseid", "exercise id", "id"]);
      const levelKey = resolveKey(["level", "lvl"]);
      const w1Key = resolveKey(["w1", "weight1", "weight 1"]);
      const r1Key = resolveKey(["r1", "reps1", "reps 1"]);
      const w2Key = resolveKey(["w2", "weight2", "weight 2"]);
      const r2Key = resolveKey(["r2", "reps2", "reps 2"]);
      const w3Key = resolveKey(["w3", "weight3", "weight 3"]);
      const r3Key = resolveKey(["r3", "reps3", "reps 3"]);
      const holdKey = resolveKey(["t1", "hold1", "holdtime1", "hold time 1", "hold", "hold time", "hold_time", "holdsec", "hold (sec)", "hold(sec)"]);
      const hold2Key = resolveKey(["t2", "hold2", "holdtime2", "hold time 2"]);
      const hold3Key = resolveKey(["t3", "hold3", "holdtime3", "hold time 3"]);
      const modifierKey = resolveKey(["modifier", "mod"]);
      const variantKey = resolveKey(["variant", "variation"]);
      const notesKey = resolveKey(["notes", "note", "comment", "comments"]);

      // Fallback: if exercise column not found, use the first unmatched column
      if (!exerciseKey) {
        const matched = new Set([createdAtKey, dateKey, exerciseIdKey, levelKey, w1Key, r1Key, w2Key, r2Key, w3Key, r3Key, holdKey, hold2Key, hold3Key, modifierKey, variantKey, notesKey].filter(Boolean));
        const unmatched = firstRowKeys.filter((k) => !matched.has(k));
        if (unmatched.length === 1) {
          exerciseKey = unmatched[0];
        }
      }

      if (!exerciseKey) {
        setImportStatus({ type: "error", message: `Cannot find exercise column. Headers found: ${firstRowKeys.join(", ")}` });
        return;
      }

      // Map header names to progression log format
      const logs = rows.map((row) => {
        const createdAtVal = createdAtKey ? row[createdAtKey] : "";
        const dateVal = dateKey ? row[dateKey] : "";
        let createdAt: string | undefined;
        if (createdAtVal) {
          const d = new Date(String(createdAtVal));
          if (!isNaN(d.getTime())) createdAt = d.toISOString();
        } else if (dateVal) {
          const d = new Date(String(dateVal));
          if (!isNaN(d.getTime())) createdAt = d.toISOString();
        }
        return {
          exerciseId: exerciseIdKey ? String(row[exerciseIdKey] ?? "").trim() || undefined : undefined,
          exerciseName: exerciseKey ? String(row[exerciseKey] ?? "") : "",
          level: levelKey ? Number(row[levelKey]) || 1 : 1,
          weight1: w1Key ? (row[w1Key] !== "" ? Number(row[w1Key]) : null) : null,
          reps1: r1Key ? (row[r1Key] !== "" ? Number(row[r1Key]) : null) : null,
          weight2: w2Key ? (row[w2Key] !== "" ? Number(row[w2Key]) : null) : null,
          reps2: r2Key ? (row[r2Key] !== "" ? Number(row[r2Key]) : null) : null,
          weight3: w3Key ? (row[w3Key] !== "" ? Number(row[w3Key]) : null) : null,
          reps3: r3Key ? (row[r3Key] !== "" ? Number(row[r3Key]) : null) : null,
          holdTime: holdKey ? (row[holdKey] !== "" ? Number(row[holdKey]) : null) : null,
          holdTime2: hold2Key ? (row[hold2Key] !== "" ? Number(row[hold2Key]) : null) : null,
          holdTime3: hold3Key ? (row[hold3Key] !== "" ? Number(row[hold3Key]) : null) : null,
          modifier: modifierKey ? String(row[modifierKey] ?? "").trim() || null : null,
          variant: variantKey ? String(row[variantKey] ?? "").trim() || null : null,
          notes: notesKey ? String(row[notesKey] ?? "") || null : null,
          completed: true,
          ...(createdAt ? { createdAt } : {}),
        };
      });

      setImportStatus({ type: "loading", message: `Importing ${logs.length} training log entr${logs.length === 1 ? "y" : "ies"}...` });

      const res = await fetch("/api/progressions/logs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId, logs, replaceExisting: false }),
      });

      const result = await res.json();

      if (res.ok) {
        let msg = `Imported ${result.imported} training log entr${result.imported === 1 ? "y" : "ies"}${result.skipped ? `, ${result.skipped} skipped` : ""}`;
        if (result.createdExercises) {
          msg += `\nCreated ${result.createdExercises} exercise${result.createdExercises === 1 ? "" : "s"}`;
        }
        if (result.createdVariations) {
          msg += `\nCreated ${result.createdVariations} variation${result.createdVariations === 1 ? "" : "s"}`;
        }
        if (result.createdTiers) {
          msg += `\nCreated ${result.createdTiers} tier${result.createdTiers === 1 ? "" : "s"}`;
        }
        if (result.skippedDetails && result.skippedDetails.length > 0) {
          msg += `\n${result.skippedDetails.join("\n")}`;
        }
        setImportStatus({ type: result.skipped && !result.imported ? "error" : "success", message: msg });
      } else {
        setImportStatus({ type: "error", message: result.error || "Import failed" });
      }
    } catch (err: unknown) {
      setImportStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to parse file" });
    } finally {
      if (xlsxInputRef.current) xlsxInputRef.current.value = "";
    }
  };

  // ── Remove All Training Logs ──
  const handleRemoveAll = async () => {
    if (!targetUserId) return;
    setShowRemoveConfirm(false);
    setRemoveStatus({ type: "loading", message: "Removing all training log entries..." });

    try {
      const res = await fetch("/api/progressions/logs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId, logs: [], replaceExisting: true }),
      });

      const result = await res.json();

      if (res.ok) {
        setRemoveStatus({ type: "success", message: "All training log entries removed" });
      } else {
        setRemoveStatus({ type: "error", message: result.error || "Failed to remove training logs" });
      }
    } catch (err: unknown) {
      setRemoveStatus({ type: "error", message: err instanceof Error ? err.message : "An error occurred" });
    }
  };

  // ── Export Training Logs ──
  const handleExportSessions = async () => {
    if (!targetUserId) return;
    setSessionExportStatus({ type: "loading", message: "Fetching training log entries..." });
    try {
      const res = await fetch(`/api/progressions/logs/export?targetUserId=${encodeURIComponent(targetUserId)}`, { credentials: "include" });
      const data = await res.json();
      const logs = data.logs || [];

      if (logs.length === 0) {
        setSessionExportStatus({ type: "error", message: "No training logs to export" });
        return;
      }

      // Build flat rows for XLSX
      const rows = logs.map((log: { exerciseId?: string; exerciseName?: string; level?: number | null; weight1?: number | null; reps1?: number | null; weight2?: number | null; reps2?: number | null; weight3?: number | null; reps3?: number | null; holdTime?: number | null; holdTime2?: number | null; holdTime3?: number | null; modifier?: string | null; variant?: string | null; notes?: string | null; createdAt?: string }) => ({
        CreatedAt: log.createdAt || "",
        Date: log.createdAt ? new Date(log.createdAt).toISOString().split("T")[0] : "",
        ExerciseId: log.exerciseId || "",
        Level: log.level ?? 1,
        Exercise: log.exerciseName || "Unknown",
        W1: log.weight1 ?? "",
        R1: log.reps1 ?? "",
        W2: log.weight2 ?? "",
        R2: log.reps2 ?? "",
        W3: log.weight3 ?? "",
        R3: log.reps3 ?? "",
        T1: log.holdTime ?? "",
        T2: log.holdTime2 ?? "",
        T3: log.holdTime3 ?? "",
        Modifier: log.modifier || "",
        Variant: log.variant || "",
        Notes: log.notes || "",
      }));

      const XLSX = await loadXLSX();
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Training Log");
      XLSX.writeFile(wb, `training-log-${new Date().toISOString().split("T")[0]}.xlsx`);
      setSessionExportStatus({ type: "success", message: `Exported ${rows.length} training log entr${rows.length === 1 ? "y" : "ies"}` });
    } catch (err: unknown) {
      setSessionExportStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Check-In XLSX Import ──
  const handleCheckinXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCheckinImportStatus({ type: "loading", message: "Parsing spreadsheet..." });

    try {
      const XLSX = await loadXLSX();
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        setCheckinImportStatus({ type: "error", message: "Spreadsheet is empty" });
        return;
      }

      // Fetch all users to map names to IDs
      const usersRes = await fetch("/api/users", { credentials: "include" });
      const usersData = await usersRes.json();
      const allUsers: { id: string; name: string; username: string }[] = usersData.users || [];

      // Build a lowercase name -> user map
      const nameToUser = new Map<string, { id: string; name: string }>();
      for (const u of allUsers) {
        nameToUser.set(u.name.toLowerCase(), u);
        nameToUser.set(u.username.toLowerCase(), u);
      }

      setCheckinImportStatus({ type: "loading", message: `Importing ${rows.length} check-in records...` });

      // Detect user columns and weight columns from headers
      const headers = Object.keys(rows[0]);
      // Known non-user headers (case-insensitive)
      const reservedHeaders = new Set(["date", "day", "comments", "comment"]);
      // Weight column pattern: "X.Weight", "X.Wt", and optional unit suffixes like "X.Weight (kg)".
      const weightColRegex = /^(.+?)\.\s*w(?:eight|t)\s*(?:\([^)]*\))?$/i;

      // Identify user columns (checkbox columns) and weight columns
      const userColumns: { header: string; userId: string }[] = [];
      const weightColumns: { header: string; userId: string; nameKey: string }[] = [];

      for (const h of headers) {
        const hLower = h.toLowerCase().trim();
        if (reservedHeaders.has(hLower)) continue;

        const weightMatch = h.match(weightColRegex);
        if (weightMatch) {
          // This is a weight column — try to match the prefix to a user
          const prefix = weightMatch[1].trim().toLowerCase();
          // Try exact match, then first-letter match
          let matchedUser = nameToUser.get(prefix);
          if (!matchedUser) {
            for (const u of allUsers) {
              if (u.name.toLowerCase().startsWith(prefix) || u.name.charAt(0).toLowerCase() === prefix) {
                matchedUser = u;
                break;
              }
            }
          }
          if (matchedUser) {
            weightColumns.push({ header: h, userId: matchedUser.id, nameKey: prefix });
          }
        } else {
          // Try to match as a user name column (checkbox)
          let matchedUser = nameToUser.get(hLower);
          if (!matchedUser) {
            for (const u of allUsers) {
              if (u.name.toLowerCase().startsWith(hLower) || u.name.toLowerCase() === hLower) {
                matchedUser = u;
                break;
              }
            }
          }
          if (matchedUser) {
            userColumns.push({ header: h, userId: matchedUser.id });
          }
        }
      }

      // Helper to get column value case-insensitively
      const getCol = (row: Record<string, unknown>, keys: string[]) => {
        for (const k of keys) {
          for (const rk of Object.keys(row)) {
            if (rk.toLowerCase().trim() === k.toLowerCase()) return row[rk];
          }
        }
        return "";
      };

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        let dateRaw = getCol(row, ["date", "Date"]);
        if (!dateRaw) { skipped++; continue; }

        // Convert Excel serial date numbers to string
        if (typeof dateRaw === "number") {
          const excelEpoch = new Date(1899, 11, 30);
          const d = new Date(excelEpoch.getTime() + dateRaw * 86400000);
          dateRaw = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        } else {
          dateRaw = String(dateRaw).trim();
        }
        // dateRaw is now a string after the above conversion
        const dateStr = dateRaw as string;
        // Try to parse various date formats
        let parsedDate = dateStr;
        if (dateStr.includes("/")) {
          const parts = dateStr.split("/");
          if (parts.length === 3) {
            const [m, d, y] = parts;
            parsedDate = `${y.length === 2 ? "20" + y : y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
          }
        }

        const comments = String(getCol(row, ["comments", "Comments", "comment", "Comment"]) || "");

        const entries: Record<string, { present: boolean; weight: string; comment: string }> = {};

        for (const uc of userColumns) {
          const val = row[uc.header];
          const present = val === true || val === 1 || val === "1" || val === "TRUE" || val === "true" || val === "Yes" || val === "yes" || val === "Y" || val === "y" || val === "✓" || val === "x" || val === "X";
          entries[uc.userId] = { present, weight: "", comment: comments };
        }

        for (const wc of weightColumns) {
          const val = row[wc.header];
          if (entries[wc.userId]) {
            entries[wc.userId].weight = val ? String(val) : "";
          } else {
            entries[wc.userId] = { present: false, weight: val ? String(val) : "", comment: comments };
          }
        }

        if (Object.keys(entries).length === 0) { skipped++; continue; }

        try {
          await fetch("/api/checkins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ date: parsedDate, entries }),
          });
          imported++;
        } catch {
          skipped++;
        }
      }

      const msg = `Imported ${imported} check-in record(s)${skipped ? `, ${skipped} skipped` : ""}`;
      setCheckinImportStatus({ type: "success", message: msg });
    } catch (err: unknown) {
      setCheckinImportStatus({ type: "error", message: err instanceof Error ? err.message : "Failed to parse file" });
    } finally {
      if (checkinXlsxInputRef.current) checkinXlsxInputRef.current.value = "";
    }
  };

  // ── Check-In XLSX Export ──
  const handleCheckinExport = async () => {
    setCheckinExportStatus({ type: "loading", message: "Fetching check-in data..." });
    try {
      const [checkinsRes, usersRes] = await Promise.all([
        fetch("/api/checkins", { credentials: "include" }),
        fetch("/api/users", { credentials: "include" }),
      ]);
      const checkinsData = await checkinsRes.json();
      const usersData = await usersRes.json();
      const allUsers: { id: string; name: string }[] = usersData.users || [];
      const checkins = checkinsData.checkins || [];

      if (checkins.length === 0) {
        setCheckinExportStatus({ type: "error", message: "No check-in data to export" });
        return;
      }

      // Group by date
      const grouped: Record<string, Record<string, { present: boolean; weight?: number; comment?: string }>> = {};
      for (const ci of checkins) {
        const date = ci.date.split("T")[0];
        if (!grouped[date]) grouped[date] = {};
        grouped[date][ci.userId] = {
          present: ci.present,
          weight: ci.weight,
          comment: ci.comment,
        };
      }

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

      const exportRows = sortedDates.map(date => {
        const d = new Date(date + 'T00:00:00');
        const row: Record<string, unknown> = {
          Date: date,
          Day: dayNames[d.getDay()],
        };
        for (const u of allUsers) {
          const entry = grouped[date]?.[u.id];
          row[u.name] = entry?.present ? 1 : 0;
        }
        for (const u of allUsers) {
          const entry = grouped[date]?.[u.id];
          row[`${u.name.charAt(0)}.Weight`] = entry?.weight ?? "";
        }
        // Use first user's comment as shared comment
        const firstComment = allUsers.map(u => grouped[date]?.[u.id]?.comment).find(c => c) || "";
        row["Comments"] = firstComment;
        return row;
      });

      const XLSX = await loadXLSX();
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Check-In Records");
      XLSX.writeFile(wb, `checkin-records-${new Date().toISOString().split("T")[0]}.xlsx`);
      setCheckinExportStatus({ type: "success", message: `Exported ${exportRows.length} record(s)` });
    } catch (err: unknown) {
      setCheckinExportStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Remove All Check-Ins ──
  const handleRemoveAllCheckins = async () => {
    setShowRemoveCheckinConfirm(false);
    setRemoveCheckinStatus({ type: "loading", message: "Removing all check-in records..." });
    try {
      const res = await fetch("/api/checkins", { method: "DELETE", credentials: "include" });
      const result = await res.json();
      if (res.ok) {
        setRemoveCheckinStatus({ type: "success", message: result.message || "All check-in records removed" });
      } else {
        setRemoveCheckinStatus({ type: "error", message: result.error || "Failed to remove check-in records" });
      }
    } catch (err: unknown) {
      setRemoveCheckinStatus({ type: "error", message: err instanceof Error ? err.message : "An error occurred" });
    }
  };

  // ── Exercise Library Export ──
  const handleExerciseLibraryExport = async () => {
    setExerciseExportStatus({ type: "loading", message: "Exporting exercise library..." });
    try {
      const url = `/api/admin/exercise-library/export?targetUserId=${encodeURIComponent(targetUserId)}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) {
        const data = await res.json();
        setExerciseExportStatus({ type: "error", message: data.error || "Export failed" });
        return;
      }
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `exercise-library-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(link.href);
      setExerciseExportStatus({ type: "success", message: "Exercise library exported successfully" });
    } catch (err: unknown) {
      setExerciseExportStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Exercise Library Import ──
  const handleExerciseLibraryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setExerciseImportStatus({ type: "loading", message: "Reading JSON file..." });
    try {
      const text = await file.text();
      let parsed: { version?: number; exercises?: unknown[] };
      try {
        parsed = JSON.parse(text);
      } catch {
        setExerciseImportStatus({ type: "error", message: "Invalid JSON file. Please upload a valid exercise library export." });
        return;
      }

      const exercises = Array.isArray(parsed?.exercises) ? parsed.exercises : (Array.isArray(parsed) ? parsed : null);
      if (!exercises || exercises.length === 0) {
        setExerciseImportStatus({ type: "error", message: "No exercises found in the file. Expected { exercises: [...] } format." });
        return;
      }

      setExerciseImportStatus({ type: "loading", message: `Importing ${exercises.length} exercise(s)...` });

      const res = await fetch("/api/admin/exercise-library/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          targetUserId,
          exercises,
          skipDuplicates: true,
        }),
      });

      const result = await res.json();
      if (res.ok) {
        const detail = result.errors?.length > 0 ? `\n⚠ ${result.errors.slice(0, 3).join("\n")}` : "";
        setExerciseImportStatus({ type: "success", message: result.message + detail });
      } else {
        setExerciseImportStatus({ type: "error", message: result.error || "Import failed" });
      }
    } catch (err: unknown) {
      setExerciseImportStatus({ type: "error", message: err instanceof Error ? err.message : "An error occurred" });
    }
  };

  // ── Download JSON Template ──
  const handleDownloadTemplate = () => {
    const template = {
      version: 1,
      exercises: [
        {
          name: "Bench Press",
          wuxiaName: "Iron Chest Seal",
          difficulty: "Beginner",
          wuxiaDifficulty: "Mortal",
          type: "GYM",
          wuxiaType: "Body Tempering",
          story: "A foundational chest pressing movement performed on a flat bench. Develops raw pushing power and sets the foundation for upper-body cultivation.",
          category: "GYM",
          equipmentType: "Barbell, Bench, Squat Rack",
          bodyweight: false,
          weighted: true,
          rings: false,
          primaryMuscles: "Chest, Triceps",
          secondaryMuscles: "Shoulders",
          tips: JSON.stringify(["Keep your feet flat on the floor", "Retract and depress your scapulae", "Lower the bar to mid-chest with control"]),
          prerequisites: JSON.stringify([]),
          cues: JSON.stringify(["Drive your feet into the floor", "Squeeze the bar apart", "Push the ceiling away"]),
          commonMistakes: JSON.stringify([
            { mistake: "Bouncing the bar off the chest", correction: "Lower under control and pause briefly at the bottom" },
            { mistake: "Flaring elbows excessively", correction: "Keep elbows at ~45° from your torso" }
          ]),
          breathing: "Inhale on the way down, exhale forcefully as you press up.",
          safetyConsiderations: JSON.stringify(["Always use a spotter or safety bars", "Warm up with lighter weight before working sets"]),
          competitionStandards: JSON.stringify({}),
          assignedDays: "",
          tiers: [
            {
              level: 1,
              name: "Foundation Press",
              wuxiaName: "Mortal Imprint",
              difficulty: "Beginner",
              description: "Press the bar for 3 sets of 8–12 reps with controlled form.",
              targetReps: 10,
              targetRepsText: "8-12",
              targetHold: null
            },
            {
              level: 2,
              name: "Intermediate Press",
              wuxiaName: "Iron Body Seal",
              difficulty: "Intermediate",
              description: "Press the bar for 5 sets of 5 reps at heavier load.",
              targetReps: 5,
              targetRepsText: "5",
              targetHold: null
            }
          ],
          variations: [
            {
              name: "Incline Bench Press",
              wuxiaName: "Ascending Heaven Fist",
              difficulty: "Intermediate",
              description: "Performed on a 30–45° incline to emphasise the upper chest."
            },
            {
              name: "Close-Grip Bench Press",
              wuxiaName: "Narrow Mountain Palm",
              difficulty: "Intermediate",
              description: "Hands shoulder-width apart to shift emphasis to the triceps."
            }
          ],
          modifiers: [
            {
              type: "weighted",
              available: true,
              difficultyMod: 0.5,
              notes: "Increase load by 2.5–5 kg per progression",
              method: "Barbell loading",
              difficultyIncrease: "+1 tier per 10% bodyweight added"
            }
          ]
        }
      ]
    };

    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "exercise-library-template.json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <>
      <GlowCard glow="crimson" hoverable={false}>
        <h3 className="text-sm text-crimson-glow uppercase tracking-wider mb-4">
          Data Management
        </h3>

        {/* ── Target User Selector ── */}
        {allUsers.length > 0 && (
          <div className="mb-4 pb-4 border-b border-ink-light/50">
            <label className="text-xs text-mist-light font-medium mb-1 block">Target Cultivator</label>
            <p className="text-[10px] text-mist-dark mb-2">
              Select which cultivator&apos;s training log to import into, export from, or clear.
            </p>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-sm text-cloud-white outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[0_0_12px_rgba(58,143,143,0.3)]"
            >
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.username}) - {u.sessionCount ?? u.progressionLogCount ?? 0} log entries{u.id === user?.id ? " - You" : ""}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-mist-dark mt-2">
              Current selection: <span className="text-mist-light">{targetUserName}</span> with <span className="text-jade-light">{targetUserSessionCount}</span> recorded progression log(s).
            </p>
          </div>
        )}

        {/* ── Training Log Section ── */}
        <p className="text-xs text-mist-light font-medium mb-2">Training Log {targetUserId !== user?.id && <span className="text-gold">— {targetUserName}</span>}</p>
        <p className="text-xs text-mist-dark mb-3">
          Import or export the current Training Log format used on the workout page. Import appends entries to the selected user&apos;s log, export downloads the same log structure, and remove clears all saved log entries for that user.
          Expected columns: <span className="text-mist-light font-mono">CreatedAt, Date, ExerciseId, Level, Exercise, W1, R1, W2, R2, W3, R3, T1, T2, T3, Modifier, Variant, Notes</span>
        </p>
        <div className="space-y-3">
          {/* Import XLSX */}
          <div className="flex items-center gap-3">
            <GlowButton
              variant="gold"
              size="sm"
              onClick={() => xlsxInputRef.current?.click()}
              disabled={importStatus.type === "loading"}
            >
              {importStatus.type === "loading" ? "Importing..." : "📥 Import Training Log XLSX"}
            </GlowButton>
            <input
              ref={xlsxInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleXlsxImport}
              className="hidden"
            />
            {importStatus.type !== "idle" && (
              <p className={`text-xs whitespace-pre-line ${
                importStatus.type === "success" ? "text-jade-glow" :
                importStatus.type === "error" ? "text-crimson-light" :
                "text-mist-light"
              }`}>
                {importStatus.message}
              </p>
            )}
          </div>

          {/* Export Training Logs */}
          <div className="flex items-center gap-3">
            <GlowButton
              variant="ghost"
              size="sm"
              onClick={handleExportSessions}
              disabled={sessionExportStatus.type === "loading"}
            >
              {sessionExportStatus.type === "loading" ? "Exporting..." : "📤 Export Training Log XLSX"}
            </GlowButton>
            {sessionExportStatus.type !== "idle" && (
              <p className={`text-xs ${
                sessionExportStatus.type === "success" ? "text-jade-glow" :
                sessionExportStatus.type === "error" ? "text-crimson-light" :
                "text-mist-light"
              }`}>
                {sessionExportStatus.message}
              </p>
            )}
          </div>

          {/* Remove All Training Logs */}
          <div className="flex items-center gap-3 pt-2 border-t border-ink-light/30">
            <GlowButton
              variant="crimson"
              size="sm"
              onClick={() => setShowRemoveConfirm(true)}
              disabled={removeStatus.type === "loading"}
            >
              {removeStatus.type === "loading" ? "Removing..." : "🗑 Remove All Training Logs"}
            </GlowButton>
            {removeStatus.type !== "idle" && (
              <p className={`text-xs ${
                removeStatus.type === "success" ? "text-jade-glow" :
                removeStatus.type === "error" ? "text-crimson-light" :
                "text-mist-light"
              }`}>
                {removeStatus.message}
              </p>
            )}
          </div>
        </div>

        {/* ── Exercise Library Import / Export Section ── */}
        <div className="mt-6 pt-4 border-t border-ink-light/50">
          <p className="text-xs text-mist-light font-medium mb-2">
            Exercise Library {targetUserId !== user?.id && <span className="text-gold">— {targetUserName}</span>}
          </p>
          <p className="text-xs text-mist-dark mb-3">
            Import or export the Exercise Library as a JSON file. Exporting downloads all exercises (with tiers, variations, and modifiers) for the selected cultivator.
            Importing adds exercises from a JSON file — duplicate names are skipped automatically. Download the template below to see the expected format with a Bench Press example.
          </p>
          <div className="space-y-3">
            {/* Template Download */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={handleDownloadTemplate}
              >
                📄 Download JSON Template
              </GlowButton>
              <p className="text-[10px] text-mist-dark">Includes a Bench Press example to guide the format</p>
            </div>

            {/* Import JSON */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="gold"
                size="sm"
                onClick={() => exerciseJsonInputRef.current?.click()}
                disabled={exerciseImportStatus.type === "loading"}
              >
                {exerciseImportStatus.type === "loading" ? "Importing..." : "📥 Import Exercise Library JSON"}
              </GlowButton>
              <input
                ref={exerciseJsonInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleExerciseLibraryImport}
                className="hidden"
              />
              {exerciseImportStatus.type !== "idle" && (
                <p className={`text-xs whitespace-pre-line ${
                  exerciseImportStatus.type === "success" ? "text-jade-glow" :
                  exerciseImportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {exerciseImportStatus.message}
                </p>
              )}
            </div>

            {/* Export JSON */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={handleExerciseLibraryExport}
                disabled={exerciseExportStatus.type === "loading"}
              >
                {exerciseExportStatus.type === "loading" ? "Exporting..." : "📤 Export Exercise Library JSON"}
              </GlowButton>
              {exerciseExportStatus.type !== "idle" && (
                <p className={`text-xs ${
                  exerciseExportStatus.type === "success" ? "text-jade-glow" :
                  exerciseExportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {exerciseExportStatus.message}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Sect Register (Check-In Records) Section ── */}
        <div className="mt-6 pt-4 border-t border-ink-light/50">
          <p className="text-xs text-mist-light font-medium mb-2">Sect Register (Check-In Records)</p>
          <p className="text-xs text-mist-dark mb-3">
            Import and export check-in attendance data. Expected XLSX columns:{" "}
            <span className="text-mist-light font-mono">Date, Day, [UserName], [UserName], X.Weight, Y.Weight, Comments</span>.
            User columns contain checkbox values (1/0). Names are matched to registered cultivators.
          </p>
          <div className="space-y-3">
            {/* Import Check-In XLSX */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="gold"
                size="sm"
                onClick={() => checkinXlsxInputRef.current?.click()}
                disabled={checkinImportStatus.type === "loading"}
              >
                {checkinImportStatus.type === "loading" ? "Importing..." : "📥 Import Check-In XLSX"}
              </GlowButton>
              <input
                ref={checkinXlsxInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleCheckinXlsxImport}
                className="hidden"
              />
              {checkinImportStatus.type !== "idle" && (
                <p className={`text-xs ${
                  checkinImportStatus.type === "success" ? "text-jade-glow" :
                  checkinImportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {checkinImportStatus.message}
                </p>
              )}
            </div>

            {/* Export Check-In Records */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={handleCheckinExport}
                disabled={checkinExportStatus.type === "loading"}
              >
                {checkinExportStatus.type === "loading" ? "Exporting..." : "📤 Export Check-In Records"}
              </GlowButton>
              {checkinExportStatus.type !== "idle" && (
                <p className={`text-xs ${
                  checkinExportStatus.type === "success" ? "text-jade-glow" :
                  checkinExportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {checkinExportStatus.message}
                </p>
              )}
            </div>

            {/* Remove All Check-In Records */}
            <div className="flex items-center gap-3 pt-2 border-t border-ink-light/30">
              <GlowButton
                variant="crimson"
                size="sm"
                onClick={() => setShowRemoveCheckinConfirm(true)}
                disabled={removeCheckinStatus.type === "loading"}
              >
                {removeCheckinStatus.type === "loading" ? "Removing..." : "🗑 Remove All Check-Ins"}
              </GlowButton>
              {removeCheckinStatus.type !== "idle" && (
                <p className={`text-xs ${
                  removeCheckinStatus.type === "success" ? "text-jade-glow" :
                  removeCheckinStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {removeCheckinStatus.message}
                </p>
              )}
            </div>
          </div>
        </div>

      </GlowCard>

      {/* Remove All Training Logs Confirmation Modal */}
      <GlowModal
        isOpen={showRemoveConfirm}
        onClose={() => setShowRemoveConfirm(false)}
        title="Confirm Purge"
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-light">
            This will permanently delete <span className="text-crimson-light font-semibold">all</span> training log entries for <span className="text-crimson-light font-semibold">{targetUserName}</span>. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <GlowButton
              variant="crimson"
              glow
              className="flex-1"
              onClick={handleRemoveAll}
            >
              Confirm Remove All
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="flex-1"
              onClick={() => setShowRemoveConfirm(false)}
            >
              Cancel
            </GlowButton>
          </div>
        </div>
      </GlowModal>

      {/* Remove All Check-Ins Confirmation Modal */}
      <GlowModal
        isOpen={showRemoveCheckinConfirm}
        onClose={() => setShowRemoveCheckinConfirm(false)}
        title="Confirm Check-In Purge"
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-light">
            This will permanently delete <span className="text-crimson-light font-semibold">all</span> check-in records from the Sect Register. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <GlowButton
              variant="crimson"
              glow
              className="flex-1"
              onClick={handleRemoveAllCheckins}
            >
              Confirm Remove All
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="flex-1"
              onClick={() => setShowRemoveCheckinConfirm(false)}
            >
              Cancel
            </GlowButton>
          </div>
        </div>
      </GlowModal>

    </>
  );
}
