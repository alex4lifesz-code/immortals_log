"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
import PageLayout from "@/components/layout/PageLayout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { createCalendarMonthAnchor, formatDateWithPreference } from "@/lib/constants";
import { t } from "@/lib/terminology";
import {
  getCheckInHistoryPreviewLimit,
  getDetailLabelVisibility,
  type CheckInHistoryViewMode,
} from "@/lib/checkin-history-view";
import { syncWeightFromLatestCheckin } from "@/lib/user-physique";
import { api } from "@/lib/api-client";
import {
  Calendar,
  getDeterministicCultivatorColor,
  getUserCultivatorColor,
  getCultivatorGlowColor,
  normalizeCultivatorColor,
  formatDateLocal,
  type DashboardUser,
} from "@/components/dashboard/DashboardCalendar";

type User = DashboardUser & { cultivatorColor?: string };

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

const ITEMS_PER_PAGE = 7;

function formatRelativeRecentDate(dateLike: string): string {
  const timestamp = new Date(dateLike).getTime();
  if (!Number.isFinite(timestamp)) return "";

  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) {
    return new Date(timestamp).toLocaleDateString();
  }

  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const fourteenDaysMs = 14 * dayMs;

  if (diffMs < hourMs) {
    const mins = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${mins}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.max(1, Math.floor(diffMs / hourMs));
    return `${hours}h ago`;
  }

  if (diffMs < fourteenDaysMs) {
    const days = Math.max(1, Math.floor(diffMs / dayMs));
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  return new Date(timestamp).toLocaleDateString();
}

export default function DaoHallPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings } = useDisplaySettings();
  const isAdmin = user?.role === "admin";
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [checkInUsersByDate, setCheckInUsersByDate] = useState<Map<string, string[]>>(new Map());
  const [userColors, setUserColors] = useState<Record<string, string>>({});
  const [stats, setStats] = useState({ sessions: 0, techniques: 0, streak: 0 });
  const [loading, setLoading] = useState(true);
  const [dayNotes, setDayNotes] = useState<Map<string, string>>(new Map());
  const [futureNotes, setFutureNotes] = useState<CommunityNote[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [checkInRows, setCheckInRows] = useState<CheckInRow[]>([]);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);

  const sectRegisterRef = useRef<HTMLDivElement>(null);
  const rowsObserverTargetRef = useRef<HTMLDivElement | null>(null);
  // Check-in modal state
  const [checkInModal, setCheckInModal] = useState<{
    date: string;
    entries: Record<string, { present: boolean; weight: string; comment: string }>;
  } | null>(null);

  // Weight prompt modal state
  const [showWeightPrompt, setShowWeightPrompt] = useState(false);
  const [weightPromptValue, setWeightPromptValue] = useState("");

  const dayNotesStorageKey = useMemo(
    () => (user?.id ? `cultivation-day-notes:${user.id}` : "cultivation-day-notes"),
    [user?.id]
  );

  const broadcastNotesUpdated = useCallback(() => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new Event("checkin-notes-updated"));
    localStorage.setItem("checkin-notes-updated-at", String(Date.now()));
  }, []);

  // Sect Register filter and inline edit state
  const [calendarScope, setCalendarScope] = useState<"all" | "mine" | "friends">(() => {
    if (typeof window === "undefined") return "mine";
    const saved = localStorage.getItem("dao-hall-calendar-scope");
    if (saved === "all") return "all";
    if (saved === "community") return "all";
    if (saved === "friends") return "friends";
    return "mine";
  });
  const [historyViewMode, setHistoryViewMode] = useState<CheckInHistoryViewMode>(() => {
    if (typeof window === "undefined") return "detailed";
    try {
      return localStorage.getItem("dao-hall-history-view") === "compact" ? "compact" : "detailed";
    } catch {
      return "detailed";
    }
  });
  const [isHistoryViewMenuOpen, setIsHistoryViewMenuOpen] = useState(false);
  const historyViewMenuRef = useRef<HTMLDivElement | null>(null);
  const [isSectEditMode, setIsSectEditMode] = useState(false);
  const [sectEditData, setSectEditData] = useState<Record<string, Record<string, { weight: string; comment: string }>>>({});
  const [deletingRowDate, setDeletingRowDate] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dao-hall-calendar-scope", calendarScope);
  }, [calendarScope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dao-hall-history-view", historyViewMode);
  }, [historyViewMode]);

  useEffect(() => {
    if (!isHistoryViewMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (historyViewMenuRef.current && !historyViewMenuRef.current.contains(event.target as Node)) {
        setIsHistoryViewMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [isHistoryViewMenuOpen]);

  const handleColorChange = useCallback(async (userId: string, color: string) => {
    if (!user) return;
    const canEdit = userId === user.id || user.role === "admin";
    if (!canEdit) return;

    const normalized = normalizeCultivatorColor(color);
    setUserColors((prev) => ({ ...prev, [userId]: normalized }));

    try {
      await api.put("/api/users/preferences", {
        userId,
        appPrefs: { cultivatorColor: normalized },
      });
      await queryClient.invalidateQueries({ queryKey: ["dao-hall-data", user.id] });
    } catch (error) {
      console.error("Failed to save cultivator color:", error);
      await queryClient.invalidateQueries({ queryKey: ["dao-hall-data", user.id] });
    }
  }, [queryClient, user]);

  // Load day notes from per-user localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(dayNotesStorageKey);
      if (saved) {
        const parsed: { date: string; note: string }[] = JSON.parse(saved);
        const map = new Map<string, string>();
        for (const n of parsed) {
          if (n.note.trim()) map.set(n.date, n.note);
        }
        setDayNotes(map);
      }
    } catch { /* ignore */ }
  }, [dayNotesStorageKey]);

  const refreshFutureNotes = useCallback(async () => {
    try {
      const todayStr = formatDateLocal(new Date(), settings.timeZone);
      const apiScope = "friends";
      const data = await api.get<{ notes: CommunityNote[] }>(`/api/checkins/notes?future=true&scope=${apiScope}&today=${todayStr}`);
      setFutureNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to fetch future notes:", err);
    }
  }, [settings.timeZone]);

  const handleDeleteRow = useCallback(async (date: string) => {
    try {
      await api.delete("/api/checkins", { date });
      setCheckInRows(prev => prev.filter(r => r.date !== date));
      setCheckInUsersByDate(prev => {
        const updated = new Map(prev);
        updated.delete(date);
        return updated;
      });
      setDeletingRowDate(null);
      broadcastNotesUpdated();
    } catch (err) {
      console.error("Failed to delete row:", err);
    }
  }, [broadcastNotesUpdated]);

  const handleDayClick = (dateStr: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month] = dateStr.split("-").map((value) => Number.parseInt(value, 10));
      setCurrentMonth(createCalendarMonthAnchor(year, month));
    }

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
        const today = formatDateLocal(new Date(), settings.timeZone);
        if (dismissed === today) return true;
      }
      const hiddenUntil = localStorage.getItem("weight-prompt-hidden-until");
      if (hiddenUntil && Date.now() < Number(hiddenUntil)) return true;
      return false;
    } catch { return false; }
  }, [settings.timeZone]);

  const dismissWeightToday = () => {
    const today = formatDateLocal(new Date(), settings.timeZone);
    localStorage.setItem("weight-prompt-dismissed", today);
  };

  const dismissWeightForOneHour = () => {
    localStorage.setItem("weight-prompt-hidden-until", String(Date.now() + 60 * 60 * 1000));
  };

  const proceedWithSaveCheckIn = async () => {
    if (!checkInModal || !user) return;
    try {
      // Restrict full check-ins to the user's timezone-aware "today" only.
      const todayKey = formatDateLocal(new Date(), settings.timeZone);
      const isFarFuture = checkInModal.date > todayKey;

      // Only send the current user's entry to enforce ownership
      const ownEntry = checkInModal.entries[user.id];
      const ownEntries = ownEntry ? { [user.id]: ownEntry } : {};

      // For far-future dates, save the user's personal note so it appears in Upcoming Notes
      const ownComment = (checkInModal.entries[user.id]?.comment?.trim()) || "";
      if (isFarFuture) {
        if (ownComment) {
          await api.post("/api/checkins/notes", { date: checkInModal.date, content: ownComment });
        } else {
          // Note was cleared — delete the existing CheckInNote if one exists
          const existingNote = futureNotes.find(n => n.date === checkInModal.date && n.user.id === user.id);
          if (existingNote) {
            await api.delete("/api/checkins/notes", { noteId: existingNote.id });
          }
        }
        refreshFutureNotes();
        broadcastNotesUpdated();
      }

      await api.post("/api/checkins", { date: checkInModal.date, entries: ownEntries });

      // Auto-sync weight if sync toggle is enabled
      if (ownEntries[user.id]?.weight) {
        syncWeightFromLatestCheckin(user.id);
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
      await api.post("/api/checkins", { date: checkInModal.date, entries: { [user.id]: ownEntry } });

      // Auto-sync weight if sync toggle is enabled
      syncWeightFromLatestCheckin(user.id);

      const currentEntry = updatedEntries[user.id];
      if (currentEntry?.present) {
        // Check-in saved
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
    // Non-admin users can only toggle their own check-in
    if (!user || (!isAdmin && userId !== user.id)) return;
    // Update local row state
    setCheckInRows(prev => prev.map(row => {
      if (row.date !== date) return row;
      const entry = row.entries[userId] || { present: false, weight: "", comment: "" };
      return { ...row, entries: { ...row.entries, [userId]: { ...entry, present } } };
    }));

    // Auto-save
    try {
      const row = checkInRows.find(r => r.date === date);
      await api.post("/api/checkins", {
        date,
        entries: { [userId]: { present, weight: row?.entries[userId]?.weight || "", comment: row?.entries[userId]?.comment || "" } },
      });

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
      const changedRows: Array<{ date: string; entries: Record<string, { present: boolean; weight: string; comment: string }> }> = [];
      for (const row of filteredCheckInRows) {
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
        if (changed) changedRows.push({ date: row.date, entries });
      }

      if (changedRows.length > 0) {
        const saveResults = await Promise.allSettled(
          changedRows.map((row) => api.post("/api/checkins", { date: row.date, entries: row.entries }))
        );
        const failed = saveResults.find((result) => result.status === "rejected");
        if (failed) throw new Error("Failed to save one or more sect register rows");
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

  const visibleUserIds = useMemo(() => {
    if (!user) return new Set<string>();

    const friendIds = allUsers
      .map((u) => u.id)
      .filter((id) => id !== user.id);

    if (calendarScope === "mine") {
      return new Set([user.id]);
    }

    if (calendarScope === "friends") {
      return new Set(friendIds);
    }

    return new Set([user.id, ...friendIds]);
  }, [allUsers, calendarScope, user]);

  const filteredCheckInRows = useMemo(() => {
    if (!user) return checkInRows;

    return checkInRows
      .map((row) => {
        const scopedEntries = Object.fromEntries(
          Object.entries(row.entries).filter(([userId]) => visibleUserIds.has(userId))
        );

        return { date: row.date, entries: scopedEntries };
      })
      .filter((row) =>
        Object.values(row.entries).some((entry) => entry.present || entry.weight || entry.comment?.trim())
      );
  }, [checkInRows, user, visibleUserIds]);

  const userNameById = useMemo(() => {
    const names = new Map<string, string>();
    for (const u of allUsers) {
      names.set(u.id, u.name);
    }
    if (user && !names.has(user.id)) {
      names.set(user.id, user.name || user.username || "You");
    }
    return names;
  }, [allUsers, user]);

  const scopedCheckInTotalsByUser = useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of filteredCheckInRows) {
      for (const [userId, entry] of Object.entries(row.entries)) {
        if (!entry.present) continue;
        totals.set(userId, (totals.get(userId) ?? 0) + 1);
      }
    }
    return totals;
  }, [filteredCheckInRows]);

  const renderedCheckInRows = useMemo(() => {
    if (!user) return [];

    return filteredCheckInRows.map(({ date, entries }) => {
      const mine = entries[user.id] || { present: false, weight: "", comment: "" };
      const presentCount = Object.values(entries).reduce(
        (count, entry) => count + (entry.present ? 1 : 0),
        0,
      );

      const everyoneDetails = Object.entries(entries)
        .map(([userId, entry]) => ({
          id: userId,
          name: userNameById.get(userId) || "Unknown",
          present: entry.present,
          weight: entry.weight,
          totalCheckIns: scopedCheckInTotalsByUser.get(userId) ?? 0,
          comment: entry.comment?.trim() || "",
        }))
        .sort((a, b) => {
          if (a.present !== b.present) return a.present ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return {
        date,
        mine,
        mineWeight: mine.weight ? `${mine.weight} kg` : "-",
        presentCount,
        everyoneDetails,
      };
    });
  }, [filteredCheckInRows, scopedCheckInTotalsByUser, user, userNameById]);

  const visibleRenderedCheckInRows = useMemo(
    () => renderedCheckInRows.slice(0, displayCount),
    [displayCount, renderedCheckInRows],
  );

  const historyPreviewLimit = getCheckInHistoryPreviewLimit(true, historyViewMode);
  const hasMoreRows = displayCount < renderedCheckInRows.length;

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [calendarScope, historyViewMode]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || isLoadingMoreRows || !hasMoreRows) return;
        setIsLoadingMoreRows(true);
        window.setTimeout(() => {
          setDisplayCount((prev) => Math.min(prev + ITEMS_PER_PAGE, renderedCheckInRows.length));
          setIsLoadingMoreRows(false);
        }, 250);
      },
      { threshold: 0.1 }
    );

    const target = rowsObserverTargetRef.current;
    if (target) observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreRows, isLoadingMoreRows, renderedCheckInRows.length]);

  const scopedCheckInUsersByDate = useMemo(() => {
    const scoped = new Map<string, string[]>();
    for (const [date, users] of checkInUsersByDate.entries()) {
      const visibleUsers = users.filter((userId) => visibleUserIds.has(userId));
      if (visibleUsers.length > 0) {
        scoped.set(date, visibleUsers);
      }
    }
    return scoped;
  }, [checkInUsersByDate, visibleUserIds]);

  const scopedDayNotes = useMemo(() => {
    if (calendarScope === "mine") {
      return dayNotes;
    }

    const combined = new Map(dayNotes);
    for (const row of checkInRows) {
      const hasAnyComment = Object.values(row.entries).some((entry) => Boolean(entry.comment?.trim()));
      if (hasAnyComment && !combined.has(row.date)) {
        combined.set(row.date, "comment");
      }
    }

    return combined;
  }, [calendarScope, checkInRows, dayNotes]);

  const scopedFutureNotes = useMemo(() => {
    if (calendarScope === "mine") {
      return futureNotes.filter((note) => note.user.id === user?.id);
    }

    const today = formatDateLocal(new Date(), settings.timeZone);
    const allCommentNotes = checkInRows.flatMap((row) => {
      if (row.date <= today) return [];

      return Object.entries(row.entries)
        .filter(([, entry]) => Boolean(entry.comment?.trim()))
        .map(([userId, entry]) => {
          const noteUser = allUsers.find((candidate) => candidate.id === userId);
          return {
            id: `${row.date}-${userId}`,
            date: row.date,
            content: entry.comment.trim(),
            pinned: false,
            createdAt: `${row.date}T00:00:00.000Z`,
            user: {
              id: userId,
              name: noteUser?.name || "Unknown",
              username: noteUser?.username || "unknown",
            },
          };
        });
    });

    return allCommentNotes.sort((a, b) => a.date.localeCompare(b.date));
  }, [allUsers, calendarScope, checkInRows, futureNotes, settings.timeZone, user?.id]);

  const useMobileTableStyling = true;
  const compactSectRegister = useMobileTableStyling && !isSectEditMode && !isAdmin;

  const getRowCommentSummary = useCallback(
    (row: CheckInRow): string => {
      if (!isAdmin) {
        return (user?.id ? row.entries[user.id]?.comment : "") || "";
      }

      const comments = allUsers
        .map((u) => {
          const text = row.entries[u.id]?.comment?.trim();
          return text ? `${u.name}: ${text}` : null;
        })
        .filter((value): value is string => Boolean(value));

      return comments.join(" | ");
    },
    [allUsers, isAdmin, user?.id]
  );

  const sectRegisterGridTemplateColumns = useMemo(
    () => `${isSectEditMode ? '104px' : '80px'} repeat(${allUsers.length}, 44px) ${compactSectRegister ? '72px' : `repeat(${allUsers.length}, 48px)`} minmax(180px, 1fr)`,
    [allUsers.length, compactSectRegister, isSectEditMode]
  );

  const sectRegisterMinWidth = useMemo(() => {
    const dateCol = isSectEditMode ? 104 : 80;
    const checkCols = allUsers.length * 44;
    const weightCols = compactSectRegister ? 72 : allUsers.length * 48;
    const commentsCol = 180;
    return `${dateCol + checkCols + weightCols + commentsCol}px`;
  }, [allUsers.length, compactSectRegister, isSectEditMode]);

  const daoHallDataQuery = useQuery({
    queryKey: ["dao-hall-data", user?.id, settings.timeZone],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      const apiScope = "friends";
      const [checkinsData, usersData, exerciseData, futureNotesData] = await Promise.all([
        api.get<{ checkins: Array<{ date: string; userId: string; present: boolean; weight?: number; comment?: string }> }>(`/api/checkins?scope=${apiScope}`),
        api.get<{ users: User[] }>(`/api/users/public?scope=${apiScope}`),
        api.get<{ exercises: unknown[] }>("/api/exercises"),
        api.get<{ notes: CommunityNote[] }>(`/api/checkins/notes?future=true&scope=${apiScope}&today=${formatDateLocal(new Date(), settings.timeZone)}`),
      ]);

      return { checkinsData, usersData, exerciseData, futureNotesData };
    },
  });

  useEffect(() => {
    setLoading(daoHallDataQuery.isLoading);
  }, [daoHallDataQuery.isLoading]);

  useEffect(() => {
    if (!user || !daoHallDataQuery.data) return;

    const { checkinsData, usersData, exerciseData, futureNotesData } = daoHallDataQuery.data;

    setFutureNotes(futureNotesData.notes || []);
    setAllUsers(usersData.users || []);
    setUserColors(
      Object.fromEntries(
        (usersData.users || []).map((u) => [
          u.id,
          normalizeCultivatorColor(u.cultivatorColor || getDeterministicCultivatorColor(u.id)),
        ]),
      ),
    );

    const usersByDate = new Map<string, string[]>();
    const userCheckInDates = new Set<string>();
    const grouped: Record<string, CheckInRow["entries"]> = {};

    const visibleUserIds = new Set((usersData.users || []).map((u) => u.id));

    for (const checkin of checkinsData.checkins || []) {
      if (!visibleUserIds.has(checkin.userId)) continue;
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

    const currentUser = (usersData.users || []).find((candidate: { id: string; sessionCount?: number }) => candidate.id === user.id);

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

    setStats({
      sessions: currentUser?.sessionCount ?? 0,
      techniques: exerciseData.exercises?.length || 0,
      streak,
    });
  }, [daoHallDataQuery.data, user]);

  useEffect(() => {
    if (!daoHallDataQuery.error) return;
    console.error("Failed to fetch dashboard data:", daoHallDataQuery.error);
  }, [daoHallDataQuery.error]);

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

  useEffect(() => {
    if (!user?.id) return;
    void queryClient.invalidateQueries({ queryKey: ["dao-hall-data", user.id] });
  }, [calendarScope, queryClient, user?.id]);

  if (!user) return null;

  const controlButtonBase = "theme-control-btn rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors";
  const activeControlButton = `${controlButtonBase} theme-control-btn-active`;
  const inactiveControlButton = controlButtonBase;
  const historySurfaceClass = "rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] shadow-[0_10px_20px_rgba(0,0,0,0.22)]";

  return (
    <PageLayout
      title="Dao Hall"
      subtitle="The spiritual center of your cultivation journey"
      mobileContentPaddingClass="p-2 pb-24"
      contentMaxWidthClass="max-w-[1220px]"
    >
      {loading ? (
        <PageSkeleton statCards={4} wideBlock rows={3} />
      ) : (
        <div className="dao-modern-page space-y-4 px-0 py-2 sm:py-3">
          {/* Upcoming Notes */}
          {scopedFutureNotes.length > 0 && (
            <GlowCard glow="none" hoverable={false} className={historySurfaceClass}>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--text-primary)]">Upcoming Notes</h4>
                  <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-2 py-0.5 text-[9px] font-medium text-[color:var(--text-secondary)]">{scopedFutureNotes.length}</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {scopedFutureNotes.map((note) => {
                    const noteColor = getUserCultivatorColor(note.user.id, userColors);
                    return (
                      <button
                        key={note.id}
                        onClick={() => handleDayClick(note.date)}
                        className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-2 text-left transition-colors duration-200 hover:bg-[color:var(--surface-hover)]"
                        title="Jump to this date"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full shadow-lg"
                            style={{ backgroundColor: noteColor, boxShadow: `0 0 6px ${getCultivatorGlowColor(noteColor, 0.6)}` }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="mb-0.5 flex items-center gap-1.5">
                              <span className="truncate text-[11px] font-semibold" style={{ color: noteColor }}>{note.user.name}</span>
                              <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-1.5 py-0.5 text-[9px] text-[color:var(--text-muted)]">
                                {formatDateWithPreference(note.date, dateFormat)}
                              </span>
                            </div>
                            <p className="line-clamp-2 text-[10px] leading-relaxed text-[color:var(--text-secondary)]">{note.content}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </GlowCard>
          )}

          {/* Calendar — always visible */}
          <div className="grid grid-cols-1 gap-4 dao-modern-grid"> 
            <div className="min-w-0 dao-modern-calendar-wrap">
              <Calendar
                checkInUsersByDate={scopedCheckInUsersByDate}
                currentMonth={currentMonth}
                setCurrentMonth={setCurrentMonth}
                dayNotes={scopedDayNotes}
                futureNoteDates={new Set(scopedFutureNotes.map((n) => n.date))}
                onDayClick={handleDayClick}
                allUsers={allUsers}
                userColors={userColors}
                upcomingNotes={[]}
                dateFormat={dateFormat}
                timeZone={settings.timeZone}
                calendarWeekStart={settings.calendarWeekStart}
                onManageNotes={undefined}
                forceCompact
              />
            </div>

          </div>

          {/* Check-In Feed — clean scrolling timeline */}
          <GlowCard glow="none" hoverable={false} className={`dao-modern-cultivation-view ${historySurfaceClass}`}>
            <div ref={sectRegisterRef} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-[color:var(--text-primary)]">{t("Check-In History", "normal")}</h3>
                  <p className="mt-1 text-xs text-[color:var(--text-secondary)]">
                    {t("All recorded check-ins, displayed in the same cleaner history style as the train log.", "normal")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 lg:ml-auto">
                  <span className="rounded-md border border-[color:var(--border)] bg-[color:var(--surface-hover)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--text-secondary)]">
                    {renderedCheckInRows.length} {t("entries", "normal")}
                  </span>
                  <div className="relative" ref={historyViewMenuRef}>
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={isHistoryViewMenuOpen}
                      onClick={() => setIsHistoryViewMenuOpen((prev) => !prev)}
                      className={`${historyViewMode === "compact" ? activeControlButton : inactiveControlButton} inline-flex items-center gap-1.5`}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.7]">
                        <path d="M1.75 10s3-5.25 8.25-5.25S18.25 10 18.25 10s-3 5.25-8.25 5.25S1.75 10 1.75 10Z" />
                        <circle cx="10" cy="10" r="2.5" />
                      </svg>
                      <span>{t("View", "normal")}</span>
                    </button>

                    {isHistoryViewMenuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 top-full z-20 mt-2 min-w-[170px] rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-1.5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                      >
                        {([
                          { id: "detailed", label: "Detailed" },
                          { id: "compact", label: "Compact" },
                        ] as const).map((option) => {
                          const active = historyViewMode === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="menuitemradio"
                              aria-checked={active}
                              onClick={() => {
                                setHistoryViewMode(option.id);
                                setIsHistoryViewMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-[11px] transition-colors ${active ? "bg-[color:var(--ring-accent)] text-[color:var(--text-primary)]" : "text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--text-primary)]"}`}
                            >
                              <span>{t(option.label, "normal")}</span>
                              {active ? <span className="text-[color:var(--accent)]">✓</span> : null}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {(["all", "mine", "friends"] as const).map((scope) => {
                    const active = calendarScope === scope;
                    return (
                      <button
                        key={scope}
                        type="button"
                        onClick={() => setCalendarScope(scope)}
                        className={active ? activeControlButton : inactiveControlButton}
                      >
                        {t(scope === "all" ? "All" : scope === "mine" ? "Mine" : "Friends", "normal")}
                      </button>
                    );
                  })}
                </div>
              </div>

              {renderedCheckInRows.length === 0 ? (
                <div className="flex flex-col items-center rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] py-10 text-center">
                  <div className="mb-2 text-2xl opacity-30">🧭</div>
                  <p className="text-xs text-[color:var(--text-secondary)]">{t("No entries for this view", "normal")}</p>
                  <p className="mt-1 text-[10px] text-[color:var(--text-muted)]">{t("Start checking in to build your history timeline", "normal")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRenderedCheckInRows.map(({ date, mine, mineWeight, presentCount, everyoneDetails }) => {
                      const hasCheckin = calendarScope === "mine" ? mine.present : presentCount > 0;

                      return (
                        <article
                          key={date}
                          className="cursor-pointer rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2.5 shadow-[0_6px_14px_rgba(0,0,0,0.12)] transition-colors hover:bg-[color:var(--surface-hover)]"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleDayClick(date)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleDayClick(date);
                            }
                          }}
                        >
                          {historyViewMode !== "compact" && (
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className="text-sm font-semibold leading-tight"
                                style={{ color: hasCheckin ? "var(--jade-light)" : "var(--cloud-white)" }}
                              >
                                {formatDateWithPreference(date, dateFormat)}
                              </p>
                              <span className="shrink-0 text-[11px]" style={{ color: "var(--text-muted)" }}>
                                {formatRelativeRecentDate(date)}
                              </span>
                            </div>
                          )}

                          <div
                            className={`${historyViewMode === "compact" ? "mt-0" : "mt-1.5"} space-y-0.5 text-[11px] leading-relaxed`}
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {calendarScope === "mine" ? (
                              historyViewMode === "compact" ? (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                  <span className="shrink-0 text-[11px] font-semibold" style={{ color: hasCheckin ? "var(--jade-light)" : "var(--cloud-white)" }}>
                                    {formatDateWithPreference(date, dateFormat)}
                                  </span>
                                  <span className="truncate">
                                    {getDetailLabelVisibility(historyViewMode, "Name:") ? (
                                      <span style={{ color: "var(--text-muted)" }}>{t("Name:", "normal")}</span>
                                    ) : null}{" "}
                                    <span style={{ color: "var(--cloud-white)" }}>{t("You", "normal")}</span>
                                  </span>
                                  <span className="truncate" style={{ color: mine.present ? "var(--forest)" : "var(--gold-glow)" }}>
                                    {mine.present ? t("In", "normal") : t("Rest", "normal")}
                                  </span>
                                  <span className="truncate" style={{ color: mineWeight === "-" ? "var(--gold-glow)" : "var(--mountain-blue-glow)" }}>
                                    {mineWeight === "-" ? "-" : mineWeight}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate" style={{ color: mine.comment?.trim() ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                    {mine.comment?.trim() || "-"}
                                  </span>
                                </div>
                              ) : (
                                <>
                                  <div className="grid grid-cols-2 gap-x-3">
                                    <div className="min-w-0 truncate">
                                      <span style={{ color: "var(--text-muted)" }}>{t("Status:", "normal")}</span>{" "}
                                      <span style={{ color: mine.present ? "var(--forest)" : "var(--gold-glow)" }}>
                                        {mine.present ? t("In", "normal") : t("Rest", "normal")}
                                      </span>
                                    </div>
                                    <div className="min-w-0 truncate">
                                      <span style={{ color: "var(--text-muted)" }}>{t("Weight:", "normal")}</span>{" "}
                                      <span style={{ color: mineWeight === "-" ? "var(--gold-glow)" : "var(--mountain-blue-glow)" }}>
                                        {mineWeight === "-" ? "-" : mineWeight}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="grid grid-cols-1 gap-x-3">
                                    <div className="min-w-0 truncate">
                                      <span style={{ color: "var(--text-muted)" }}>{t("Notes:", "normal")}</span>{" "}
                                      <span style={{ color: "var(--text-secondary)" }}>{mine.comment?.trim() || "-"}</span>
                                    </div>
                                  </div>
                                </>
                              )
                            ) : (
                              <>
                                {everyoneDetails.slice(0, historyPreviewLimit).map((detail, detailIndex) => {
                                  const c = getUserCultivatorColor(detail.id, userColors);
                                  return (
                                    <div
                                      key={detail.id}
                                      className="space-y-0.5"
                                      style={{
                                        borderTop: detailIndex === 0 ? "none" : "1px solid color-mix(in srgb, var(--ink-light) 48%, transparent)",
                                        paddingTop: detailIndex === 0 ? 0 : "0.35rem",
                                        marginTop: detailIndex === 0 ? 0 : "0.35rem",
                                      }}
                                    >
                                      {historyViewMode === "compact" ? (
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                          {detailIndex === 0 ? (
                                            <span className="shrink-0 text-[11px] font-semibold" style={{ color: hasCheckin ? "var(--jade-light)" : "var(--cloud-white)" }}>
                                              {formatDateWithPreference(date, dateFormat)}
                                            </span>
                                          ) : null}
                                          <span className="min-w-0 truncate">
                                            {getDetailLabelVisibility(historyViewMode, "Name:") ? (
                                              <span style={{ color: "var(--text-muted)" }}>{t("Name:", "normal")}</span>
                                            ) : null}{" "}
                                            <span style={{ color: c }}>{detail.name}</span>
                                          </span>
                                          <span className="truncate" style={{ color: detail.weight ? "var(--mountain-blue-glow)" : "var(--gold-glow)" }}>
                                            {detail.weight ? `${detail.weight} kg` : "-"}
                                          </span>
                                          <span className="truncate" style={{ color: detail.present ? "var(--forest)" : "var(--text-secondary)" }}>
                                            {detail.present ? t("In", "normal") : t("Rest", "normal")}
                                          </span>
                                          <span className="min-w-0 flex-1 truncate" style={{ color: detail.comment ? "var(--text-secondary)" : "var(--text-muted)" }}>
                                            {detail.comment || "-"}
                                          </span>
                                        </div>
                                      ) : (
                                        <>
                                          <div className="grid grid-cols-2 gap-x-3">
                                            <div className="min-w-0 truncate">
                                              <span style={{ color: "var(--text-muted)" }}>{t("Name:", "normal")}</span>{" "}
                                              <span style={{ color: c }}>{detail.name}</span>
                                            </div>
                                            <div className="min-w-0 grid grid-cols-2 gap-x-3">
                                              <span className="truncate" style={{ color: detail.weight ? "var(--mountain-blue-glow)" : "var(--gold-glow)" }}>
                                                <span style={{ color: "var(--text-muted)" }}>{t("Weight:", "normal")}</span>{" "}
                                                {detail.weight ? `${detail.weight} kg` : "-"}
                                              </span>
                                              <span className="truncate" style={{ color: detail.present ? "var(--forest)" : "var(--text-secondary)" }}>
                                                <span style={{ color: "var(--text-muted)" }}>{t("Status:", "normal")}</span>{" "}
                                                {detail.present ? t("In", "normal") : t("Rest", "normal")}
                                              </span>
                                            </div>
                                          </div>
                                          <div className="grid grid-cols-1 gap-x-3">
                                            <div className="min-w-0 truncate">
                                              <span style={{ color: "var(--text-muted)" }}>{t("Notes:", "normal")}</span>{" "}
                                              <span style={{ color: "var(--text-secondary)" }}>{detail.comment || "-"}</span>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                                {everyoneDetails.length > historyPreviewLimit && (
                                  <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                                    +{everyoneDetails.length - historyPreviewLimit} {t("more people", "normal")}
                                  </p>
                                )}
                              </>
                            )}
                          </div>
                        </article>
                      );
                  })}

                  {(hasMoreRows || isLoadingMoreRows) && (
                    <div ref={rowsObserverTargetRef} className="flex justify-center px-3 py-2">
                      <span className="text-[11px] text-[color:var(--text-muted)]">
                        {isLoadingMoreRows ? t("Loading more rows...", "normal") : t("Scroll for more", "normal")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </GlowCard>
        </div>
      )}
      <GlowModal
        isOpen={!!checkInModal}
        onClose={() => { setCheckInModal(null); }}
        title={`Day Check-In — ${checkInModal ? formatDateWithPreference(checkInModal.date, dateFormat) : ""}`}
        hideHeader
        panelClassName="!max-w-[34rem] !max-h-[88vh] !overflow-hidden"
        contentClassName="!p-0"
      >
        {checkInModal && (() => {
          const todayKey = formatDateLocal(new Date(), settings.timeZone);
          const isFarFuture = checkInModal.date > todayKey;
          const currentUserEntry = user?.id
            ? (checkInModal.entries[user.id] || { present: false, weight: "", comment: "" })
            : { present: false, weight: "", comment: "" };
          const checkedInUsers = allUsers.filter((u) => checkInModal.entries[u.id]?.present);
          const hasExistingFutureNote = Boolean(
            user?.id && futureNotes.some((n) => n.date === checkInModal.date && n.user.id === user.id)
          );

          return (
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 56%, transparent)",
                backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--cloud-white) 3%, transparent), 0 14px 30px rgba(0,0,0,0.28)",
              }}
            >
              <div
                className="border-b px-3.5 py-3"
                style={{ borderBottomColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--accent)]">Training Canvas</p>
                    <h2 className="mt-1 truncate text-[16px] font-semibold text-[color:var(--text-primary)]">Day Check-In</h2>
                    <p className="mt-1 text-[12px] text-[color:var(--text-secondary)]">
                      {formatDateWithPreference(checkInModal.date, dateFormat)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-md border px-2 py-1 text-[10px] font-semibold"
                      style={{
                        borderColor: isFarFuture
                          ? "color-mix(in srgb, var(--gold) 50%, transparent)"
                          : currentUserEntry.present
                            ? "color-mix(in srgb, var(--forest) 52%, transparent)"
                            : "color-mix(in srgb, var(--accent) 52%, transparent)",
                        backgroundColor: isFarFuture
                          ? "color-mix(in srgb, var(--gold) 12%, transparent)"
                          : currentUserEntry.present
                            ? "color-mix(in srgb, var(--forest) 12%, transparent)"
                            : "color-mix(in srgb, var(--accent) 14%, transparent)",
                        color: isFarFuture ? "var(--gold-glow)" : currentUserEntry.present ? "var(--cloud-white)" : "var(--text-primary)",
                      }}
                    >
                      {isFarFuture ? "Note Only" : currentUserEntry.present ? "Checked In" : "Ready"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setCheckInModal(null)}
                      aria-label="Close dialog"
                      className="flex h-8 w-8 items-center justify-center rounded-md border text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 54%, transparent)",
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>

              <div
                className="max-h-[calc(88vh-4.25rem)] overflow-y-auto px-3.5 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y" }}
              >
                <div className="space-y-3">
                  {isFarFuture ? (
                    <div
                      className="rounded-lg border px-3 py-2 text-[11px]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--gold) 50%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--gold) 10%, transparent)",
                        color: "var(--gold-glow)",
                      }}
                    >
                      Future days only support a personal note. Full check-in is available on the day itself.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-md border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))" }}>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Status</p>
                        <p className="mt-1 text-[12px] font-semibold text-[color:var(--text-primary)]">{currentUserEntry.present ? "In" : "Open"}</p>
                      </div>
                      <div className="rounded-md border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))" }}>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Weight</p>
                        <p className="mt-1 text-[12px] font-semibold text-[color:var(--text-primary)]">{currentUserEntry.weight || "--"}</p>
                      </div>
                      <div className="rounded-md border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--ink-light) 50%, transparent)", backgroundColor: "color-mix(in srgb, var(--ink-mid) 62%, var(--ink-deep))" }}>
                        <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Present</p>
                        <p className="mt-1 text-[12px] font-semibold text-[color:var(--text-primary)]">{checkedInUsers.length}</p>
                      </div>
                    </div>
                  )}

                  {!isFarFuture && user?.id ? (
                    <section
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Today’s check-in</p>
                      <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Logging training for the day will also count toward attendance.</p>
                      <button
                        type="button"
                        onClick={() => updateCheckInModalEntry(user.id, "present", !currentUserEntry.present)}
                        className="mt-3 w-full rounded-lg border px-3 py-2.5 text-[12px] font-semibold transition-colors"
                        style={{
                          borderColor: currentUserEntry.present
                            ? "color-mix(in srgb, var(--forest) 52%, transparent)"
                            : "color-mix(in srgb, var(--accent) 52%, transparent)",
                          backgroundColor: currentUserEntry.present
                            ? "color-mix(in srgb, var(--forest) 12%, transparent)"
                            : "color-mix(in srgb, var(--accent) 14%, transparent)",
                          color: currentUserEntry.present ? "var(--cloud-white)" : "var(--text-primary)",
                        }}
                      >
                        {currentUserEntry.present ? "✓ Checked In" : "Mark Check-In"}
                      </button>
                    </section>
                  ) : null}

                  {!isFarFuture && user?.id ? (
                    <section
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                      }}
                    >
                      <label className="block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Body weight</label>
                      <input
                        type="number"
                        placeholder="Weight in kg"
                        value={currentUserEntry.weight}
                        onChange={(e) => updateCheckInModalEntry(user.id, "weight", e.target.value)}
                        className="mt-2 w-full rounded-md border px-3 py-2 text-[12px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                        style={{
                          borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
                        }}
                        min="0"
                        max="500"
                        step="0.1"
                      />
                    </section>
                  ) : null}

                  <section
                    className="rounded-xl border p-3"
                    style={{
                      borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                      backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                    }}
                  >
                    <label className="block text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Personal note</label>
                    <p className="mt-1 text-[11px] text-[color:var(--text-secondary)]">Keep it short and relevant to the day.</p>
                    <textarea
                      placeholder="Add a short note for this day"
                      value={user?.id ? checkInModal.entries[user.id]?.comment || "" : ""}
                      onChange={(e) => {
                        if (user?.id) {
                          updateCheckInModalEntry(user.id, "comment", e.target.value);
                        }
                      }}
                      rows={4}
                      className="mt-2 w-full resize-none rounded-md border px-3 py-2 text-[12px] text-[color:var(--text-primary)] outline-none placeholder:text-[color:var(--text-muted)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 58%, var(--ink-deep))",
                      }}
                    />
                  </section>

                  {!isFarFuture && checkedInUsers.length > 0 ? (
                    <section
                      className="rounded-xl border p-3"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 48%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-deep) 90%, var(--ink-mid))",
                      }}
                    >
                      <p className="text-[10px] uppercase tracking-[0.1em] text-[color:var(--text-muted)]">Checked in today</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {checkedInUsers.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[11px] text-[color:var(--text-secondary)]"
                            style={{
                              borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                              backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, transparent)",
                            }}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: getUserCultivatorColor(u.id, userColors) }}
                            />
                            {u.id === user?.id ? "You" : u.name}
                          </span>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              </div>

              <div
                className="border-t px-3.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.85rem)]"
                style={{
                  borderTopColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                  backgroundColor: "color-mix(in srgb, var(--ink-deep) 94%, var(--ink-mid))",
                }}
              >
                {isFarFuture ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckInModal(null)}
                      className="flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold text-[color:var(--text-secondary)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, transparent)",
                      }}
                    >
                      Close
                    </button>
                    {hasExistingFutureNote ? (
                      <button
                        type="button"
                        onClick={async () => {
                          const existingNote = futureNotes.find((n) => n.date === checkInModal.date && n.user.id === user?.id);
                          if (existingNote && user?.id) {
                            await api.delete("/api/checkins/notes", { noteId: existingNote.id });
                            await api.post("/api/checkins", {
                              date: checkInModal.date,
                              entries: { [user.id]: { present: false, weight: "", comment: "" } },
                            });
                            refreshFutureNotes();
                            broadcastNotesUpdated();
                            updateCheckInModalEntry(user.id, "comment", "");
                            setCheckInRows((prev) => {
                              return prev.map((r) => {
                                if (r.date !== checkInModal.date) return r;
                                const updatedEntries = { ...r.entries };
                                if (updatedEntries[user.id]) {
                                  updatedEntries[user.id] = { ...updatedEntries[user.id], comment: "" };
                                }
                                const hasData = Object.values(updatedEntries).some(
                                  (e) => e.present || e.weight || e.comment?.trim()
                                );
                                if (!hasData) return null;
                                return { ...r, entries: updatedEntries };
                              }).filter(Boolean) as typeof prev;
                            });
                          }
                        }}
                        className="flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold text-[color:var(--danger-hover)]"
                        style={{
                          borderColor: "color-mix(in srgb, var(--danger) 46%, transparent)",
                          backgroundColor: "color-mix(in srgb, var(--danger) 12%, transparent)",
                        }}
                      >
                        Clear
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={handleSaveCheckIn}
                      className="flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold text-[color:var(--cloud-white)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 56%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--accent) 82%, transparent)",
                        boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 24%, transparent)",
                      }}
                    >
                      Save Note
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setCheckInModal(null)}
                      className="flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold text-[color:var(--text-secondary)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--ink-light) 44%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 52%, transparent)",
                      }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCheckIn}
                      className="flex-1 rounded-md border px-3 py-2.5 text-sm font-semibold text-[color:var(--cloud-white)]"
                      style={{
                        borderColor: "color-mix(in srgb, var(--accent) 56%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--accent) 82%, transparent)",
                        boxShadow: "0 8px 18px color-mix(in srgb, var(--accent) 24%, transparent)",
                      }}
                    >
                      Save Check-In
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
      </GlowModal>

      {/* Weight Prompt Modal */}
      <GlowModal
        isOpen={showWeightPrompt}
        onClose={() => { setShowWeightPrompt(false); setWeightPromptValue(""); }}
        title="⚖️ Log Your Weight"
      >
        <div className="space-y-5">
          <p className="text-xs text-[color:var(--text-secondary)]">
            You haven&apos;t logged your weight for this check-in. Tracking your weight helps monitor your cultivation progress.
          </p>
          <div>
            <label className="mb-2 block text-[10px] uppercase tracking-wider text-[color:var(--text-primary)]">Body Weight (kg)</label>
            <input
              type="number"
              placeholder="Enter your weight..."
              value={weightPromptValue}
              onChange={(e) => setWeightPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && weightPromptValue) handleWeightPromptSubmit();
              }}
              className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-4 text-center text-lg font-medium text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] outline-none transition-colors focus:border-[color:var(--accent)]"
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
            className="w-full py-2 text-center text-[11px] text-[color:var(--text-muted)] transition-colors hover:text-[color:var(--text-primary)]"
          >
            Don&apos;t remind me today
          </button>
        </div>
      </GlowModal>

    </PageLayout>
  );
}
