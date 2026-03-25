"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useAppContext } from "@/context/AppContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";
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

interface CommunityNote {
  id: string;
  date: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  user: { id: string; name: string; username: string };
}

function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${dayNames[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
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

function CheckInSidebar({
  onAddToday,
  onAddCustom,
  users,
  dayNotes,
  onToggleNotes,
  showNotesPanel,
}: {
  onAddToday: () => void;
  onAddCustom: () => void;
  users: User[];
  dayNotes: DayNote[];
  onToggleNotes: () => void;
  showNotesPanel: boolean;
}) {
  return (
    <div className="dashboard-sidebar-shell">
      <div className="dashboard-sidebar-scroll sidebar-scroll space-y-3">
        <GlowButton variant="jade" size="sm" className="w-full" onClick={onAddToday}>
          📅 Add Today&apos;s Date
        </GlowButton>
        <GlowButton variant="gold" size="sm" className="w-full" onClick={onAddCustom}>
          📆 Add Custom Date
        </GlowButton>
        <GlowButton 
          variant={showNotesPanel ? "jade" : "ghost"} 
          size="sm" 
          className="w-full" 
          onClick={onToggleNotes}
        >
          📝 {showNotesPanel ? "Hide" : "Show"} Day Notes {dayNotes.length > 0 && `(${dayNotes.length})`}
        </GlowButton>
        <GlowButton variant="ghost" size="sm" className="w-full">
          📊 Export Records
        </GlowButton>

        <div className="dashboard-sidebar-card pt-3">
          <h3 className="text-xs text-mist-dark uppercase mb-2">
            Registered Cultivators
          </h3>
          <div className="space-y-1">
            {users.length === 0 ? (
              <p className="text-xs text-mist-dark italic">No cultivators yet</p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="text-xs text-mist-light flex items-center gap-2 py-1"
                >
                  <span className="w-2 h-2 bg-jade-glow rounded-full" />
                  {user.name}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CheckInPage() {
  const { user } = useAuth();
  const { isMobile } = useAppContext();
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const [users, setUsers] = useState<User[]>([]);
  const [rows, setRows] = useState<CheckInRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [editingNote, setEditingNote] = useState<{ date: string; note: string } | null>(null);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [communityNotes, setCommunityNotes] = useState<CommunityNote[]>([]);
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

  const broadcastNotesUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("checkin-notes-updated"));
    localStorage.setItem("checkin-notes-updated-at", String(Date.now()));
  }, []);

  const fetchCommunityNotes = useCallback(async () => {
    try {
      const data = await api.get<{ notes: CommunityNote[] }>("/api/checkins/notes");
      setCommunityNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to fetch community notes:", err);
    }
  }, []);

  const handleDeleteCommunityNote = useCallback(async (noteId: string) => {
    if (!user) return;
    try {
      await api.delete("/api/checkins/notes", { noteId });
      setCommunityNotes(prev => prev.filter(n => n.id !== noteId));
      broadcastNotesUpdated();
    } catch (err) {
      console.error("Failed to delete community note:", err);
    }
  }, [broadcastNotesUpdated, user]);

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

  const handleTogglePinNote = useCallback(async (noteId: string, pinned: boolean) => {
    if (!user) return;
    try {
      await api.patch("/api/checkins/notes", { noteId, pinned });
      setCommunityNotes(prev =>
        prev.map(n => n.id === noteId ? { ...n, pinned } : n)
          .sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          })
      );
      broadcastNotesUpdated();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  }, [broadcastNotesUpdated, user]);

  const fetchData = useCallback(async () => {
    try {
      const [usersData, checkinsData] = await Promise.all([
        api.get<{ users: User[] }>("/api/users"),
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
    fetchCommunityNotes();
  }, [fetchData, fetchCommunityNotes]);

  useEffect(() => {
    const handleNotesUpdated = () => {
      fetchCommunityNotes();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "checkin-notes-updated-at") {
        fetchCommunityNotes();
      }
    };

    window.addEventListener("checkin-notes-updated", handleNotesUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("checkin-notes-updated", handleNotesUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchCommunityNotes]);

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

  // Load day notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivation-day-notes");
      if (saved) setDayNotes(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const saveDayNote = (date: string, note: string) => {
    setDayNotes(prev => {
      const filtered = prev.filter(n => n.date !== date);
      const updated = note.trim() ? [...filtered, { date, note: note.trim(), userName: user?.name || 'Unknown', pinned: prev.find(n => n.date === date)?.pinned || false }] : filtered;
      updated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.date.localeCompare(a.date);
      });
      localStorage.setItem("cultivation-day-notes", JSON.stringify(updated));
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
      localStorage.setItem("cultivation-day-notes", JSON.stringify(updated));
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

  // Total check-in counts per user
  const totalCheckIns = useMemo(
    () => users.reduce<Record<string, number>>((acc, u) => {
      acc[u.id] = rows.filter((r) => r.entries[u.id]?.present).length;
      return acc;
    }, {}),
    [rows, users]
  );

  const useMobileTableStyling = isMobile;
  const compactCheckinRegister = useMobileTableStyling && !isEditMode;

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

  const getCommentOwnerId = useCallback(
    (row: CheckInRow): string | null => {
      if (user?.id && row.entries[user.id]?.comment?.trim()) return user.id;
      const withComment = users.find((u) => row.entries[u.id]?.comment?.trim());
      return withComment?.id ?? (user?.id || users[0]?.id || null);
    },
    [user?.id, users]
  );

  return (
    <PageLayout
      title="Sect Register"
      subtitle="Record attendance and physical metrics of all cultivators"
      sidebar={<CheckInSidebar onAddToday={addTodayRow} onAddCustom={() => setShowCustomDateModal(true)} users={users} dayNotes={dayNotes} onToggleNotes={() => setShowNotesPanel(!showNotesPanel)} showNotesPanel={showNotesPanel} />}
      sidebarLabel="Check-In"
    >
      {loading ? (
        <PageSkeleton statCards={2} wideBlock rows={5} />
      ) : (
        <>
          {/* Cultivation Journal — personal day notes */}
          {dayNotes.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ duration: 0.25 }}
                className="mb-4"
              >
                <div className="bg-ink-dark/60 border border-ink-light rounded-lg p-4">
                  <h3 className="text-xs text-gold-glow uppercase tracking-wider mb-3 flex items-center gap-2">
                    📝 Cultivation Journal
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {dayNotes.map((dn) => (
                      <motion.div
                        key={dn.date}
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className="flex items-start gap-2 text-xs group"
                      >
                        {dn.pinned && (
                          <span className="text-gold-glow shrink-0" title="Pinned">📌</span>
                        )}
                        <button
                          onClick={() => setEditingNote({ date: dn.date, note: dn.note })}
                          className="text-jade-glow font-mono shrink-0 hover:underline text-[10px]"
                        >
                          {dn.date}
                        </button>
                        {dn.userName && (
                          <span className="text-gold shrink-0 font-medium">{dn.userName}:</span>
                        )}
                        <span className="text-mist-light flex-1">{dn.note}</span>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => toggleDayNotePin(dn.date)}
                            className={`hover:text-gold-glow transition-colors ${dn.pinned ? 'text-gold-glow' : 'text-mist-dark'}`}
                            title={dn.pinned ? "Unpin" : "Pin note"}
                          >
                            📌
                          </button>
                          <button
                            onClick={() => saveDayNote(dn.date, "")}
                            className="text-mist-dark hover:text-crimson-light transition-colors"
                            title="Delete note"
                          >
                            ✕
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
          )}
          {/* Community Notes — attributed notes from sect members */}
          {communityNotes.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              transition={{ duration: 0.25 }}
              className="mb-4"
            >
              <div className="bg-ink-dark/60 border border-ink-light rounded-lg p-4">
                <h3 className="text-xs text-mountain-blue-glow uppercase tracking-wider mb-3 flex items-center gap-2">
                  🏯 Sect Member Notes
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {communityNotes.map((cn) => (
                    <motion.div
                      key={cn.id}
                      initial={{ x: -10, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      className="flex items-start gap-2 text-xs group"
                    >
                      {cn.pinned && (
                        <span className="text-gold-glow shrink-0" title="Pinned">📌</span>
                      )}
                      <span className="text-jade-glow font-mono shrink-0 text-[10px]">{cn.date}</span>
                      <span className="text-gold shrink-0 font-medium">{cn.user.name}:</span>
                      <span className="text-mist-light flex-1">{cn.content}</span>
                      {user && cn.user.id === user.id && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <button
                            onClick={() => handleTogglePinNote(cn.id, !cn.pinned)}
                            className={`hover:text-gold-glow transition-colors ${cn.pinned ? 'text-gold-glow' : 'text-mist-dark'}`}
                            title={cn.pinned ? "Unpin" : "Pin note"}
                          >
                            📌
                          </button>
                          <button
                            onClick={() => handleDeleteCommunityNote(cn.id)}
                            className="text-mist-dark hover:text-crimson-light transition-colors"
                            title="Delete note"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          <div className="flex justify-center">
            <div className="overflow-x-auto w-full">
              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <button
                  onClick={() => {
                    const next = sortOrder === "newest" ? "oldest" : "newest";
                    setSortOrder(next);
                    localStorage.setItem("checkin-sort-order", next);
                  }}
                  className="px-2.5 py-0.5 text-[10px] rounded border border-ink-light/50 text-mist-dark hover:text-mist-light hover:border-ink-light transition-all"
                  title={sortOrder === "newest" ? "Showing newest first — click for oldest first" : "Showing oldest first — click for newest first"}
                >
                  {sortOrder === "newest" ? "↓ Newest" : "↑ Oldest"}
                </button>
                <span className="text-[10px] text-mist-dark ml-auto">
                  {rows.length} records
                </span>
                {rows.length > 0 && !isEditMode && (
                  <button
                    onClick={handleEditToggle}
                    className="px-2.5 py-0.5 text-[10px] rounded border border-ink-light/50 text-mist-dark hover:text-mist-light hover:border-ink-light transition-all"
                  >
                    ✎ Edit
                  </button>
                )}
              </div>

              {/* Save/Cancel at top when newest-first */}
              {isEditMode && sortOrder === "newest" && rows.length > 0 && (
                <div className="flex gap-3 pb-3 mb-2 border-b border-ink-light">
                  <GlowButton variant="jade" size="sm" className="flex-1" onClick={handleEditToggle}>✓ Save Changes</GlowButton>
                  <GlowButton variant="ghost" size="sm" className="flex-1" onClick={handleEditCancel}>✕ Cancel</GlowButton>
                </div>
              )}

              {/* Edit mode banner */}
              {isEditMode && (
                <div className="p-2.5 mb-3 rounded-lg border bg-jade-deep/10 border-jade/40 text-[11px] text-jade-light">
                  Edit mode enabled. Modify your weight and comment data below, then click Save or Cancel.
                </div>
              )}

              {/* Total Check-In Counts */}
              {users.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-3 p-2 bg-ink-dark/40 rounded-lg border border-ink-light/30">
                  <span className="text-[10px] text-mist-dark uppercase tracking-wider self-center">Totals:</span>
                  {users.map((u) => (
                    <div key={u.id} className="flex items-center gap-1.5 text-[10px]">
                      <span className="text-mist-light">{u.name}:</span>
                      <span className="text-jade-glow font-semibold">{totalCheckIns[u.id] || 0}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ minWidth: checkinGridMinWidth }}>
                {/* Grid header */}
                <div
                  className="grid gap-0 text-[10px] sm:text-[11px] normal-case sm:uppercase tracking-normal sm:tracking-wide font-semibold text-mist-dark border-b border-jade-glow/30 pb-2 mb-1"
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
                  <div className="px-1">Comments</div>
                </div>

                {/* Rows */}
                {sortedRows.length === 0 ? (
                  <div className="flex flex-col items-center py-10 text-center">
                    <div className="text-2xl opacity-30 mb-2">📋</div>
                    <p className="text-xs text-mist-dark">
                      No records yet
                    </p>
                    <p className="text-[10px] text-mist-dark/60 mt-1">
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
                          className={`grid gap-0 items-center py-1 border-b text-xs transition-colors duration-100 ${
                            isEditMode
                              ? "border-jade-glow/15 bg-jade-deep/5 hover:bg-jade-deep/10"
                              : `border-ink-light/50 hover:bg-ink-mid/10 ${isWeekend ? "bg-ink-dark/20" : ""}`
                          }`}
                          style={{ gridTemplateColumns: checkinGridTemplateColumns }}
                        >
                          {/* Date + Day */}
                          <div className="px-1 flex items-center gap-1">
                            {isEditMode && (
                              deletingRowDate === row.date ? (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    onClick={() => handleDeleteRow(row.date)}
                                    className="text-[9px] text-crimson-light hover:text-crimson-glow transition-colors"
                                    title="Confirm delete"
                                  >
                                    ✓
                                  </button>
                                  <button
                                    onClick={() => setDeletingRowDate(null)}
                                    className="text-[9px] text-mist-dark hover:text-mist-light transition-colors"
                                    title="Cancel"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setDeletingRowDate(row.date)}
                                  className="text-[9px] text-mist-dark hover:text-crimson-light transition-colors shrink-0"
                                  title="Delete this row"
                                >
                                  🗑
                                </button>
                              )
                            )}
                            <button
                              onClick={() => setEditingNote({ date: row.date, note: noteText })}
                              className="text-mist-light hover:text-jade-glow transition-colors text-left leading-tight"
                              title="Click to add/edit day note"
                            >
                              <span className="text-[11px]">{formatDateWithPreference(row.date, dateFormat)}</span>
                              <span className={`text-[9px] ml-1 ${isWeekend ? "text-amber-400/60" : "text-mist-dark"}`}>{dayName}</span>
                            </button>
                            {noteText && (
                              <span className="text-[10px] text-gold-glow shrink-0" title={noteText}>📝</span>
                            )}
                          </div>

                          {/* Check-in toggles */}
                          {users.map((u) => {
                            const isPresent = row.entries[u.id]?.present || false;
                            const isOwn = u.id === user?.id;
                            const canEdit = isOwn && isEditMode;
                            return (
                              <div key={`c-${row.date}-${u.id}`} className="flex justify-center">
                                {canEdit ? (
                                  <button
                                    onClick={() => handleCheckInToggle(row.date, u.id, !isPresent)}
                                    className={`w-5 h-5 rounded text-[10px] font-bold transition-all duration-150 ${
                                      isPresent
                                        ? "bg-jade-glow/20 text-jade-glow border border-jade-glow/40 shadow-[0_0_6px_rgba(58,143,143,0.3)]"
                                        : "text-mist-dark border border-ink-light/40 hover:border-mist-dark/60"
                                    }`}
                                  >
                                    {isPresent ? "✓" : ""}
                                  </button>
                                ) : (
                                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold ${
                                    isPresent
                                      ? "bg-jade-glow/15 text-jade-glow/70 border border-jade-glow/20"
                                      : "text-mist-dark/40"
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
                                    className={`text-[11px] ${ownWeight ? "text-cloud-white" : "text-mist-dark/70"}`}
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
                                    className="w-full bg-ink-deep border border-jade-glow/30 rounded px-1 py-0.5 text-cloud-white
                                               text-center text-[11px] outline-none focus:border-jade-glow"
                                  />
                                ) : (
                                  <span className={`text-[11px] ${row.entries[u.id]?.weight ? "text-cloud-white" : "text-mist-dark/50"}`}>
                                    {row.entries[u.id]?.weight || "—"}
                                  </span>
                                )}
                              </div>
                            ))
                          )}

                          {/* Comments */}
                          <div className="px-1 min-w-0">
                            {isEditMode ? (
                              (() => {
                                const commentOwnerId = getCommentOwnerId(row);
                                return (
                                  <input
                                    type="text"
                                    value={commentOwnerId ? row.entries[commentOwnerId]?.comment || "" : ""}
                                    onChange={(e) => {
                                      if (commentOwnerId) {
                                        updateCell(row.date, commentOwnerId, "comment", e.target.value);
                                      }
                                    }}
                                    placeholder="Add notes..."
                                    className="w-full bg-ink-deep border border-jade-glow/30 rounded px-2 py-0.5 text-cloud-white text-[11px]
                                               placeholder:text-mist-dark/40 outline-none focus:border-jade-glow"
                                  />
                                );
                              })()
                            ) : (
                              (() => {
                                const commentOwnerId = getCommentOwnerId(row);
                                const commentText = commentOwnerId ? row.entries[commentOwnerId]?.comment || "" : "";
                                return (
                                  <span
                                    className="text-mist-light/80 text-[11px] truncate block cursor-help hover:text-mist-glow transition-colors"
                                    title={commentText || "No notes"}
                                  >
                                    {commentText || "—"}
                                  </span>
                                );
                              })()
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Save/Cancel at bottom when oldest-first */}
              {isEditMode && sortOrder === "oldest" && rows.length > 0 && (
                <div className="flex gap-3 pt-4 mt-2 border-t border-ink-light">
                  <GlowButton variant="jade" size="sm" className="flex-1" onClick={handleEditToggle}>✓ Save Changes</GlowButton>
                  <GlowButton variant="ghost" size="sm" className="flex-1" onClick={handleEditCancel}>✕ Cancel</GlowButton>
                </div>
              )}

              {/* Footer */}
              {rows.length > 0 && !isEditMode && (
                <div className="text-center pt-2 border-t border-ink-light">
                  <p className="text-xs text-mist-dark">
                    Showing {rows.length} records
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
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
              <p className="text-xs text-mist-dark">{formatDateDisplay(editingNote.date)}</p>
              <div>
                <label className="block text-xs text-mist-light uppercase tracking-wider mb-2">
                  Cultivation Notes
                </label>
                <textarea
                  value={editingNote.note}
                  onChange={(e) => setEditingNote({ ...editingNote, note: e.target.value })}
                  placeholder="Record training observations, energy levels, insights..."
                  rows={4}
                  className="w-full bg-ink-dark border border-jade-glow/30 rounded-lg px-3 py-2 text-cloud-white text-sm outline-none focus:border-jade-glow transition-colors resize-none placeholder:text-mist-dark"
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
          <p className="text-xs text-mist-mid">
            You haven&apos;t logged your weight today. Tracking your weight helps monitor your cultivation progress.
          </p>
          <div>
            <label className="block text-[10px] text-jade-glow uppercase tracking-wider mb-2">Body Weight (kg)</label>
            <input
              type="number"
              placeholder="Enter your weight..."
              value={weightPromptValue}
              onChange={(e) => setWeightPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && weightPromptValue) handleWeightPromptSubmit();
              }}
              className="w-full bg-ink-deep border border-ink-light rounded-lg px-4 py-4 text-lg text-cloud-white placeholder-mist-dark outline-none focus:border-jade-glow transition-colors text-center font-medium"
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
            <label className="block text-xs text-mist-light uppercase tracking-wider mb-2">
              Date
            </label>
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="w-full bg-ink-dark border border-jade-glow/30 rounded-lg px-3 py-2 text-cloud-white outline-none focus:border-jade-glow transition-colors"
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
