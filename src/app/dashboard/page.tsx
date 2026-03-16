"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef } from "react";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { GlowModal } from "@/components/ui/GlowCard";
import PageLayout from "@/components/layout/PageLayout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";

interface User {
  id: string;
  name: string;
  username: string;
}

interface CheckInRow {
  date: string;
  entries: Record<string, { present: boolean; weight: string; comment: string }>;
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

import { awardCheckInXP } from "@/lib/experience";


const quickActions = [
  { label: "Start Training", icon: "⚔️", path: "/dashboard/workout", glow: "jade" as const },
  { label: "Check In", icon: "📋", path: "/dashboard/checkin", glow: "blue" as const },
  { label: "Browse Techniques", icon: "📜", path: "/dashboard/exercises", glow: "gold" as const },
  { label: "View Path", icon: "🏔️", path: "/dashboard/progress", glow: "crimson" as const },
];

const DEFAULT_CULTIVATOR_COLORS = [
  "#3a8f8f", // jade
  "#d4a843", // gold
  "#c9433e", // crimson
  "#4a9eff", // azure
  "#9b59b6", // violet
  "#2ecc71", // emerald
  "#f39c12", // amber
  "#e74c8c", // rose
];

const CULTIVATOR_COLOR_OPTIONS = [
  { name: "Jade", value: "#3a8f8f" },
  { name: "Gold", value: "#d4a843" },
  { name: "Crimson", value: "#c9433e" },
  { name: "Azure", value: "#4a9eff" },
  { name: "Violet", value: "#9b59b6" },
  { name: "Emerald", value: "#2ecc71" },
  { name: "Amber", value: "#f39c12" },
  { name: "Rose", value: "#e74c8c" },
];

function DashboardSidebar({ stats, allUsers, userColors, onColorChange }: { stats: { sessions: number; techniques: number; streak: number; realm: string }; allUsers: User[]; userColors: Record<string, string>; onColorChange: (userId: string, color: string) => void }) {
  const { settings: dsSettings } = useDisplaySettings();
  const gamificationVisible = dsSettings.gamificationVisible ?? true;
  return (
    <div className="space-y-3">
      <GlowButton variant="jade" size="sm" glow className="w-full">
        ⚔️ Quick Training
      </GlowButton>
      <GlowButton variant="blue" size="sm" className="w-full">
        📋 Today&apos;s Check-In
      </GlowButton>

      <div className="ink-border rounded-lg p-3 bg-ink-dark space-y-2">
        <h3 className="text-xs text-jade-glow uppercase">Cultivation Stats</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">Training Sessions</span>
            <span className="text-cloud-white">{stats.sessions}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">Techniques Known</span>
            <span className="text-cloud-white">{stats.techniques}</span>
          </div>
          {gamificationVisible && (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-mist-mid">Check-In Streak</span>
                <span className="text-jade-glow font-semibold">{stats.streak} days</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-mist-mid">Realm</span>
                <span className="text-gold-dim uppercase">{stats.realm}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {allUsers.length > 0 && (
        <div className="ink-border rounded-lg p-3 bg-ink-dark space-y-2">
          <h3 className="text-xs text-jade-glow uppercase">Cultivator Colours</h3>
          <div className="space-y-2">
            {allUsers.map((u, idx) => (
              <div key={u.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length] }}
                  />
                  <span className="text-xs text-mist-light truncate">{u.name}</span>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  {CULTIVATOR_COLOR_OPTIONS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => onColorChange(u.id, c.value)}
                      className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                        (userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length]) === c.value
                          ? "border-cloud-white scale-125 shadow-[0_0_6px_currentColor]"
                          : "border-transparent hover:border-mist-dark hover:scale-110"
                      }`}
                      style={{ backgroundColor: c.value }}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarDay({ date, checkedInUsers, isToday, isPast, hasNote, hasFutureNote, onClick }: { date: Date; checkedInUsers: { id: string; name: string; color: string }[]; isToday: boolean; isPast?: boolean; hasNote?: boolean; hasFutureNote?: boolean; onClick?: () => void }) {
  const hasCheckIns = checkedInUsers.length > 0;
  return (
    <motion.div
      whileHover={{ scale: 1.05 }}
      onClick={onClick}
      className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all relative cursor-pointer ${
        isToday
          ? "border-2 border-jade-glow bg-jade-deep/30 hover:bg-jade-deep/50 shadow-[0_0_8px_rgba(58,143,143,0.3)]"
          : hasFutureNote
          ? "border border-jade/30 bg-jade-deep/15 hover:bg-jade-deep/25 shadow-[0_0_6px_rgba(29,72,72,0.3)]"
          : hasCheckIns
          ? "border border-jade/40 bg-jade-dark/15 hover:bg-jade-dark/30"
          : "border border-ink-light/60 bg-ink-dark/30 hover:bg-ink-mid/40"
      } ${isPast && !isToday ? 'opacity-50' : ''}`}
    >
      <div className="text-center">
        <div className={`text-sm font-medium ${isPast && !isToday ? 'text-mist-mid' : 'text-cloud-white'}`}>{date.getDate()}</div>
        {isToday && <div className="text-[10px] text-jade-glow font-bold">TODAY</div>}
      </div>
      {hasCheckIns && (
        <div className="absolute bottom-0.5 left-1 flex gap-[2px]">
          {checkedInUsers.map((u) => (
            <span
              key={u.id}
              title={u.name}
              className="text-[11px] leading-none font-bold drop-shadow-[0_0_3px_currentColor]"
              style={{ color: u.color }}
            >
              ✓
            </span>
          ))}
        </div>
      )}
      {hasNote && (
        <div className="absolute top-0.5 right-0.5 text-[8px] text-gold-glow">📝</div>
      )}
      {hasFutureNote && (
        <div className="absolute bottom-0.5 right-0.5 text-[7px] font-bold text-jade-glow/70 uppercase leading-none drop-shadow-[0_0_3px_rgba(58,143,143,0.4)]">note</div>
      )}
    </motion.div>
  );
}

function Calendar({ checkInUsersByDate, currentMonth, setCurrentMonth, dayNotes, futureNoteDates, onDayClick, allUsers, userColors }: { checkInUsersByDate: Map<string, string[]>; currentMonth: Date; setCurrentMonth: (d: Date) => void; dayNotes?: Map<string, string>; futureNoteDates?: Set<string>; onDayClick?: (date: string) => void; allUsers: User[]; userColors: Record<string, string> }) {
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const days = [];
  const today = formatDateLocal(new Date());

  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  // Add days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    days.push(date);
  }

  return (
    <GlowCard glow="jade" className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-cloud-white">
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-2">
          <GlowButton
            variant="ghost"
            size="sm"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
              )
            }
          >
            ← Prev
          </GlowButton>
          <GlowButton
            variant="ghost"
            size="sm"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1)
              )
            }
          >
            Next →
          </GlowButton>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="text-center text-xs text-mist-dark uppercase font-semibold">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, i) => (
          <div key={i}>
            {date ? (
              <CalendarDay
                date={date}
                checkedInUsers={
                  (checkInUsersByDate.get(formatDateLocal(date)) || []).map(uid => {
                    const u = allUsers.find(usr => usr.id === uid);
                    const idx = allUsers.findIndex(usr => usr.id === uid);
                    return { id: uid, name: u?.name || "Unknown", color: userColors[uid] || DEFAULT_CULTIVATOR_COLORS[idx >= 0 ? idx % DEFAULT_CULTIVATOR_COLORS.length : 0] };
                  })
                }
                isToday={formatDateLocal(date) === today}
                isPast={formatDateLocal(date) < today}
                hasNote={dayNotes?.has(formatDateLocal(date))}
                hasFutureNote={futureNoteDates?.has(formatDateLocal(date))}
                onClick={() => onDayClick?.(formatDateLocal(date))}
              />
            ) : (
              <div className="aspect-square" />
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="pt-4 border-t border-ink-light flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-2 border-jade-glow bg-jade-deep/30 shadow-[0_0_4px_rgba(58,143,143,0.2)]" />
          <span className="text-mist-mid">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-jade-glow drop-shadow-[0_0_3px_rgba(58,143,143,0.6)]">✓</span>
          <span className="text-mist-mid">Cultivator Check-In</span>
        </div>
        <div className="flex items-center gap-1">
          {allUsers.slice(0, 4).map((u, idx) => (
            <span
              key={u.id}
              className="text-[10px] font-bold"
              style={{ color: userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length] }}
              title={u.name}
            >
              ✓
            </span>
          ))}
          <span className="text-mist-mid ml-0.5">= per cultivator</span>
        </div>
      </div>
    </GlowCard>
  );
}

export default function DaoHallPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [checkInUsersByDate, setCheckInUsersByDate] = useState<Map<string, string[]>>(new Map());
  const [userColors, setUserColors] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ sessions: 0, techniques: 0, streak: 0, realm: "Mortal" });
  const [loading, setLoading] = useState(true);
  const [dayNotes, setDayNotes] = useState<Map<string, string>>(new Map());
  const [futureNotes, setFutureNotes] = useState<CommunityNote[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [checkInRows, setCheckInRows] = useState<CheckInRow[]>([]);
  const [xpFeedback, setXpFeedback] = useState<{ show: boolean; xp: number }>({ show: false, xp: 0 });
  const sectRegisterRef = useRef<HTMLDivElement>(null);
  // Check-in modal state
  const [checkInModal, setCheckInModal] = useState<{
    date: string;
    entries: Record<string, { present: boolean; weight: string; comment: string }>;
  } | null>(null);

  // Weight prompt modal state
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightPromptValue, setWeightPromptValue] = useState("");

  const broadcastNotesUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("checkin-notes-updated"));
    localStorage.setItem("checkin-notes-updated-at", String(Date.now()));
  }, []);

  // Sect Register filter and inline edit state
  const [sectFilterDays, setSectFilterDays] = useState<7 | 14 | 30>(14);
  const [isSectEditMode, setIsSectEditMode] = useState(false);
  const [sectEditData, setSectEditData] = useState<Record<string, Record<string, { weight: string; comment: string }>>>({});

  // Load user colors from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivator-colors");
      if (saved) setUserColors(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

  const handleColorChange = (userId: string, color: string) => {
    setUserColors(prev => {
      const updated = { ...prev, [userId]: color };
      localStorage.setItem("cultivator-colors", JSON.stringify(updated));
      return updated;
    });
  };

  // Load day notes from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivation-day-notes");
      if (saved) {
        const parsed: { date: string; note: string }[] = JSON.parse(saved);
        const map = new Map<string, string>();
        for (const n of parsed) {
          if (n.note.trim()) map.set(n.date, n.note);
        }
        setDayNotes(map);
      }
    } catch { /* ignore */ }
  }, []);

  const refreshFutureNotes = useCallback(async () => {
    try {
      const todayStr = formatDateLocal(new Date());
      const res = await fetch(`/api/checkins/notes?future=true&today=${todayStr}`);
      const data = await res.json();
      setFutureNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to fetch future notes:", err);
    }
  }, []);

  const handleDayClick = (dateStr: string) => {
    // Open check-in modal for the selected day
    const existingRow = checkInRows.find(r => r.date === dateStr);
    const entries: Record<string, { present: boolean; weight: string; comment: string }> = {};
    for (const u of allUsers) {
      entries[u.id] = existingRow?.entries[u.id] || { present: false, weight: "", comment: "" };
    }
    setCheckInModal({ date: dateStr, entries });
  };

  const updateCheckInModalEntry = (userId: string, field: "present" | "weight" | "comment", value: string | boolean) => {
    if (!checkInModal) return;
    setCheckInModal(prev => {
      if (!prev) return prev;
      const entry = prev.entries[userId] || { present: false, weight: "", comment: "" };
      return {
        ...prev,
        entries: { ...prev.entries, [userId]: { ...entry, [field]: value } },
      };
    });
  };

  const isWeightDismissedToday = useCallback(() => {
    try {
      const dismissed = localStorage.getItem("weight-prompt-dismissed");
      if (dismissed) {
        const today = formatDateLocal(new Date());
        if (dismissed === today) return true;
      }
      const hiddenUntil = localStorage.getItem("weight-prompt-hidden-until");
      if (hiddenUntil && Date.now() < Number(hiddenUntil)) return true;
      return false;
    } catch { return false; }
  }, []);

  const dismissWeightToday = () => {
    const today = formatDateLocal(new Date());
    localStorage.setItem("weight-prompt-dismissed", today);
  };

  const dismissWeightForOneHour = () => {
    localStorage.setItem("weight-prompt-hidden-until", String(Date.now() + 60 * 60 * 1000));
  };

  const proceedWithSaveCheckIn = async () => {
    if (!checkInModal || !user) return;
    try {
      // Determine if this is a far-future date (2+ days ahead)
      const modalDate = new Date(checkInModal.date + 'T00:00:00');
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((modalDate.getTime() - todayDate.getTime()) / 86400000);
      const isFarFuture = diffDays >= 2;

      // Only send the current user's entry to enforce ownership
      const ownEntry = checkInModal.entries[user.id];
      const ownEntries = ownEntry ? { [user.id]: ownEntry } : {};

      // For far-future dates, save the comment as a community note so it appears in Upcoming Notes
      // The shared comment is stored under the first user's entry in the modal
      const sharedComment = (allUsers[0] && checkInModal.entries[allUsers[0].id]?.comment?.trim()) || "";
      if (isFarFuture) {
        if (sharedComment) {
          await fetch("/api/checkins/notes", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: checkInModal.date, userId: user.id, content: sharedComment }),
          });
        } else {
          // Note was cleared — delete the existing CheckInNote if one exists
          const existingNote = futureNotes.find(n => n.date === checkInModal.date && n.user.id === user.id);
          if (existingNote) {
            await fetch("/api/checkins/notes", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ noteId: existingNote.id, userId: user.id }),
            });
          }
        }
        refreshFutureNotes();
        broadcastNotesUpdated();
      }

      await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: checkInModal.date, entries: ownEntries, requestingUserId: user.id }),
      });

      // Award XP if current user checked in
      const currentUserEntry = checkInModal.entries[user.id];
      if (currentUserEntry?.present) {
        await awardCheckInXP(user.id);
        setXpFeedback({ show: true, xp: 15 });
        setTimeout(() => setXpFeedback({ show: false, xp: 0 }), 3000);
      }

      // Update local rows
      setCheckInRows(prev => {
        const filtered = prev.filter(r => r.date !== checkInModal.date);
        const newRow = { date: checkInModal.date, entries: checkInModal.entries };
        return [newRow, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
      });

      // Update calendar user check-ins
      setCheckInUsersByDate(prev => {
        const updated = new Map(prev);
        const presentUserIds = Object.entries(checkInModal.entries)
          .filter(([, e]) => e.present)
          .map(([uid]) => uid);
        if (presentUserIds.length > 0) {
          updated.set(checkInModal.date, presentUserIds);
        } else {
          updated.delete(checkInModal.date);
        }
        return updated;
      });

      setCheckInModal(null);
      setShowWeightPrompt(false);
      setWeightPromptValue("");

      // Scroll to Sect Register to show the saved entry
      setTimeout(() => {
        sectRegisterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.error("Failed to save check-in:", err);
    }
  };

  const handleSaveCheckIn = async () => {
    if (!checkInModal || !user) return;

    // Check if the current user is checked in but hasn't entered weight
    const currentUserEntry = checkInModal.entries[user.id];
    if (currentUserEntry?.present && !currentUserEntry.weight && !isWeightDismissedToday()) {
      setShowWeightPrompt(true);
      return;
    }

    await proceedWithSaveCheckIn();
  };

  const handleWeightPromptSubmit = async () => {
    if (!checkInModal || !user || !weightPromptValue) return;
    updateCheckInModalEntry(user.id, "weight", weightPromptValue);
    // Need to wait for state update, so we save directly with the weight
    const updatedEntries = {
      ...checkInModal.entries,
      [user.id]: { ...checkInModal.entries[user.id], weight: weightPromptValue },
    };
    setCheckInModal(prev => prev ? { ...prev, entries: updatedEntries } : prev);
    setShowWeightPrompt(false);
    setWeightPromptValue("");
    // Proceed with save using updated entries — only send own entry
    try {
      const ownEntry = updatedEntries[user.id];
      await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: checkInModal.date, entries: { [user.id]: ownEntry }, requestingUserId: user.id }),
      });

      const currentEntry = updatedEntries[user.id];
      if (currentEntry?.present) {
        await awardCheckInXP(user.id);
        setXpFeedback({ show: true, xp: 15 });
        setTimeout(() => setXpFeedback({ show: false, xp: 0 }), 3000);
      }

      setCheckInRows(prev => {
        const filtered = prev.filter(r => r.date !== checkInModal.date);
        const newRow = { date: checkInModal.date, entries: updatedEntries };
        return [newRow, ...filtered].sort((a, b) => b.date.localeCompare(a.date));
      });

      setCheckInUsersByDate(prev => {
        const updated = new Map(prev);
        const presentUserIds = Object.entries(updatedEntries)
          .filter(([, e]) => e.present)
          .map(([uid]) => uid);
        if (presentUserIds.length > 0) {
          updated.set(checkInModal.date, presentUserIds);
        } else {
          updated.delete(checkInModal.date);
        }
        return updated;
      });

      setCheckInModal(null);

      setTimeout(() => {
        sectRegisterRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      console.error("Failed to save check-in:", err);
    }
  };

  const handleWeightPromptSkip = async () => {
    setShowWeightPrompt(false);
    setWeightPromptValue("");
    await proceedWithSaveCheckIn();
  };

  const handleWeightPromptDismissOneHour = async () => {
    dismissWeightForOneHour();
    setShowWeightPrompt(false);
    setWeightPromptValue("");
    await proceedWithSaveCheckIn();
  };

  const handleWeightPromptDismissToday = async () => {
    dismissWeightToday();
    setShowWeightPrompt(false);
    setWeightPromptValue("");
    await proceedWithSaveCheckIn();
  };

  const handleCheckInToggle = async (date: string, userId: string, present: boolean) => {
    // Only allow toggling own check-in
    if (!user || userId !== user.id) return;
    // Update local row state
    setCheckInRows(prev => prev.map(row => {
      if (row.date !== date) return row;
      const entry = row.entries[userId] || { present: false, weight: "", comment: "" };
      return { ...row, entries: { ...row.entries, [userId]: { ...entry, present } } };
    }));

    // Auto-save
    try {
      const row = checkInRows.find(r => r.date === date);
      await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          entries: { [userId]: { present, weight: row?.entries[userId]?.weight || "", comment: row?.entries[userId]?.comment || "" } },
          requestingUserId: user.id,
        }),
      });

      if (present && userId === user.id) {
        await awardCheckInXP(user.id);
        setXpFeedback({ show: true, xp: 15 });
        setTimeout(() => setXpFeedback({ show: false, xp: 0 }), 3000);
      }

      // Update calendar user check-ins
      setCheckInUsersByDate(prev => {
        const updated = new Map(prev);
        const current = updated.get(date) || [];
        if (present) {
          if (!current.includes(userId)) updated.set(date, [...current, userId]);
        } else {
          const filtered = current.filter(id => id !== userId);
          if (filtered.length > 0) updated.set(date, filtered);
          else updated.delete(date);
        }
        return updated;
      });
    } catch (err) {
      console.error("Failed to auto-save check-in:", err);
    }
  };

  // Sect Register edit mode handlers
  const handleSectEditToggle = () => {
    if (!isSectEditMode) {
      const data: Record<string, Record<string, { weight: string; comment: string }>> = {};
      for (const row of checkInRows) {
        data[row.date] = {};
        for (const u of allUsers) {
          const entry = row.entries[u.id];
          data[row.date][u.id] = {
            weight: entry?.weight || "",
            comment: entry?.comment || "",
          };
        }
      }
      setSectEditData(data);
    }
    setIsSectEditMode(!isSectEditMode);
  };

  const handleSectEditChange = (date: string, userId: string, field: "weight" | "comment", value: string) => {
    setSectEditData(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [userId]: {
          ...prev[date]?.[userId],
          [field]: value,
        },
      },
    }));
  };

  const handleSectEditSave = async () => {
    try {
      const filtered = checkInRows.filter(row => {
        const rowDate = new Date(row.date + 'T00:00:00');
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((now.getTime() - rowDate.getTime()) / 86400000);
        return diffDays >= 0 && diffDays < sectFilterDays;
      });
      for (const row of filtered) {
        const edited = sectEditData[row.date];
        if (!edited) continue;
        let changed = false;
        const entries: Record<string, { present: boolean; weight: string; comment: string }> = {};
        for (const u of allUsers) {
          const original = row.entries[u.id] || { present: false, weight: "", comment: "" };
          const editedEntry = edited[u.id];
          const newWeight = editedEntry?.weight ?? original.weight;
          const newComment = editedEntry?.comment ?? original.comment;
          if (newWeight !== original.weight || newComment !== original.comment) changed = true;
          entries[u.id] = { present: original.present, weight: newWeight, comment: newComment };
        }
        if (changed) {
          await fetch("/api/checkins", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ date: row.date, entries }),
          });
        }
      }
      setCheckInRows(prev => prev.map(row => {
        const edited = sectEditData[row.date];
        if (!edited) return row;
        const newEntries = { ...row.entries };
        for (const userId of Object.keys(edited)) {
          if (newEntries[userId]) {
            newEntries[userId] = {
              ...newEntries[userId],
              weight: edited[userId]?.weight ?? newEntries[userId]?.weight ?? "",
              comment: edited[userId]?.comment ?? newEntries[userId]?.comment ?? "",
            };
          }
        }
        return { ...row, entries: newEntries };
      }));
      setIsSectEditMode(false);
      setSectEditData({});
    } catch (err) {
      console.error("Failed to save sect register edits:", err);
    }
  };

  const handleSectEditCancel = () => {
    setIsSectEditMode(false);
    setSectEditData({});
  };

  // Filtered check-in rows for Sect Register
  const filteredCheckInRows = checkInRows.filter(row => {
    const rowDate = new Date(row.date + 'T00:00:00');
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((now.getTime() - rowDate.getTime()) / 86400000);
    return diffDays >= 0 && diffDays < sectFilterDays;
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch check-ins, users, and future notes in parallel
        const [checkinsRes, usersRes, expRes, workoutRes, exerciseRes, futureNotesRes] = await Promise.all([
          fetch("/api/checkins"),
          fetch("/api/users"),
          fetch(`/api/users/experience?userId=${user.id}`),
          fetch(`/api/workouts?userId=${user.id}`),
          fetch("/api/exercises"),
          fetch(`/api/checkins/notes?future=true&today=${formatDateLocal(new Date())}`),
        ]);
        const checkinsData = await checkinsRes.json();
        const usersData = await usersRes.json();
        const expData = await expRes.json();
        const workoutData = await workoutRes.json();
        const exerciseData = await exerciseRes.json();
        const futureNotesData = await futureNotesRes.json();

        // Set future notes
        setFutureNotes(futureNotesData.notes || []);

        // Set all users
        setAllUsers(usersData.users || []);

        // Build check-in users by date and rows
        const usersByDate = new Map<string, string[]>();
        const userCheckInDates = new Set<string>();
        const grouped: Record<string, CheckInRow["entries"]> = {};

        for (const checkin of checkinsData.checkins || []) {
          const date = checkin.date.split("T")[0];
          if (checkin.present) {
            const current = usersByDate.get(date) || [];
            if (!current.includes(checkin.userId)) {
              usersByDate.set(date, [...current, checkin.userId]);
            }
            if (checkin.userId === user.id) {
              userCheckInDates.add(date);
            }
          }
          if (!grouped[date]) grouped[date] = {};
          grouped[date][checkin.userId] = {
            present: checkin.present,
            weight: checkin.weight?.toString() || "",
            comment: checkin.comment || "",
          };
        }

        setCheckInUsersByDate(usersByDate);
        const sortedRows = Object.entries(grouped)
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([date, entries]) => ({ date, entries }));
        setCheckInRows(sortedRows);

        const userExp = expData.user?.experience || 0;
        const userWorkouts = (workoutData.workouts || []).filter((w: { userId: string }) => w.userId === user.id);

        // Calculate streak using current user's dates
        const today = new Date();
        let streak = 0;
        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today);
          checkDate.setDate(checkDate.getDate() - i);
          const dateStr = formatDateLocal(checkDate);
          if (userCheckInDates.has(dateStr)) {
            streak++;
          } else if (i > 0) {
            break;
          }
        }

        // Calculate realm from experience
        const realms = ["Mortal", "Foundation", "Core", "Nascent", "Soul Splitting", "Tribulation", "Immortal"];
        const xpThresholds = [0, 100, 300, 600, 1200, 2000, 3500];
        let currentRealm = "Mortal";
        for (let i = xpThresholds.length - 1; i >= 0; i--) {
          if (userExp >= xpThresholds[i]) {
            currentRealm = realms[i];
            break;
          }
        }

        setStats({
          sessions: userWorkouts.length,
          techniques: exerciseData.exercises?.length || 0,
          streak,
          realm: currentRealm,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  useEffect(() => {
    const handleNotesUpdated = () => {
      refreshFutureNotes();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "checkin-notes-updated-at") {
        handleNotesUpdated();
      }
    };

    window.addEventListener("checkin-notes-updated", handleNotesUpdated);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("checkin-notes-updated", handleNotesUpdated);
      window.removeEventListener("storage", handleStorage);
    };
  }, [refreshFutureNotes]);

  if (!user) return null;

  return (
    <PageLayout
      title="Dao Hall"
      subtitle="The spiritual center of your cultivation journey"
      sidebar={<DashboardSidebar stats={stats} allUsers={allUsers} userColors={userColors} onColorChange={handleColorChange} />}
      sidebarLabel="Cultivation Stats"
    >
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="text-3xl"
          >
            ☯
          </motion.div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Calendar */}
          <Calendar checkInUsersByDate={checkInUsersByDate} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} dayNotes={dayNotes} futureNoteDates={new Set(futureNotes.map(n => n.date))} onDayClick={handleDayClick} allUsers={allUsers} userColors={userColors} />

          {/* Quick Actions */}
          <div>
            <h3 className="text-sm text-jade-glow uppercase mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickActions
                .filter((action) => (settings.gamificationVisible ?? true) || action.path !== "/dashboard/progress")
                .map((action, i) => (
                <motion.div
                  key={action.path}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <GlowButton
                    variant={action.glow}
                    className="w-full text-center"
                    onClick={() => router.push(action.path)}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{action.icon}</span>
                      <span className="text-xs">{action.label}</span>
                    </div>
                  </GlowButton>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Future Notes Log */}
          <GlowCard glow="gold" className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-base">📝</span>
              <h3 className="text-sm text-gold-glow uppercase tracking-wider font-semibold">Upcoming Notes</h3>
              {futureNotes.length > 0 && (
                <span className="text-[10px] text-mist-dark bg-ink-mid/60 px-1.5 py-0.5 rounded-full">{futureNotes.length}</span>
              )}
            </div>
            {futureNotes.length > 0 ? (
              <div className="space-y-2">
                {futureNotes.map((note) => {
                  const noteUserIdx = allUsers.findIndex(u => u.id === note.user.id);
                  const noteColor = userColors[note.user.id] || DEFAULT_CULTIVATOR_COLORS[noteUserIdx >= 0 ? noteUserIdx % DEFAULT_CULTIVATOR_COLORS.length : 0];
                  return (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-start gap-3 p-3 rounded-lg border border-ink-light/40 bg-ink-dark/40 hover:bg-ink-mid/30 transition-colors"
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: noteColor, boxShadow: `0 0 6px ${noteColor}80` }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                          <span className="text-xs font-semibold" style={{ color: noteColor }}>
                            {note.user.name}
                          </span>
                          <span className="text-[10px] text-mist-dark">
                            {formatDateWithPreference(note.date, dateFormat)}
                          </span>
                        </div>
                        <p className="text-xs text-mist-light leading-relaxed break-words">{note.content}</p>
                        <span className="text-[9px] text-mist-dark mt-1 block">
                          {new Date(note.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-mist-dark italic py-2">No upcoming notes. Add notes to future calendar dates to see them here.</p>
            )}
          </GlowCard>

          {/* XP Feedback */}
          {(settings.gamificationVisible ?? true) && xpFeedback.show && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-3 bg-gradient-to-r from-jade-dark to-jade-glow/30 border border-jade-glow rounded-lg text-center text-jade-glow font-semibold flex items-center justify-center gap-2"
            >
              <span className="text-lg">✨</span>
              <span>+{xpFeedback.xp} XP Gained!</span>
              <span className="text-lg">✨</span>
            </motion.div>
          )}

          {/* Sect Register Table — Check-In Records */}
          <GlowCard glow="jade" className="w-full">
            <div ref={sectRegisterRef} className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-jade-glow">Sect Register</h3>
                <div className="flex items-center gap-2">
                  {!isSectEditMode && (
                    <div className="flex items-center gap-1">
                      {([7, 14, 30] as const).map((days) => (
                        <motion.button
                          key={days}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => setSectFilterDays(days)}
                          className={`text-xs px-2 py-0.5 rounded border transition-all ${
                            sectFilterDays === days
                              ? "bg-jade-deep/20 border-jade/40 text-jade-light"
                              : "border-ink-light/40 text-mist-light hover:text-jade-light hover:border-jade/30"
                          }`}
                        >
                          {days}d
                        </motion.button>
                      ))}
                    </div>
                  )}
                  {checkInRows.length > 0 && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleSectEditToggle}
                      className={`text-xs px-3 py-1 rounded border transition-all ${
                        isSectEditMode
                          ? "bg-crimson-deep/20 border-crimson/40 text-crimson-light"
                          : "border-jade-glow/40 text-jade-light hover:bg-jade-deep/10"
                      }`}
                    >
                      {isSectEditMode ? "✕ Cancel Edit" : "✎ Edit"}
                    </motion.button>
                  )}
                </div>
              </div>

              {isSectEditMode && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-lg border bg-jade-deep/10 border-jade/40 text-xs text-jade-light"
                >
                  Edit mode enabled. Modify weight and comment data below, then click Save or Cancel.
                </motion.div>
              )}

              <div className="overflow-x-auto -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="min-w-[480px]">
                  {/* Grid header */}
                  <div
                    className="grid gap-0 text-[10px] uppercase tracking-wider font-semibold text-mist-dark border-b border-jade-glow/30 pb-1.5 mb-1"
                    style={{ gridTemplateColumns: `80px repeat(${allUsers.length}, 44px) repeat(${allUsers.length}, 48px) 1fr` }}
                  >
                    <div className="px-1">Date</div>
                    {allUsers.map((u) => (
                      <div key={`h-c-${u.id}`} className="text-center px-0.5">{u.name}</div>
                    ))}
                    {allUsers.map((u) => (
                      <div key={`h-w-${u.id}`} className="text-center px-0.5">{u.name.charAt(0)}.Wt</div>
                    ))}
                    <div className="px-1">Comments</div>
                  </div>

                  {/* Rows */}
                  {filteredCheckInRows.length === 0 ? (
                    <div className="py-10 text-center text-mist-dark italic text-xs">
                      No records in the last {sectFilterDays} days. Click a calendar day to begin.
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {filteredCheckInRows.map((row) => {
                        const rowDateObj = new Date(row.date + 'T00:00:00');
                        const dayName = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][rowDateObj.getDay()];
                        const isWeekend = rowDateObj.getDay() === 0 || rowDateObj.getDay() === 6;
                        return (
                          <div
                            key={row.date}
                            className={`grid gap-0 items-center py-1 border-b text-xs transition-colors duration-100 ${
                              isSectEditMode
                                ? "border-jade-glow/15 bg-jade-deep/5 hover:bg-jade-deep/10"
                                : `border-ink-light/50 hover:bg-ink-mid/10 ${isWeekend ? "bg-ink-dark/20" : ""}`
                            }`}
                            style={{ gridTemplateColumns: `80px repeat(${allUsers.length}, 44px) repeat(${allUsers.length}, 48px) 1fr` }}
                          >
                            {/* Date + Day */}
                            <div className="px-1">
                              <button
                                onClick={() => handleDayClick(row.date)}
                                className="text-mist-light hover:text-jade-glow transition-colors text-left leading-tight"
                                title="Click to edit"
                              >
                                <span className="text-[11px]">{formatDateWithPreference(row.date, dateFormat)}</span>
                                <span className={`text-[9px] ml-1 ${isWeekend ? "text-amber-400/60" : "text-mist-dark"}`}>{dayName}</span>
                              </button>
                            </div>

                            {/* Check-in toggles */}
                            {allUsers.map((u) => {
                              const isPresent = row.entries[u.id]?.present || false;
                              const isOwn = u.id === user.id;
                              return (
                                <div key={`c-${row.date}-${u.id}`} className="flex justify-center">
                                  {isOwn ? (
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
                            {allUsers.map((u) => (
                              <div key={`w-${row.date}-${u.id}`} className="text-center px-0.5">
                                {isSectEditMode && u.id === user.id ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={sectEditData[row.date]?.[u.id]?.weight ?? row.entries[u.id]?.weight ?? ""}
                                    onChange={(e) => handleSectEditChange(row.date, u.id, "weight", e.target.value)}
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
                            ))}

                            {/* Comments */}
                            <div className="px-1 min-w-0">
                              {isSectEditMode ? (
                                <input
                                  type="text"
                                  value={sectEditData[row.date]?.[allUsers[0]?.id]?.comment ?? row.entries[allUsers[0]?.id]?.comment ?? ""}
                                  onChange={(e) => {
                                    if (allUsers[0]) handleSectEditChange(row.date, allUsers[0].id, "comment", e.target.value);
                                  }}
                                  placeholder="Add notes..."
                                  className="w-full bg-ink-deep border border-jade-glow/30 rounded px-2 py-0.5 text-cloud-white text-[11px]
                                             placeholder:text-mist-dark/40 outline-none focus:border-jade-glow"
                                />
                              ) : (
                                <span
                                  className="text-mist-light/80 text-[11px] truncate block cursor-help hover:text-mist-glow transition-colors"
                                  title={row.entries[allUsers[0]?.id]?.comment || "No notes"}
                                >
                                  {row.entries[allUsers[0]?.id]?.comment || "—"}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {isSectEditMode && filteredCheckInRows.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-3 pt-4 border-t border-ink-light"
                >
                  <GlowButton
                    variant="jade"
                    size="sm"
                    className="flex-1"
                    onClick={handleSectEditSave}
                  >
                    ✓ Save Changes
                  </GlowButton>
                  <GlowButton
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={handleSectEditCancel}
                  >
                    ✕ Cancel
                  </GlowButton>
                </motion.div>
              )}

              {filteredCheckInRows.length > 0 && !isSectEditMode && (
                <div className="text-center pt-2 border-t border-ink-light">
                  <p className="text-xs text-mist-dark">
                    Showing {filteredCheckInRows.length} records from the last {sectFilterDays} days
                  </p>
                </div>
              )}
            </div>
          </GlowCard>
        </div>
      )}

      {/* Day Check-In Modal */}
      <GlowModal
        isOpen={!!checkInModal}
        onClose={() => { setCheckInModal(null); }}
        title={`Day Check-In — ${checkInModal ? formatDateWithPreference(checkInModal.date, dateFormat) : ""}`}
      >
        <div className="space-y-4">
          {checkInModal && (() => {
            const modalDate = new Date(checkInModal.date + 'T00:00:00');
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((modalDate.getTime() - todayDate.getTime()) / 86400000);
            const isFarFuture = diffDays >= 2;

            return (
            <>
              <p className="text-xs text-mist-dark">
                {modalDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </p>

              {isFarFuture && (
                <div className="px-3 py-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-[11px] text-amber-300/80">
                  ⏳ Future date — only shared comments are available. Check-in is restricted to today and the next day.
                </div>
              )}

              {/* Check-In Section — Horizontal cultivator boxes (hidden for far-future dates) */}
              {!isFarFuture && (
              <div>
                <label className="block text-xs text-jade-glow uppercase tracking-wider mb-3">
                  📋 Cultivator Check-In
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allUsers.map((u, idx) => {
                    const entry = checkInModal.entries[u.id] || { present: false, weight: "", comment: "" };
                    const color = userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length];
                    return (
                      <motion.div
                        key={u.id}
                        whileHover={u.id === user.id ? { scale: 1.04 } : {}}
                        whileTap={u.id === user.id ? { scale: 0.96 } : {}}
                        className={`rounded-lg border-2 transition-all duration-200 select-none ${
                          entry.present
                            ? "bg-jade-deep/30"
                            : "border-ink-light bg-ink-dark/60"
                        } ${
                          u.id === user.id
                            ? "hover:bg-ink-mid/40 hover:border-mist-dark"
                            : "opacity-60 cursor-default"
                        }`}
                        style={entry.present ? { borderColor: color, boxShadow: `0 0 14px ${color}50` } : {}}
                      >
                        <div
                          className={`p-3 text-center ${u.id === user.id ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => { if (u.id === user.id) updateCheckInModalEntry(u.id, "present", !entry.present); }}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className="text-xl font-bold transition-all drop-shadow-[0_0_4px_currentColor]"
                              style={{ color: entry.present ? color : '#4b5563' }}
                            >
                              {entry.present ? '✓' : '○'}
                            </span>
                            <span className={`text-xs font-medium transition-colors ${entry.present ? 'text-cloud-white' : 'text-mist-mid'}`}>
                              {u.name}
                            </span>
                          </div>
                        </div>
                        {entry.present && u.id === user.id && (
                          <div className="px-2 pb-2">
                            <input
                              type="number"
                              placeholder="Weight (kg)"
                              value={entry.weight}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => updateCheckInModalEntry(u.id, "weight", e.target.value)}
                              className="w-full bg-ink-deep/80 border border-ink-light rounded px-2 py-1 text-[10px] text-cloud-white placeholder-mist-dark outline-none focus:border-jade-glow transition-colors text-center"
                              min="0"
                              max="500"
                              step="0.1"
                            />
                          </div>
                        )}
                        {entry.present && u.id !== user.id && entry.weight && (
                          <div className="px-2 pb-2 text-center">
                            <span className="text-[10px] text-mist-mid">{entry.weight} kg</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              )}

                {/* Shared Comment */}
                <div className={isFarFuture ? "" : "mt-4"}>
                  <label className="block text-[10px] text-mist-dark uppercase mb-1">Shared Comments</label>
                  <input
                    type="text"
                    placeholder="Notes visible to all cultivators..."
                    value={checkInModal.entries[allUsers[0]?.id]?.comment || ""}
                    onChange={(e) => {
                      if (allUsers[0]) {
                        updateCheckInModalEntry(allUsers[0].id, "comment", e.target.value);
                      }
                    }}
                    className="w-full bg-ink-deep border border-ink-light rounded px-3 py-2 text-xs text-cloud-white placeholder-mist-dark outline-none focus:border-jade-glow transition-colors"
                  />
                </div>

                {isFarFuture ? (
                  <div className="flex gap-2 mt-4">
                    <GlowButton
                      variant="jade"
                      glow
                      className="flex-1"
                      onClick={handleSaveCheckIn}
                      size="sm"
                    >
                      💾 Save Note
                    </GlowButton>
                    {futureNotes.some(n => n.date === checkInModal.date && n.user.id === user.id) && (
                      <GlowButton
                        variant="crimson"
                        className="flex-1"
                        onClick={async () => {
                          const existingNote = futureNotes.find(n => n.date === checkInModal.date && n.user.id === user.id);
                          if (existingNote) {
                            await fetch("/api/checkins/notes", {
                              method: "DELETE",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ noteId: existingNote.id, userId: user.id }),
                            });
                            refreshFutureNotes();
                            broadcastNotesUpdated();
                            if (allUsers[0]) updateCheckInModalEntry(allUsers[0].id, "comment", "");
                          }
                        }}
                        size="sm"
                      >
                        🗑 Clear Note
                      </GlowButton>
                    )}
                  </div>
                ) : (
                  <GlowButton
                    variant="jade"
                    glow
                    className="w-full mt-4"
                    onClick={handleSaveCheckIn}
                    size="sm"
                  >
                    ✓ Save Check-In
                  </GlowButton>
                )}
            </>
            );
          })()}
        </div>
      </GlowModal>

      {/* Weight Prompt Modal */}
      <GlowModal
        isOpen={showWeightPrompt}
        onClose={() => { setShowWeightPrompt(false); setWeightPromptValue(""); }}
        title="⚖️ Log Your Weight"
      >
        <div className="space-y-5">
          <p className="text-xs text-mist-mid">
            You haven&apos;t logged your weight for this check-in. Tracking your weight helps monitor your cultivation progress.
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
            ⚖️ Save with Weight
          </GlowButton>
          <div className="grid grid-cols-2 gap-2">
            <GlowButton
              variant="blue"
              className="w-full"
              onClick={handleWeightPromptSkip}
              size="sm"
            >
              Skip for Now
            </GlowButton>
            <GlowButton
              variant="ghost"
              className="w-full"
              onClick={handleWeightPromptDismissOneHour}
              size="sm"
            >
              Hide 1 Hour
            </GlowButton>
          </div>
          <button
            onClick={handleWeightPromptDismissToday}
            className="w-full text-[11px] text-mist-dark hover:text-mist-mid transition-colors py-2 text-center"
          >
            Don&apos;t remind me today
          </button>
        </div>
      </GlowModal>
    </PageLayout>
  );
}
