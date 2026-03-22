"use client";

import { useState, useRef, useEffect } from "react";
import GlowButton from "@/components/ui/GlowButton";
import GlowCard from "@/components/ui/GlowCard";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import * as XLSX from "xlsx";

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
        const res = await fetch("/api/users");
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

  // Technique data management state
  const techniqueFileInputRef = useRef<HTMLInputElement>(null);
  const [showTechniqueImportModal, setShowTechniqueImportModal] = useState(false);
  const [techniqueImportText, setTechniqueImportText] = useState("");
  const [techniqueImportError, setTechniqueImportError] = useState("");
  const [techniqueImportStatus, setTechniqueImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [techniqueExportStatus, setTechniqueExportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [removeTechniqueStatus, setRemoveTechniqueStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [showRemoveTechniqueConfirm, setShowRemoveTechniqueConfirm] = useState(false);

  // Check-in data management state
  const checkinXlsxInputRef = useRef<HTMLInputElement>(null);
  const [checkinImportStatus, setCheckinImportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [checkinExportStatus, setCheckinExportStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [removeCheckinStatus, setRemoveCheckinStatus] = useState<{ type: "idle" | "loading" | "success" | "error"; message: string }>({ type: "idle", message: "" });
  const [showRemoveCheckinConfirm, setShowRemoveCheckinConfirm] = useState(false);

  // ── Training Log Import ──
  const handleXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !targetUserId) return;

    setImportStatus({ type: "loading", message: "Parsing spreadsheet..." });

    try {
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
      let exerciseKey = resolveKey(["exercise", "name", "technique", "movement"]);
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
        const matched = new Set([dateKey, levelKey, w1Key, r1Key, w2Key, r2Key, w3Key, r3Key, holdKey, hold2Key, hold3Key, modifierKey, variantKey, notesKey].filter(Boolean));
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
        const dateVal = dateKey ? row[dateKey] : "";
        let createdAt: string | undefined;
        if (dateVal) {
          const d = new Date(String(dateVal));
          if (!isNaN(d.getTime())) createdAt = d.toISOString();
        }
        return {
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
        body: JSON.stringify({ userId: targetUserId, logs, replaceExisting: false }),
      });

      const result = await res.json();

      if (res.ok) {
        let msg = `Imported ${result.imported} training log entr${result.imported === 1 ? "y" : "ies"}${result.skipped ? `, ${result.skipped} skipped` : ""}`;
        if (result.errors && result.errors.length > 0) {
          msg += `\n${result.errors.join("\n")}`;
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
        body: JSON.stringify({ userId: targetUserId, logs: [], replaceExisting: true }),
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
      const res = await fetch(`/api/progressions/logs/export?userId=${targetUserId}`);
      const data = await res.json();
      const logs = data.logs || [];

      if (logs.length === 0) {
        setSessionExportStatus({ type: "error", message: "No training logs to export" });
        return;
      }

      // Build flat rows for XLSX
      const rows = logs.map((log: { exerciseName?: string; level?: number | null; weight1?: number | null; reps1?: number | null; weight2?: number | null; reps2?: number | null; weight3?: number | null; reps3?: number | null; holdTime?: number | null; holdTime2?: number | null; holdTime3?: number | null; modifier?: string | null; variant?: string | null; notes?: string | null; createdAt?: string }) => ({
        Date: log.createdAt ? new Date(log.createdAt).toISOString().split("T")[0] : "",
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

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Training Log");
      XLSX.writeFile(wb, `training-log-${new Date().toISOString().split("T")[0]}.xlsx`);
      setSessionExportStatus({ type: "success", message: `Exported ${rows.length} training log entr${rows.length === 1 ? "y" : "ies"}` });
    } catch (err: unknown) {
      setSessionExportStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Technique Import ──
  const handleTechniqueImport = async () => {
    if (!targetUserId) {
      setTechniqueImportError("Please select a target user before importing techniques.");
      setTechniqueImportStatus({ type: "error", message: "Target user is required" });
      return;
    }

    setTechniqueImportError("");
    setTechniqueImportStatus({ type: "loading", message: "Importing..." });
    try {
      const data = JSON.parse(techniqueImportText);
      const exercises = Array.isArray(data)
        ? data
        : (data && Array.isArray(data.exercises) ? data.exercises : [data]);

      if (!Array.isArray(exercises) || exercises.length === 0) {
        setTechniqueImportError("Invalid format: expected an array of techniques.");
        setTechniqueImportStatus({ type: "error", message: "Invalid format" });
        return;
      }

      // Import into exercise library so techniques are visible in Technique Scroll.
      const libraryPayload = exercises.map((ex: Record<string, unknown>) => {
        const category = Array.isArray(ex.category)
          ? ex.category.map((v) => String(v).trim()).filter(Boolean).join(", ")
          : String(ex.category || ex.targetGroup || "").trim();
        const tiers = (ex.progressions || ex.tiers) as { difficulty?: string; wuxiaDifficulty?: string }[] | undefined;
        const lastTier = tiers?.length ? tiers[tiers.length - 1] : undefined;
        const maxDifficulty =
          lastTier?.wuxiaDifficulty ||
          lastTier?.difficulty ||
          (ex.wuxiaDifficulty as string) ||
          (ex.difficulty as string) ||
          "Mortal";

        return {
          name: ex.name,
          wuxiaName: ex.wuxiaName || "",
          difficulty: maxDifficulty,
          type: (ex.wuxiaType as string) || (ex.type as string) || "Unified Realm",
          story: ex.story || "",
          targetGroup: category,
        };
      });

      const libRes = await fetch("/api/exercises/import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-role": user?.role || "",
        },
        body: JSON.stringify({ exercises: libraryPayload }),
      });

      const libResult = await libRes.json();
      if (!libRes.ok) {
        setTechniqueImportError(libResult.error || "Library import failed");
        setTechniqueImportStatus({ type: "error", message: libResult.error || "Library import failed" });
        return;
      }

      const res = await fetch("/api/progressions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId, exercises }),
      });

      if (res.ok) {
        const result = await res.json();
        const imported = libResult.imported ?? 0;
        const skipped = (libResult.skipped ?? 0) + (result.skipped ?? 0);
        let msg = `Imported ${imported} technique(s)`;
        if (skipped > 0) msg += ` (${skipped > imported ? Math.ceil(skipped / 2) : skipped} duplicate(s) skipped)`;
        if (result.errors?.length) msg += `, ${result.errors.length} warning(s)`;
        setTechniqueImportStatus({ type: "success", message: msg });
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("exercises-library-updated"));
          window.dispatchEvent(new Event("progression-exercises-updated"));
          localStorage.setItem("exercises-library-updated-at", String(Date.now()));
        }
        setShowTechniqueImportModal(false);
        setTechniqueImportText("");
      } else {
        const err = await res.json();
        const details = Array.isArray(err.details) && err.details.length > 0
          ? `\n${err.details.join("\n")}`
          : "";
        const msg = `${err.error || "Progression import failed (library import succeeded)"}${details}`;
        setTechniqueImportError(msg);
        setTechniqueImportStatus({ type: "error", message: msg });
      }
    } catch {
      setTechniqueImportError("Invalid JSON format. Please check your scroll.");
      setTechniqueImportStatus({ type: "error", message: "Invalid JSON format" });
    }
  };

  const handleTechniqueFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setTechniqueImportText(ev.target?.result as string);
    };
    reader.readAsText(file);
    if (techniqueFileInputRef.current) techniqueFileInputRef.current.value = "";
  };

  // ── Technique Export ──
  const handleTechniqueExport = async () => {
    setTechniqueExportStatus({ type: "loading", message: "Fetching techniques..." });
    try {
      const res = await fetch("/api/exercises");
      const data = await res.json();
      const exercises = data.exercises || [];

      if (exercises.length === 0) {
        setTechniqueExportStatus({ type: "error", message: "No techniques to export" });
        return;
      }

      const exportData = exercises.map((ex: { name: string; wuxiaName?: string | null; difficulty: string; type: string; story?: string | null; targetGroup?: string | null }) => ({
        name: ex.name,
        ...(ex.wuxiaName ? { wuxiaName: ex.wuxiaName } : {}),
        difficulty: ex.difficulty,
        type: ex.type,
        ...(ex.story ? { story: ex.story } : {}),
        ...(ex.targetGroup ? { targetGroup: ex.targetGroup } : {}),
      }));

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `techniques-library-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setTechniqueExportStatus({ type: "success", message: `Exported ${exercises.length} technique(s)` });
    } catch (err: unknown) {
      setTechniqueExportStatus({ type: "error", message: err instanceof Error ? err.message : "Export failed" });
    }
  };

  // ── Remove All Techniques ──
  const handleRemoveAllTechniques = async () => {
    setShowRemoveTechniqueConfirm(false);
    setRemoveTechniqueStatus({ type: "loading", message: "Removing all techniques..." });
    try {
      const res = await fetch("/api/exercises", {
        method: "DELETE",
        headers: {
          "x-user-role": user?.role || "",
        },
      });
      const result = await res.json();
      if (res.ok) {
        setRemoveTechniqueStatus({ type: "success", message: result.message || "All techniques removed" });
      } else {
        setRemoveTechniqueStatus({ type: "error", message: result.error || "Failed to remove techniques" });
      }
    } catch (err: unknown) {
      setRemoveTechniqueStatus({ type: "error", message: err instanceof Error ? err.message : "An error occurred" });
    }
  };

  // ── Check-In XLSX Import ──
  const handleCheckinXlsxImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCheckinImportStatus({ type: "loading", message: "Parsing spreadsheet..." });

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      if (rows.length === 0) {
        setCheckinImportStatus({ type: "error", message: "Spreadsheet is empty" });
        return;
      }

      // Fetch all users to map names to IDs
      const usersRes = await fetch("/api/users");
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
      // Weight column pattern: "X.Weight" or "X.Wt" or specific like "A.Weight"
      const weightColRegex = /^(.+?)\.\s*w(?:eight|t)$/i;

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
        fetch("/api/checkins"),
        fetch("/api/users"),
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
      const res = await fetch("/api/checkins", { method: "DELETE" });
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
          Expected columns: <span className="text-mist-light font-mono">Date, Level, Exercise, W1, R1, W2, R2, W3, R3, T1, T2, T3, Modifier, Variant, Notes</span>
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

        {/* ── Technique Scroll Section ── */}
        <div className="mt-6 pt-4 border-t border-ink-light/50">
          <p className="text-xs text-mist-light font-medium mb-2">Technique Scroll</p>
          <p className="text-xs text-mist-dark mb-3">
            Import techniques from a JSON file, export your technique library, or purge all techniques.
          </p>
          <div className="space-y-3">
            {/* Import Techniques */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="gold"
                size="sm"
                onClick={() => setShowTechniqueImportModal(true)}
                disabled={techniqueImportStatus.type === "loading"}
              >
                {techniqueImportStatus.type === "loading" ? "Importing..." : "📥 Import Techniques"}
              </GlowButton>
              {techniqueImportStatus.type !== "idle" && (
                <p className={`text-xs ${
                  techniqueImportStatus.type === "success" ? "text-jade-glow" :
                  techniqueImportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {techniqueImportStatus.message}
                </p>
              )}
            </div>

            {/* Export Techniques */}
            <div className="flex items-center gap-3">
              <GlowButton
                variant="ghost"
                size="sm"
                onClick={handleTechniqueExport}
                disabled={techniqueExportStatus.type === "loading"}
              >
                {techniqueExportStatus.type === "loading" ? "Exporting..." : "📤 Export Techniques"}
              </GlowButton>
              {techniqueExportStatus.type !== "idle" && (
                <p className={`text-xs ${
                  techniqueExportStatus.type === "success" ? "text-jade-glow" :
                  techniqueExportStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {techniqueExportStatus.message}
                </p>
              )}
            </div>

            {/* Remove All Techniques */}
            <div className="flex items-center gap-3 pt-2 border-t border-ink-light/30">
              <GlowButton
                variant="crimson"
                size="sm"
                onClick={() => setShowRemoveTechniqueConfirm(true)}
                disabled={removeTechniqueStatus.type === "loading"}
              >
                {removeTechniqueStatus.type === "loading" ? "Removing..." : "🗑 Remove All Techniques"}
              </GlowButton>
              {removeTechniqueStatus.type !== "idle" && (
                <p className={`text-xs ${
                  removeTechniqueStatus.type === "success" ? "text-jade-glow" :
                  removeTechniqueStatus.type === "error" ? "text-crimson-light" :
                  "text-mist-light"
                }`}>
                  {removeTechniqueStatus.message}
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

      {/* Import Technique Scroll Modal */}
      <GlowModal
        isOpen={showTechniqueImportModal}
        onClose={() => {
          setShowTechniqueImportModal(false);
          setTechniqueImportError("");
        }}
        title="Import Technique Scroll"
      >
        <div className="space-y-3">
          <p className="text-xs text-mist-mid">
            Upload a JSON file or paste JSON data. Expected format:
          </p>
          <pre className="text-[10px] text-mist-dark bg-ink-dark p-3 rounded-lg overflow-x-auto">
            {`[{
  "name": "Conventional Name",
  "wuxiaName": "Wuxia Technique Name",
  "difficulty": "Core Formation",
  "type": "Upper Heaven",
  "category": "Push",
  "story": "Optional description...",
  "primaryMuscles": ["Chest", "Triceps"],
  "secondaryMuscles": ["Shoulders"],
  "tips": ["Tip 1", "Tip 2"],
  "equipment": {
    "type": "bodyweight",
    "bodyweight": true
  },
  "tiers": [{
    "level": 1,
    "name": "Tier Name",
    "wuxiaName": "Wuxia Tier Name",
    "difficulty": "Mortal",
    "description": "Tier description",
    "targetReps": 10,
    "targetHold": 30
  }],
  "variations": [{
    "name": "Variation Name",
    "description": "Description"
  }],
  "modifiers": [{
    "type": "Ring",
    "available": true,
    "notes": "Extra difficulty"
  }]
}]`}
          </pre>
          <p className="text-[10px] text-mist-dark">
            <span className="text-mist-light">Required:</span> name, category.{" "}
            <span className="text-mist-light">Optional:</span> wuxiaName, difficulty, type, story, primaryMuscles, secondaryMuscles, tips, equipment, tiers, variations, modifiers.
          </p>

          <div className="flex gap-2">
            <GlowButton
              variant="ghost"
              size="sm"
              onClick={() => techniqueFileInputRef.current?.click()}
            >
              📁 Choose File
            </GlowButton>
            <input
              ref={techniqueFileInputRef}
              type="file"
              accept=".json"
              onChange={handleTechniqueFileUpload}
              className="hidden"
            />
          </div>

          <textarea
            placeholder="Paste JSON here..."
            value={techniqueImportText}
            onChange={(e) => setTechniqueImportText(e.target.value)}
            rows={8}
            className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-xs text-cloud-white font-mono placeholder:text-mist-dark outline-none transition-all duration-300 resize-none focus:border-gold focus:shadow-[0_0_12px_rgba(232,200,74,0.3)]"
          />

          {techniqueImportError && (
            <p className="text-xs text-crimson-light">{techniqueImportError}</p>
          )}

          <GlowButton variant="gold" glow className="w-full" onClick={handleTechniqueImport}>
            📥 Import Scroll
          </GlowButton>
        </div>
      </GlowModal>

      {/* Remove All Techniques Confirmation Modal */}
      <GlowModal
        isOpen={showRemoveTechniqueConfirm}
        onClose={() => setShowRemoveTechniqueConfirm(false)}
        title="Confirm Technique Purge"
      >
        <div className="space-y-4">
          <p className="text-sm text-mist-light">
            This will purge <span className="text-crimson-light font-semibold">all</span> visible techniques from the Technique Scroll library. This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <GlowButton
              variant="crimson"
              glow
              className="flex-1"
              onClick={handleRemoveAllTechniques}
            >
              Confirm Remove All
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="flex-1"
              onClick={() => setShowRemoveTechniqueConfirm(false)}
            >
              Cancel
            </GlowButton>
          </div>
        </div>
      </GlowModal>
    </>
  );
}
