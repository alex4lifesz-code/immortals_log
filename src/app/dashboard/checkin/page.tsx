"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useRouter } from "next/navigation";
import { formatDateLocal as formatDateLocalForZone, formatDateWithPreference } from "@/lib/constants";
import { syncWeightFromLatestCheckin } from "@/lib/user-physique";
import { api } from "@/lib/api-client";

interface User {
  id: string;
  name: string;
  username: string;
}

interface CheckInRow {
  date: string;
  entries: Record<
    string,
    { present: boolean; weight: string; comment: string }
  >;
}

interface DayNote {
  date: string;
  note: string;
  pinned?: boolean;
  userName?: string;
}

interface MemberStats {
  totalCheckIns: number;
  totalDays: number;
  consistencyPercent: number;
  avgWeight: number | null;
  latestWeight: number | null;
  weightChange: number | null;
  lastCheckInDate: string | null;
}

function formatDateLocal(date: Date): string {
  return formatDateLocalForZone(date);
}

function formatDateDisplay(
  dateStr: string,
  dateFormat: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy",
  timeZone?: string,
): string {
  return formatDateWithPreference(dateStr, dateFormat, timeZone);
}

function getCompactUserLabel(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 1) {
    return words[0].slice(0, 3);
  }

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");

  return initials || trimmed.slice(0, 3).toUpperCase();
}

export default function CheckInPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const router = useRouter();
  const isAdmin = user?.role === "admin";
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const [users, setUsers] = useState<User[]>([]);
  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [editingNote, setEditingNote] = useState<{ date: string; note: string } | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [preEditSnapshot, setPreEditSnapshot] = useState<CheckInRow[]>([]);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("checkin-sort-order");
      if (saved === "oldest" || saved === "newest") return saved;
    }
    return "newest";
  });

  // Weight prompt state
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightPromptValue, setWeightPromptValue] = useState("");
  const weightPromptDismissedRef = useRef(false);
  const [deletingRowDate, setDeletingRowDate] = useState<string | null>(null);
  const dayNotesStorageKey = useMemo(
    () => (user?.id ? `cultivation-day-notes:${user.id}` : "cultivation-day-notes"),
    [user?.id]
  );

  useEffect(() => {
    if (user && !isAdmin) {
      router.replace("/dashboard/check-in");
    }
  }, [isAdmin, router, user]);

  const broadcastNotesUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("checkin-notes-updated"));
    localStorage.setItem("checkin-notes-updated-at", String(Date.now()));
  }, []);



  const handleDeleteRow = useCallback(async (date: string) => {
    try {
      await api.delete("/api/checkins", { date });
      setRows(prev => prev.filter(r => r.date !== date));
      setDeletingRowDate(null);
      broadcastNotesUpdated();
    } catch (err) {
      console.error("Failed to delete row:", err);
    }
  }, [broadcastNotesUpdated]);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, checkinsData] = await Promise.all([
        api.get<{ users: User[] }>("/api/users/public"),
        api.get<{ checkins: Array<{ date: string; userId: string; present: boolean; weight?: number; comment?: string }> }>("/api/checkins"),
      ]);
      setUsers(usersData.users || []);

      // Group check-ins by date
      const grouped: Record<string, CheckInRow["entries"]> = {};
      for (const ci of checkinsData.checkins || []) {
        const date = ci.date.split("T")[0];
        if (!grouped[date]) grouped[date] = {};
        grouped[date][ci.userId] = {
          present: ci.present,
          weight: ci.weight?.toString() || "",
          comment: ci.comment || "",
        };
      }

      const sortedRows = Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, entries]) => ({ date, entries }));

      setRows(sortedRows);
    } catch (err) {
      console.error("Failed to fetch check-in data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Show weight prompt on page load if user hasn't logged weight today
  useEffect(() => {
    if (loading || !user || rows.length === 0 || weightPromptDismissedRef.current) return;
    try {
      const hiddenUntil = localStorage.getItem("weight-prompt-hidden-until");
      if (hiddenUntil && Date.now() < Number(hiddenUntil)) return;
    } catch { /* ignore */ }
    const today = formatDateLocal(new Date());
    const todayRow = rows.find(r => r.date === today);
    const userEntry = todayRow?.entries[user.id];
    if (userEntry?.present && !userEntry?.weight) {
      setShowWeightPrompt(true);
    }
  }, [loading, user, rows]);

  const handleWeightPromptSubmit = async () => {
    if (!user || !weightPromptValue) return;
    const today = formatDateLocal(new Date());
    // Update local row state
    setRows(prev => prev.map(row => {
      if (row.date !== today) return row;
      const entry = row.entries[user.id] || { present: false, weight: "", comment: "" };
      return { ...row, entries: { ...row.entries, [user.id]: { ...entry, weight: weightPromptValue } } };
    }));
    // Save to API
    const todayRow = rows.find(r => r.date === today);
    const entry = todayRow?.entries[user.id] || { present: false, weight: "", comment: "" };
    const updatedEntry = { ...entry, weight: weightPromptValue };
    try {
      await api.post("/api/checkins", { date: today, entries: { [user.id]: updatedEntry } });
      // Auto-sync weight if sync toggle is enabled
      syncWeightFromLatestCheckin(user.id);
    } catch (err) {
      console.error("Failed to save weight:", err);
    }
    setShowWeightPrompt(false);
    setWeightPromptValue("");
  };

  // Load day notes from per-user localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(dayNotesStorageKey);
      if (saved) setDayNotes(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [dayNotesStorageKey]);

  const saveDayNote = (date: string, note: string) => {
    setDayNotes(prev => {
      const filtered = prev.filter(n => n.date !== date);
      const updated = note.trim() ? [...filtered, { date, note: note.trim(), userName: user?.name || 'Unknown', pinned: prev.find(n => n.date === date)?.pinned || false }] : filtered;
      updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
      localStorage.setItem(dayNotesStorageKey, JSON.stringify(updated));
      return updated;
    });
    setEditingNote(null);
  };

  const toggleDayNotePin = (date: string) => {
    setDayNotes(prev => {
      const updated = prev.map(n => n.date === date ? { ...n, pinned: !n.pinned } : n);
      updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
      localStorage.setItem(dayNotesStorageKey, JSON.stringify(updated));
      return updated;
    });
  };

  const getDayNote = (date: string): string => {
    return dayNotes.find(n => n.date === date)?.note || "";
  };

  // Auto-generate today's date on first load
  useEffect(() => {
    const today = formatDateLocal(new Date());
    const hasToday = rows.some((r) => r.date === today);
    if (!loading && !hasToday && rows.length === 0) {
      setRows([{ date: today, entries: {} }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs only on initial load
  }, [loading]);

  const addTodayRow = () => {
    const today = formatDateLocal(new Date());
    if (rows.some((r) => r.date === today)) return;
    setRows([{ date: today, entries: {} }, ...rows]);
  };

  const addCustomDateRow = () => {
    if (!customDate || rows.some((r) => r.date === customDate)) {
      return;
    }
    setRows([{ date: customDate, entries: {} }, ...rows].sort((a, b) => b.date.localeCompare(a.date)));
    setShowCustomDateModal(false);
    setCustomDate("");
  };

  const updateCell = (
    date: string,
    userId: string,
    field: "present" | "weight" | "comment",
    value: string | boolean
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.date !== date) return row;
        const entry = row.entries[userId] || {
          present: false,
          weight: "",
          comment: "",
        };
        return {
          ...row,
          entries: {
            ...row.entries,
            [userId]: { ...entry, [field]: value },
          },
        };
      })
    );
  };

  // Auto-save when checkbox is toggled
  const handleCheckInToggle = async (
    date: string,
    userId: string,
    present: boolean
  ) => {
    // Update local state first
    updateCell(date, userId, "present", present);
    
    // Auto-save the check-in status
    if (!user) return;
    
    try {
      const row = rows.find((r) => r.date === date);
      const entries = {
        [userId]: {
          present,
          weight: row?.entries[userId]?.weight || "",
          comment: row?.entries[userId]?.comment || "",
        },
      };
      
      await api.post("/api/checkins", { date, entries });

      // Award XP only when checking in (not when unchecking)
      if (present && userId === user.id) {
        // Check-in saved
      }
    } catch (err) {
      console.error("Failed to auto-save check-in:", err);
    }
  };

  const handleEditToggle = async () => {
    if (!isEditMode) {
      // Entering edit mode — snapshot current state
      setPreEditSnapshot(JSON.parse(JSON.stringify(rows)));
      setIsEditMode(true);
      // Scroll to newest date row
      const newestDate = rows.reduce((max, r) => r.date > max ? r.date : max, rows[0]?.date || "");
      if (newestDate) {
        requestAnimationFrame(() => {
          document.getElementById(`checkin-row-${newestDate}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } else {
      // Exiting edit mode — save changed rows
      try {
        const originalByDate = new Map(preEditSnapshot.map((row) => [row.date, row]));
        const changedRows: Array<{ date: string; entries: Record<string, { present: boolean; weight: string; comment: string }> }> = [];

        for (const row of rows) {
          const original = originalByDate.get(row.date);
          if (!original) continue;
          let changed = false;
          for (const u of users) {
            const origEntry = original.entries[u.id];
            const newEntry = row.entries[u.id];
            if (!origEntry && !newEntry) continue;
            if (origEntry?.weight !== newEntry?.weight || origEntry?.comment !== newEntry?.comment) {
              changed = true;
              break;
            }
          }
          if (!changed) continue;

          const entries: Record<string, { present: boolean; weight: string; comment: string }> = {};
          for (const u of users) {
            entries[u.id] = row.entries[u.id] || { present: false, weight: "", comment: "" };
          }
          changedRows.push({ date: row.date, entries });
        }

        if (changedRows.length > 0) {
          const saveResults = await Promise.allSettled(
            changedRows.map((row) => api.post("/api/checkins", { date: row.date, entries: row.entries }))
          );
          const failed = saveResults.find((result) => result.status === "rejected");
          if (failed) {
            console.error("Failed to save one or more edited rows");
          }
        }
      } catch (err) {
        console.error("Failed to save edits:", err);
      }
      setIsEditMode(false);
      setPreEditSnapshot([]);
    }
  };

  const handleEditCancel = () => {
    setRows(preEditSnapshot);
    setIsEditMode(false);
    setPreEditSnapshot([]);
  };

  const sortedRows = useMemo(
    () => [...rows].sort((a, b) =>
      sortOrder === "newest" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    ),
    [rows, sortOrder]
  );

  const memberStats = useMemo(
    () => users.reduce<Record<string, MemberStats>>((acc, u) => {
      const userRows = rows.filter((r) => r.entries[u.id]);
      const checkedInRows = userRows.filter((r) => r.entries[u.id]?.present);

      const weightsByDate = userRows
        .map((r) => ({
          date: r.date,
          value: Number(r.entries[u.id]?.weight),
        }))
        .filter((item) => Number.isFinite(item.value) && item.value > 0)
        .sort((a, b) => a.date.localeCompare(b.date));

      const weights = weightsByDate.map((item) => item.value);
      const avgWeight = weights.length > 0 ? weights.reduce((sum, w) => sum + w, 0) / weights.length : null;
      const firstWeight = weights.length > 0 ? weights[0] : null;
      const latestWeight = weights.length > 0 ? weights[weights.length - 1] : null;
      const weightChange = firstWeight !== null && latestWeight !== null ? latestWeight - firstWeight : null;
      const lastCheckInDate = checkedInRows.reduce<string | null>(
        (latest, row) => (!latest || row.date > latest ? row.date : latest),
        null
      );

      acc[u.id] = {
        totalCheckIns: checkedInRows.length,
        totalDays: userRows.length,
        consistencyPercent: userRows.length > 0 ? Math.round((checkedInRows.length / userRows.length) * 100) : 0,
        avgWeight,
        latestWeight,
        weightChange,
        lastCheckInDate,
      };

      return acc;
    }, {}),
    [rows, users]
  );

  const useMobileTableStyling = true;
  const compactCheckinRegister = useMobileTableStyling && !isEditMode && !isAdmin;

  const getRowCommentSummary = useCallback(
    (row: CheckInRow): string => {
      if (!isAdmin) {
        return (user?.id ? row.entries[user.id]?.comment : "") || "";
      }

      const comments = users
        .map((u) => {
          const text = row.entries[u.id]?.comment?.trim();
          return text ? `${u.name}: ${text}` : null;
        })
        .filter((value): value is string => Boolean(value));

      return comments.join(" | ");
    },
    [isAdmin, user?.id, users]
  );

  const checkinGridTemplateColumns = useMemo(
    () => `${isEditMode ? '104px' : '80px'} repeat(${users.length}, 44px) ${compactCheckinRegister ? '72px' : `repeat(${users.length}, 48px)`} minmax(180px, 1fr)`,
    [compactCheckinRegister, isEditMode, users.length]
  );

  const checkinGridMinWidth = useMemo(() => {
    const dateCol = isEditMode ? 104 : 80;
    const checkCols = users.length * 44;
    const weightCols = compactCheckinRegister ? 72 : users.length * 48;
    const commentsCol = 180;
    return `${dateCol + checkCols + weightCols + commentsCol}px`;
  }, [compactCheckinRegister, isEditMode, users.length]);

  if (user && !isAdmin) {
    return null;
  }

  return (
    <PageLayout
      title="Sect Register"
      subtitle="Record attendance and physical metrics of all cultivators"
      sidebarLabel="Check-In"
      mobileContentPaddingClass="p-2 pb-24"
    >
      {loading ? (
        <PageSkeleton statCards={2} wideBlock rows={5} />
      ) : (
        <div className="flex flex-col gap-4">
          {dayNotes.length > 0 && (
            <div className="flex flex-wrap items-start gap-4">
              {/* Cultivation Journal — personal day notes */}
              {dayNotes.length > 0 && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="min-w-[280px] flex-1"
                >
                  <GlowCard glow="none" hoverable={false} className="rounded-xl border border-[#3b3f48] bg-[#2b2d31] shadow-[0_10px_20px_rgba(0,0,0,0.22)]">
                    <h3 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-[#f2f3f5]">
                      📝 Cultivation Journal
                    </h3>
                    <div className="max-h-48 space-y-2 overflow-y-auto">
                      {dayNotes.map((dn) => (
                        <motion.div
                          key={dn.date}
                          initial={{ x: -10, opacity: 0 }}
                          animate={{ x: 0, opacity: 1 }}
                          className="flex items-start gap-2 text-xs group"
                        >
                          {dn.pinned && (
                            <span className="shrink-0 text-[#8ea1ff]" title="Pinned">📌</span>
                          )}
                          <button
                            onClick={() => setEditingNote({ date: dn.date, note: dn.note })}
                            className="shrink-0 font-mono text-[10px] text-[#8ea1ff] hover:underline"
                          >
                            {dn.date}
                          </button>
                          {dn.userName && (
                            <span className="shrink-0 font-medium text-[#b5bac1]">{dn.userName}:</span>
                          )}
                          <span className="flex-1 text-[#f2f3f5]">{dn.note}</span>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              onClick={() => toggleDayNotePin(dn.date)}
                              className={`transition-colors hover:text-[#f2f3f5] ${dn.pinned ? 'text-[#8ea1ff]' : 'text-[#949ba4]'}`}
                              title={dn.pinned ? "Unpin" : "Pin note"}
                            >
                              📌
                            </button>
                            <button
                              onClick={() => saveDayNote(dn.date, "")}
                              className="text-[#949ba4] transition-colors hover:text-[#ff8fa3]"
                              title="Delete note"
                            >
                              ✕
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </GlowCard>
                </motion.div>
              )}

            </div>
          )}

          {/* Sect Member Statistics (separate from the table) */}
          {users.length > 0 && (
            <GlowCard glow="none" hoverable={false} className="rounded-xl border border-[#3b3f48] bg-[#2b2d31] shadow-[0_10px_20px_rgba(0,0,0,0.22)]">
              <h3 className="mb-3 flex items-center gap-2 text-sm uppercase tracking-wider text-[#f2f3f5]">
                Sect Member Statistics
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {users.map((u) => (
                (() => {
                  const stats = memberStats[u.id];
                  if (!stats) return null;

                  const consistencyColor =
                    stats.consistencyPercent >= 80
                      ? "text-[#8ea1ff]"
                      : stats.consistencyPercent >= 60
                        ? "text-[#f0b96a]"
                        : "text-[#b5bac1]";

                  const weightTrendColor =
                    stats.weightChange === null
                      ? "text-[#949ba4]"
                      : stats.weightChange > 0
                        ? "text-[#ff8fa3]"
                        : "text-[#7ee787]";

                  return (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2 rounded-md border border-[#3b3f48] bg-[#232428] p-3"
                    >
                      <div className="flex items-center justify-between border-b border-[#3b3f48] pb-2">
                        <span className="text-sm font-semibold text-[#f2f3f5]">{u.name}</span>
                        {stats.lastCheckInDate && (
                          <span className="text-[9px] text-[#949ba4]">
                            Last: {formatDateWithPreference(stats.lastCheckInDate, dateFormat)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#b5bac1]">Check-ins</span>
                        <span className="font-semibold text-[#f2f3f5]">
                          {stats.totalCheckIns}/{stats.totalDays}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#b5bac1]">Consistency</span>
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[#3b3f48]">
                            <div
                              className="h-full bg-[#5865f2] transition-all duration-300"
                              style={{ width: `${stats.consistencyPercent}%` }}
                            />
                          </div>
                          <span className={`w-10 text-right font-semibold ${consistencyColor}`}>
                            {stats.consistencyPercent}%
                          </span>
                        </div>
                      </div>

                      {stats.avgWeight !== null && (
                        <>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#b5bac1]">Avg Weight</span>
                            <span className="font-semibold text-[#f2f3f5]">{stats.avgWeight.toFixed(1)} lb</span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#b5bac1]">Latest Weight</span>
                            <span className="font-semibold text-[#f2f3f5]">{stats.latestWeight?.toFixed(1) || "-"} lb</span>
                          </div>
                          {stats.weightChange !== null && (
                            <div className="flex items-center justify-between border-t border-[#3b3f48] pt-1 text-xs">
                              <span className="text-[#b5bac1]">Weight Change</span>
                              <span className={`font-semibold ${weightTrendColor}`}>
                                {stats.weightChange > 0 ? "+" : ""}
                                {stats.weightChange.toFixed(1)} lb
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </motion.div>
                  );
                })()
              ))}
              </div>
            </GlowCard>
          )}

          <GlowCard glow="none" hoverable={false} className="rounded-xl border border-[#3b3f48] bg-[#2b2d31] shadow-[0_10px_20px_rgba(0,0,0,0.22)]">
            <div className="w-full overflow-x-auto">
              {/* Toolbar */}
              <div className="mb-3 space-y-2 rounded-md border border-[#3b3f48] bg-[#232428] p-2.5 sm:p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const next = sortOrder === "newest" ? "oldest" : "newest";
                      setSortOrder(next);
                      localStorage.setItem("checkin-sort-order", next);
                    }}
                    className="rounded-md border border-[#3b3f48] bg-[#383a40]/65 px-2.5 py-1 text-[10px] text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                    title={sortOrder === "newest" ? "Showing newest first — click for oldest first" : "Showing oldest first — click for newest first"}
                  >
                    {sortOrder === "newest" ? "↓ Newest" : "↑ Oldest"}
                  </button>
                  <span className="text-[10px] text-[#949ba4] sm:ml-auto">
                    {rows.length} records
                  </span>
                  {rows.length > 0 && !isEditMode && (
                    <button
                      onClick={handleEditToggle}
                      className="rounded-md border border-[#5865f2]/60 bg-[#383a40] px-3 py-1 text-[10px] text-[#f2f3f5] transition-colors hover:bg-[#454852]"
                    >
                      ✎ Enter Edit Mode
                    </button>
                  )}
                </div>

                {isEditMode && rows.length > 0 && (
                  <div className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-2">
                    <div className="flex flex-wrap gap-2">
                      <GlowButton variant="jade" size="sm" className="flex-1 min-w-[130px]" onClick={handleEditToggle}>✓ Save Changes</GlowButton>
                      <GlowButton variant="ghost" size="sm" className="flex-1 min-w-[130px]" onClick={handleEditCancel}>✕ Cancel</GlowButton>
                    </div>
                    <p className="mt-2 text-[10px] text-[#b5bac1]">
                      Edit mode active. Use the red Remove button at the left of each date to delete a row.
                    </p>
                  </div>
                )}
              </div>

              <div style={{ minWidth: checkinGridMinWidth }}>
                {/* Grid header */}
                <div
                  className="mb-1 grid gap-0 border-b border-[#3b3f48] pb-2 text-[10px] font-semibold normal-case tracking-normal text-[#b5bac1] sm:text-[11px] sm:uppercase sm:tracking-wide"
                  style={{ gridTemplateColumns: checkinGridTemplateColumns }}
                >
                  <div className="px-1">Date</div>
                  {users.map((u) => (
                    <div
                      key={`h-c-${u.id}`}
                      className="text-center px-0.5 truncate"
                      title={u.name}
                      aria-label={u.name}
                    >
                      {getCompactUserLabel(u.name)}
                    </div>
                  ))}
                  {compactCheckinRegister ? (
                    <div className="text-center px-0.5">Wt</div>
                  ) : (
                    users.map((u) => (
                      <div key={`h-w-${u.id}`} className="text-center px-0.5">{u.name.charAt(0)}.Wt</div>
                    ))
                  )}
                  <div className="px-1">{isAdmin ? "All Comments" : "My Comments"}</div>
                </div>

                {sortedRows.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="text-2xl opacity-30 mb-2">📋</div>
                    <p className="text-xs text-[#b5bac1]">No records yet</p>
                    <p className="mt-1 text-[10px] text-[#949ba4]">
                      Check-in records will be created automatically
                    </p>
                  </div>
                ) : (
                  <div className="space-y-0">
                    {sortedRows.map((row) => {
                      const rowDateObj = new Date(row.date + 'T00:00:00');
                      const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rowDateObj.getDay()];
                      const isWeekend = rowDateObj.getDay() === 0 || rowDateObj.getDay() === 6;
                      const noteText = getDayNote(row.date);
                      return (
                        <div
                          key={row.date}
                          id={`checkin-row-${row.date}`}
                          className={`grid gap-0 items-center border-b py-1 text-xs transition-colors duration-100 ${
                            isEditMode
                              ? "border-[#3b3f48] bg-[#2b2d31] hover:bg-[#313338]"
                              : `border-[#3b3f48] hover:bg-[#2b2d31] ${isWeekend ? "bg-[#232428]" : ""}`
                          }`}
                          style={{ gridTemplateColumns: checkinGridTemplateColumns }}
                        >
                          {/* Date + Day */}
                          <div className="px-1 flex items-center gap-1.5">
                            {isEditMode && (
                              deletingRowDate === row.date ? (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => handleDeleteRow(row.date)}
                                    className="inline-flex items-center rounded-md border border-crimson/80 bg-crimson-deep/40 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-crimson-light hover:bg-crimson-deep/60 hover:text-crimson-glow transition-colors"
                                    title="Confirm delete"
                                  >
                                    Delete
                                  </button>
                                  <button
                                    onClick={() => setDeletingRowDate(null)}
                                    className="inline-flex items-center rounded-md border border-ink-light/50 bg-ink-dark/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-mist-dark hover:text-mist-light hover:border-mist-dark/70 transition-colors"
                                    title="Cancel"
                                  >
                                    Keep
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingRowDate(row.date)}
                                  className="inline-flex items-center rounded-md border border-crimson/60 bg-crimson-deep/30 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-crimson-light hover:bg-crimson-deep/55 hover:text-crimson-glow transition-colors shrink-0"
                                  title="Delete this row"
                                >
                                  Remove
                                </button>
                              )
                            )}
                            <button
                              onClick={() => setEditingNote({ date: row.date, note: noteText })}
                              className="text-left leading-tight text-[#f2f3f5] transition-colors hover:text-[#8ea1ff]"
                              title="Click to add/edit day note"
                            >
                              <span className="text-[11px]">{formatDateWithPreference(row.date, dateFormat)}</span>
                              <span className={`ml-1 text-[9px] ${isWeekend ? "text-[#f0b96a]" : "text-[#949ba4]"}`}>{dayName}</span>
                            </button>
                            {noteText && (
                              <span className="shrink-0 text-[10px] text-[#8ea1ff]" title={noteText}>📝</span>
                            )}
                          </div>

                          {/* Check-in toggles */}
                          {users.map((u) => {
                            const isPresent = row.entries[u.id]?.present || false;
                            const isOwn = u.id === user?.id;
                            const canEdit = isEditMode && (isOwn || isAdmin);
                            return (
                              <div key={`c-${row.date}-${u.id}`} className="flex justify-center">
                                {canEdit ? (
                                  <button
                                    onClick={() => handleCheckInToggle(row.date, u.id, !isPresent)}
                                    className={`h-5 w-5 rounded-md text-[10px] font-bold transition-colors duration-150 ${
                                      isPresent
                                        ? "border border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]"
                                        : "border border-[#3b3f48] text-[#949ba4] hover:text-[#f2f3f5]"
                                    }`}
                                  >
                                    {isPresent ? "✓" : ""}
                                  </button>
                                ) : (
                                  <span className={`flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold ${
                                    isPresent
                                      ? "border border-[#5865f2]/50 bg-[#383a40] text-[#f2f3f5]"
                                      : "text-[#949ba4]/60"
                                  }`}>
                                    {isPresent ? "✓" : "·"}
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          {/* Weight columns */}
                          {compactCheckinRegister ? (
                            <div className="text-center px-0.5">
                              {(() => {
                                const ownWeight = user ? row.entries[user.id]?.weight : "";
                                const numericWeights = users
                                  .map((u) => Number(row.entries[u.id]?.weight))
                                  .filter((value) => Number.isFinite(value) && value > 0);
                                const avgWeight = numericWeights.length > 0
                                  ? (numericWeights.reduce((sum, value) => sum + value, 0) / numericWeights.length).toFixed(1)
                                  : "—";
                                return (
                                  <span
                                    className={`text-[11px] ${ownWeight ? "text-[#f2f3f5]" : "text-[#949ba4]"}`}
                                    title={`You: ${ownWeight || "—"} • Avg: ${avgWeight}`}
                                  >
                                    {ownWeight || avgWeight}
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            users.map((u) => (
                              <div key={`w-${row.date}-${u.id}`} className="text-center px-0.5">
                                {isEditMode && u.id === user?.id ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={row.entries[u.id]?.weight || ""}
                                    onChange={(e) => updateCell(row.date, u.id, "weight", e.target.value)}
                                    placeholder="—"
                                    className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-1 py-0.5 text-center text-[11px] text-[#f2f3f5]
                                               outline-none focus:border-[#5865f2]/60"
                                  />
                                ) : (
                                  <span className={`text-[11px] ${row.entries[u.id]?.weight ? "text-[#f2f3f5]" : "text-[#949ba4]"}`}>
                                    {row.entries[u.id]?.weight || "—"}
                                  </span>
                                )}
                              </div>
                            ))
                          )}

                          {/* Comments */}
                          <div className="px-1 min-w-0">
                            {isEditMode ? (
                              isAdmin ? (
                                <div className="space-y-1">
                                  {users.map((u) => (
                                    <input
                                      key={`comment-${row.date}-${u.id}`}
                                      type="text"
                                      value={row.entries[u.id]?.comment || ""}
                                      onChange={(e) => updateCell(row.date, u.id, "comment", e.target.value)}
                                      placeholder={`${u.name} note...`}
                                      className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-2 py-0.5 text-[11px] text-[#f2f3f5]
                                                 placeholder:text-[#949ba4] outline-none focus:border-[#5865f2]/60"
                                    />
                                  ))}
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  value={user?.id ? row.entries[user.id]?.comment || "" : ""}
                                  onChange={(e) => {
                                    if (user?.id) {
                                      updateCell(row.date, user.id, "comment", e.target.value);
                                    }
                                  }}
                                  placeholder="Add your notes..."
                                  className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-2 py-0.5 text-[11px] text-[#f2f3f5]
                                             placeholder:text-[#949ba4] outline-none focus:border-[#5865f2]/60"
                                />
                              )
                            ) : (
                              <span
                                className="block cursor-help truncate text-[11px] text-[#b5bac1] transition-colors hover:text-[#f2f3f5]"
                                title={getRowCommentSummary(row) || "No notes"}
                              >
                                {getRowCommentSummary(row) || "—"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              {rows.length > 0 && !isEditMode && (
                <div className="border-t border-[#3b3f48] pt-2 text-center">
                  <p className="text-xs text-[#949ba4]">
                    Showing {rows.length} records
                  </p>
                </div>
              )}
            </div>
          </GlowCard>
        </div>
      )}
      
      {/* Day Note Modal */}
      <GlowModal
        isOpen={!!editingNote}
        onClose={() => setEditingNote(null)}
        title={`Day Note — ${editingNote ? formatDateWithPreference(editingNote.date, dateFormat) : ""}`}
      >
        <div className="space-y-4">
          {editingNote && (
            <>
              <p className="text-xs text-[#949ba4]">{formatDateDisplay(editingNote.date, dateFormat, settings.timeZone)}</p>
              <div>
                <label className="mb-2 block text-xs uppercase tracking-wider text-[#b5bac1]">
                  Cultivation Notes
                </label>
                <textarea
                  value={editingNote.note}
                  onChange={(e) => setEditingNote({ ...editingNote, note: e.target.value })}
                  placeholder="Record training observations, energy levels, insights..."
                  rows={4}
                  className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-3 py-2 text-sm text-[#f2f3f5] outline-none transition-colors resize-none placeholder:text-[#949ba4] focus:border-[#5865f2]/60"
                />
              </div>
              <div className="flex gap-2">
                <GlowButton
                  variant="jade"
                  glow
                  className="flex-1"
                  onClick={() => saveDayNote(editingNote.date, editingNote.note)}
                >
                  ✓ Save Note
                </GlowButton>
                {getDayNote(editingNote.date) && (
                  <GlowButton
                    variant="ghost"
                    className="text-crimson-light"
                    onClick={() => saveDayNote(editingNote.date, "")}
                  >
                    🗑 Delete
                  </GlowButton>
                )}
              </div>
            </>
          )}
        </div>
      </GlowModal>

      {/* Weight Prompt Modal */}
      <GlowModal
        isOpen={showWeightPrompt}
        onClose={() => { weightPromptDismissedRef.current = true; setShowWeightPrompt(false); setWeightPromptValue(""); }}
        title="⚖️ Log Your Weight"
      >
        <div className="space-y-5">
          <p className="text-xs text-[#b5bac1]">
            You haven&apos;t logged your weight today. Tracking your weight helps monitor your cultivation progress.
          </p>
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-wider text-[#b5bac1]">Body Weight (kg)</label>
            <input
              type="number"
              placeholder="Enter your weight..."
              value={weightPromptValue}
              onChange={(e) => setWeightPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && weightPromptValue) handleWeightPromptSubmit();
              }}
              className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-4 py-4 text-center text-lg font-medium text-[#f2f3f5] placeholder:text-[#949ba4] outline-none transition-colors focus:border-[#5865f2]/60"
              min="0"
              max="500"
              step="0.1"
              autoFocus
            />
          </div>
          <GlowButton
            variant="jade"
            glow
            className="w-full py-3 text-base"
            onClick={handleWeightPromptSubmit}
            disabled={!weightPromptValue}
          >
            ⚖️ Save Weight
          </GlowButton>
          <div className="grid grid-cols-2 gap-2">
            <GlowButton
              variant="ghost"
              className="w-full"
              onClick={() => {
                try { localStorage.setItem("weight-prompt-hidden-until", String(Date.now() + 60 * 60 * 1000)); } catch { /* ignore */ }
                weightPromptDismissedRef.current = true;
                setShowWeightPrompt(false);
                setWeightPromptValue("");
              }}
              size="sm"
            >
              Hide 1 Hour
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="w-full"
              onClick={() => { weightPromptDismissedRef.current = true; setShowWeightPrompt(false); setWeightPromptValue(""); }}
              size="sm"
            >
              Remind Later
            </GlowButton>
          </div>
        </div>
      </GlowModal>

      {/* Custom Date Modal */}
      <GlowModal
        isOpen={showCustomDateModal}
        onClose={() => {
          setShowCustomDateModal(false);
          setCustomDate("");
        }}
        title="Select Check-In Date"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-wider text-[#b5bac1]">
              Date
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full rounded-md border border-[#3b3f48] bg-[#232428] px-3 py-2 text-[#f2f3f5] outline-none transition-colors focus:border-[#5865f2]/60"
            />
          </div>
          <GlowButton
            variant="jade"
            glow
            className="w-full"
            onClick={addCustomDateRow}
          >
            ✓ Add Check-In Date
          </GlowButton>
        </div>
      </GlowModal>
    </PageLayout>
  );
}
