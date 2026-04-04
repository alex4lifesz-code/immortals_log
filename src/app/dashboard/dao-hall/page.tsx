"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { GlowModal } from "@/components/ui/GlowCard";
import dynamic from "next/dynamic";

const MonthlyComparisonChart = dynamic(() => import("@/components/dashboard/MonthlyComparisonChart"), { ssr: false });
const WeightTrendChart = dynamic(() => import("@/components/dashboard/WeightTrendChart"), { ssr: false });
const CheckInStatsPanel = dynamic(() => import("@/components/dashboard/CheckInStatsPanel"), { ssr: false });
import ChartUserFilter from "@/components/dashboard/ChartUserFilter";
import PageLayout from "@/components/layout/PageLayout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useIsMobile } from "@/context/AppContext";
import { formatDateWithPreference } from "@/lib/constants";
import { syncWeightFromLatestCheckin } from "@/lib/user-physique";
import { api } from "@/lib/api-client";
import {
  DashboardSidebar,
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

export default function DaoHallPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings } = useDisplaySettings();
  const isMobile = useIsMobile();
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
  const [chartUserIds, setChartUserIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try { const v = localStorage.getItem("dao-chart-users"); return v ? JSON.parse(v) : []; } catch { return []; }
  });
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMoreRows, setIsLoadingMoreRows] = useState(false);
  // Initialise chart user filter to current user (fallback if nothing saved)
  useEffect(() => {
    if (user && chartUserIds.length === 0) setChartUserIds([user.id]);
  }, [user, chartUserIds.length]);

  // Persist chart user selection
  useEffect(() => {
    if (chartUserIds.length > 0) {
      try { localStorage.setItem("dao-chart-users", JSON.stringify(chartUserIds)); } catch {}
    }
  }, [chartUserIds]);

  const chartUserNames = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of allUsers) m[u.id] = u.name;
    return m;
  }, [allUsers]);

  const effectiveChartUserIds = useMemo(() => {
    const validUserIds = new Set(allUsers.map((u) => u.id));
    const filtered = chartUserIds.filter((id) => validUserIds.has(id));
    if (filtered.length > 0) return filtered;
    if (user?.id && validUserIds.has(user.id)) return [user.id];
    return [];
  }, [allUsers, chartUserIds, user?.id]);

  useEffect(() => {
    if (!user) return;
    const validUserIds = new Set(allUsers.map((u) => u.id));

    setChartUserIds((prev) => {
      const filtered = prev.filter((id) => validUserIds.has(id));
      const fallback = validUserIds.has(user.id) ? [user.id] : [];
      const next = filtered.length > 0 ? filtered : fallback;
      if (next.length === prev.length && next.every((id, index) => id === prev[index])) {
        return prev;
      }
      return next;
    });
  }, [allUsers, user]);

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
  const [statsTabOpen, setStatsTabOpen] = useState(false);
  const [chartsOpen, setChartsOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    try { return localStorage.getItem("dao-charts-open") !== "false"; } catch { return true; }
  });
  const [cultivationViewOpen, setCultivationViewOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem("dao-cultivation-open") === "true"; } catch { return false; }
  });

  // Persist charts toggle
  useEffect(() => {
    try { localStorage.setItem("dao-charts-open", String(chartsOpen)); } catch {}
  }, [chartsOpen]);

  // Persist cultivation view open toggle
  useEffect(() => {
    try { localStorage.setItem("dao-cultivation-open", String(cultivationViewOpen)); } catch {}
  }, [cultivationViewOpen]);
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
  const [isSectEditMode, setIsSectEditMode] = useState(false);
  const [sectEditData, setSectEditData] = useState<Record<string, Record<string, { weight: string; comment: string }>>>({});
  const [deletingRowDate, setDeletingRowDate] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dao-hall-calendar-scope", calendarScope);
  }, [calendarScope]);

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
      const todayStr = formatDateLocal(new Date());
      const apiScope = "friends";
      const data = await api.get<{ notes: CommunityNote[] }>(`/api/checkins/notes?future=true&scope=${apiScope}&today=${todayStr}`);
      setFutureNotes(data.notes || []);
    } catch (err) {
      console.error("Failed to fetch future notes:", err);
    }
  }, []);

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
    const selectedDate = new Date(`${dateStr}T00:00:00`);
    setCurrentMonth(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1));

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
  }, [filteredCheckInRows, user, userNameById]);

  const visibleRenderedCheckInRows = useMemo(
    () => renderedCheckInRows.slice(0, displayCount),
    [displayCount, renderedCheckInRows],
  );

  const hasMoreRows = displayCount < renderedCheckInRows.length;

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [calendarScope]);

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

    const today = formatDateLocal(new Date());
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
  }, [allUsers, calendarScope, checkInRows, futureNotes, user?.id]);

  const useMobileTableStyling = isMobile;
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
    queryKey: ["dao-hall-data", user?.id],
    enabled: Boolean(user?.id),
    staleTime: 30_000,
    queryFn: async () => {
      const apiScope = "friends";
      const [checkinsData, usersData, exerciseData, futureNotesData] = await Promise.all([
        api.get<{ checkins: Array<{ date: string; userId: string; present: boolean; weight?: number; comment?: string }> }>(`/api/checkins?scope=${apiScope}`),
        api.get<{ users: User[] }>(`/api/users/public?scope=${apiScope}`),
        api.get<{ exercises: unknown[] }>("/api/exercises"),
        api.get<{ notes: CommunityNote[] }>(`/api/checkins/notes?future=true&scope=${apiScope}&today=${formatDateLocal(new Date())}`),
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
        <div className="space-y-2 px-0 py-2 sm:py-3">
          {/* Upcoming Notes */}
          {scopedFutureNotes.length > 0 && (
            <div className="w-full border bg-ink-dark/20 p-4" style={{ borderColor: "var(--border)" }}>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs text-gold-glow uppercase tracking-wide font-semibold">Upcoming Notes</h4>
                  <span className="text-[9px] text-gold-glow bg-gold-dim/20 px-2 py-0.5 rounded-full font-medium">{scopedFutureNotes.length}</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {scopedFutureNotes.map((note) => {
                    const noteColor = getUserCultivatorColor(note.user.id, userColors);
                    return (
                      <button
                        key={note.id}
                        onClick={() => handleDayClick(note.date)}
                        className="w-full text-left p-2 border border-ink-light/45 bg-ink-dark/20 hover:bg-ink-mid/20 hover:border-gold-dim/45 transition-all duration-200"
                        title="Jump to this date"
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className="w-2 h-2 rounded-full shrink-0 mt-1.5 shadow-lg"
                            style={{ backgroundColor: noteColor, boxShadow: `0 0 6px ${getCultivatorGlowColor(noteColor, 0.6)}` }}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[11px] font-semibold truncate" style={{ color: noteColor }}>{note.user.name}</span>
                              <span className="text-[9px] text-mist-mid bg-ink-mid/40 px-1.5 py-0.5 rounded">
                                {formatDateWithPreference(note.date, dateFormat)}
                              </span>
                            </div>
                            <p className="text-[10px] text-mist-light leading-relaxed line-clamp-2">{note.content}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Calendar — always visible */}
          <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
            <div className="min-w-0">
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
                onManageNotes={undefined}
                forceCompact
              />
            </div>

            {/* Stats panel — always visible beside calendar on desktop */}
            {!isMobile && (
              <div
                className="border bg-ink-dark/20 p-3 flex flex-col min-h-[260px]"
                style={{ borderColor: "var(--border)" }}
              >
                {user && effectiveChartUserIds.length > 0 && (
                  <CheckInStatsPanel
                    checkInRows={checkInRows}
                    currentMonth={currentMonth}
                    selectedUserIds={effectiveChartUserIds}
                    userNames={chartUserNames}
                    userColors={userColors}
                    currentUserId={user.id}
                  />
                )}
              </div>
            )}
          </div>

          {/* Charts + cultivation stats are desktop-only */}
          {!isMobile && (
            <div
              className="flex items-center gap-3 border px-3 py-2"
              style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  role="switch"
                  aria-checked={chartsOpen}
                  onClick={() => setChartsOpen((prev) => !prev)}
                  className="inline-flex items-center gap-2 border px-2.5 py-1 text-xs font-medium transition-colors"
                  style={{
                    borderColor: chartsOpen ? "var(--jade-glow)" : "var(--border)",
                    color: chartsOpen ? "var(--jade-glow)" : "var(--text-secondary)",
                    backgroundColor: chartsOpen ? "rgba(0,255,128,0.06)" : "transparent",
                  }}
                >
                  <span>{chartsOpen ? "Hide Charts" : "Show Charts"}</span>
                  <span
                    className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                    style={{
                      backgroundColor: chartsOpen
                        ? "color-mix(in srgb, var(--jade-glow) 40%, transparent)"
                        : "color-mix(in srgb, var(--border) 55%, transparent)",
                    }}
                  >
                    <span
                      className="absolute h-3 w-3 rounded-full transition-all"
                      style={{
                        left: chartsOpen ? "16px" : "2px",
                        backgroundColor: chartsOpen ? "var(--jade-glow)" : "var(--text-muted)",
                      }}
                    />
                  </span>
                </button>

                {user && allUsers.length > 0 && (
                  <ChartUserFilter
                    currentUserId={user.id}
                    allUsers={allUsers}
                    selectedUserIds={effectiveChartUserIds}
                    onSelectionChange={setChartUserIds}
                    userColors={userColors}
                  />
                )}
              </div>
            </div>
          )}

          {!isMobile && chartsOpen && (
            <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
              {/* Monthly Comparison (last 6 months) */}
              <div
                className="border bg-ink-dark/20 p-3 flex flex-col min-h-[220px]"
                style={{ borderColor: "var(--border)" }}
              >
                {user && effectiveChartUserIds.length > 0 && (
                  <MonthlyComparisonChart
                    checkInRows={checkInRows}
                    currentMonth={currentMonth}
                    selectedUserIds={effectiveChartUserIds}
                    userNames={chartUserNames}
                    userColors={userColors}
                  />
                )}
              </div>

              {/* Weight Trend (all-time) */}
              <div
                className="border bg-ink-dark/20 p-3 flex flex-col min-h-[220px]"
                style={{ borderColor: "var(--border)" }}
              >
                {user && effectiveChartUserIds.length > 0 && (
                  <WeightTrendChart
                    checkInRows={checkInRows}
                    selectedUserIds={effectiveChartUserIds}
                    userNames={chartUserNames}
                    userColors={userColors}
                  />
                )}
              </div>
            </div>
          )}

          {/* User View — Personal cultivation history */}
          <div className="w-full border bg-ink-dark/20 p-4" style={{ borderColor: "var(--border)" }}>
            <div ref={sectRegisterRef} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-jade-glow">My Cultivation View</h3>
                <div className="flex items-center gap-2">
                  {!isMobile && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={cultivationViewOpen}
                      onClick={() => setCultivationViewOpen((prev) => !prev)}
                      className="inline-flex items-center gap-2 border px-2 py-1 text-[11px] transition-colors"
                      style={{
                        borderColor: cultivationViewOpen ? "color-mix(in srgb, var(--accent) 35%, var(--border))" : "var(--border)",
                        color: cultivationViewOpen ? "var(--accent)" : "var(--text-muted)",
                      }}
                      title={cultivationViewOpen ? "Full-width table" : "Fit-to-screen table"}
                    >
                      <span>Open</span>
                      <span
                        className="relative inline-flex h-4 w-8 items-center rounded-full transition-colors"
                        style={{
                          backgroundColor: cultivationViewOpen
                            ? "color-mix(in srgb, var(--accent) 40%, transparent)"
                            : "color-mix(in srgb, var(--border) 55%, transparent)",
                        }}
                      >
                        <span
                          className="absolute h-3 w-3 rounded-full transition-all"
                          style={{
                            left: cultivationViewOpen ? "16px" : "2px",
                            backgroundColor: cultivationViewOpen ? "var(--accent)" : "var(--text-muted)",
                          }}
                        />
                      </span>
                    </button>
                  )}
                  <div className="flex items-center gap-1 border border-ink-light/50 p-0.5">
                    <button
                      onClick={() => setCalendarScope("all")}
                      className={`text-xs px-2 py-1 transition-all ${
                        calendarScope === "all"
                          ? "bg-jade-deep/20 border border-jade/40 text-jade-light"
                          : "text-mist-light hover:text-jade-light"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCalendarScope("mine")}
                      className={`text-xs px-2 py-1 transition-all ${
                        calendarScope === "mine"
                          ? "bg-jade-deep/20 border border-jade/40 text-jade-light"
                          : "text-mist-light hover:text-jade-light"
                      }`}
                    >
                      Mine
                    </button>
                    <button
                      onClick={() => setCalendarScope("friends")}
                      className={`text-xs px-2 py-1 transition-all ${
                        calendarScope === "friends"
                          ? "bg-jade-deep/20 border border-jade/40 text-jade-light"
                          : "text-mist-light hover:text-jade-light"
                      }`}
                    >
                      Friends
                    </button>
                  </div>
                </div>
              </div>

              {renderedCheckInRows.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center border border-ink-light/40 bg-ink-mid/10">
                  <div className="text-2xl opacity-30 mb-2">🧭</div>
                  <p className="text-xs text-mist-dark">No entries for this view</p>
                  <p className="text-[10px] text-mist-dark/60 mt-1">Use the calendar above to check in and add notes</p>
                </div>
              ) : (
                isMobile ? (
                  <div className={`space-y-1.5 ${cultivationViewOpen ? "" : "max-h-[600px] overflow-y-auto"}`}>
                    {visibleRenderedCheckInRows.map(({ date, mine, mineWeight, presentCount, everyoneDetails }) => {
                      return (
                        <div
                          key={date}
                          className="border border-ink-light/40 bg-ink-dark/20 px-3 py-2.5 flex flex-col gap-2"
                        >
                          {/* Date + status row */}
                          <div className="flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleDayClick(date)}
                              className="text-xs font-medium text-mist-light hover:text-jade-glow transition-colors text-left"
                              title="Open this day"
                            >
                              {formatDateWithPreference(date, dateFormat)}
                            </button>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 border ${
                                (calendarScope === "mine" ? mine.present : presentCount > 0)
                                  ? "border-jade-glow/40 text-jade-glow bg-jade-deep/15"
                                  : "border-ink-light/40 text-mist-dark"
                              }`}
                            >
                              {calendarScope === "mine"
                                ? (mine.present ? "✓ In" : "Not In")
                                : `${presentCount} In`}
                            </span>
                          </div>

                          {calendarScope === "mine" ? (
                            <div className="flex items-center gap-4 text-[11px] text-mist-light">
                              <span>Weight: <span className="text-cloud-white">{mineWeight}</span></span>
                              {mine.comment?.trim() && (
                                <span className="truncate text-mist-light/80">{mine.comment.trim()}</span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {everyoneDetails.map((detail) => {
                                const c = getUserCultivatorColor(detail.id, userColors);
                                return (
                                  <div key={detail.id} className="flex items-center gap-2 text-[11px] min-w-0">
                                    {/* Color dot + name */}
                                    <span className="flex items-center gap-1.5 shrink-0">
                                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c }} />
                                      <span className="font-medium" style={{ color: c }}>{detail.name}</span>
                                    </span>

                                    {/* Check status */}
                                    {detail.present ? (
                                      <span className="text-jade-glow text-[10px]">✓</span>
                                    ) : (
                                      <span className="text-mist-dark text-[10px]">✗</span>
                                    )}

                                    {/* Weight (if any) */}
                                    {detail.weight && (
                                      <span className="text-mist-light/70">{detail.weight}kg</span>
                                    )}

                                    {/* Comment (truncated) */}
                                    {detail.comment && (
                                      <span className="text-mist-light/60 truncate min-w-0 flex-1" title={detail.comment}>
                                        {detail.comment}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {(hasMoreRows || isLoadingMoreRows) && (
                      <div
                        ref={rowsObserverTargetRef}
                        className="flex justify-center py-2"
                      >
                        <span className="text-[11px] text-mist-dark">
                          {isLoadingMoreRows ? "Loading more rows..." : "Scroll to load more"}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`overflow-x-auto border border-ink-light/35 bg-ink-dark/20 ${cultivationViewOpen ? "" : "max-h-[520px] overflow-y-auto"}`}>
                    <table className="w-full min-w-[900px] text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-ink-light/40 bg-ink-dark/35">
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Date</th>
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Status</th>
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Participants</th>
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Weight</th>
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Comment</th>
                          <th className="px-3 py-2 text-center text-mist-light font-semibold">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleRenderedCheckInRows.map(({ date, mine, mineWeight, presentCount, everyoneDetails }) => {
                          const hasCheckin = calendarScope === "mine" ? mine.present : presentCount > 0;

                          return (
                            <tr key={date} className="border-b border-ink-light/25 last:border-b-0 hover:bg-ink-mid/15">
                              <td className="px-3 py-2 text-cloud-white whitespace-nowrap">{formatDateWithPreference(date, dateFormat)}</td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] ${
                                    hasCheckin
                                      ? "border-jade-glow/40 text-jade-glow bg-jade-deep/20"
                                      : "border-ink-light/50 text-mist-dark"
                                  }`}
                                >
                                  {calendarScope === "mine"
                                    ? (mine.present ? "Checked In" : "Not Checked In")
                                    : `${presentCount} Checked In`}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                {calendarScope === "mine"
                                  ? <span className="text-mist-dark text-[11px]">-</span>
                                  : (
                                    <div className="flex flex-wrap gap-1">
                                      {everyoneDetails.filter((d) => d.present).map((d) => {
                                        const c = getUserCultivatorColor(d.id, userColors);
                                        return (
                                          <span key={d.id} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: c, color: c, backgroundColor: `color-mix(in srgb, ${c} 10%, transparent)` }}>
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: c }} />
                                            {d.name}
                                          </span>
                                        );
                                      })}
                                      {everyoneDetails.filter((d) => d.present).length === 0 && <span className="text-mist-dark text-[11px]">-</span>}
                                    </div>
                                  )}
                              </td>
                              <td className="px-3 py-2">
                                {calendarScope === "mine"
                                  ? <span className="text-mist-light whitespace-nowrap">{mineWeight}</span>
                                  : (
                                    <div className="flex flex-wrap gap-1">
                                      {everyoneDetails
                                        .filter((d) => d.weight)
                                        .map((d) => {
                                          const c = getUserCultivatorColor(d.id, userColors);
                                          return (
                                            <span key={`${d.id}-weight`} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: `color-mix(in srgb, ${c} 40%, var(--border))`, color: "var(--text-secondary)" }}>
                                              <span className="font-semibold shrink-0" style={{ color: c }}>{d.name}:</span>
                                              <span className="whitespace-nowrap">{d.weight} kg</span>
                                            </span>
                                          );
                                        })}
                                      {everyoneDetails.filter((d) => d.weight).length === 0 && <span className="text-mist-dark text-[11px]">-</span>}
                                    </div>
                                  )}
                              </td>
                              <td className="px-3 py-2 max-w-[380px]">
                                {calendarScope === "mine"
                                  ? <span className="text-mist-light truncate block" title={mine.comment?.trim() || "-"}>{mine.comment?.trim() || "-"}</span>
                                  : (
                                    <div className="flex flex-wrap gap-1">
                                      {everyoneDetails
                                        .filter((d) => d.comment)
                                        .map((d) => {
                                          const c = getUserCultivatorColor(d.id, userColors);
                                          return (
                                            <span key={d.id} className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px]" style={{ borderColor: `color-mix(in srgb, ${c} 40%, var(--border))`, color: "var(--text-secondary)" }}>
                                              <span className="font-semibold shrink-0" style={{ color: c }}>{d.name}:</span>
                                              <span className="truncate max-w-[160px]" title={d.comment}>{d.comment}</span>
                                            </span>
                                          );
                                        })}
                                      {everyoneDetails.filter((d) => d.comment).length === 0 && <span className="text-mist-dark text-[11px]">-</span>}
                                    </div>
                                  )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  onClick={() => handleDayClick(date)}
                                  className="text-xs px-2 py-1 border border-ink-light/45 text-mist-light hover:text-jade-glow hover:border-jade-glow/45 transition-colors"
                                  title="Open this day"
                                >
                                  Open
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {(hasMoreRows || isLoadingMoreRows) && (
                      <div
                        ref={rowsObserverTargetRef}
                        className="flex justify-center py-2 border-t border-ink-light/25"
                      >
                        <span className="text-[11px] text-mist-dark">
                          {isLoadingMoreRows ? "Loading more rows..." : "Scroll to load more"}
                        </span>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
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
                <div className="px-3 py-2 rounded-lg border border-gold/35 bg-gold-dim/15 text-[11px] text-gold/90">
                  ⏳ Future date — save a personal note for this day. Check-in is restricted to today and the next day.
                </div>
              )}

              {/* Check-In Section — Horizontal cultivator boxes (hidden for far-future dates) */}
              {!isFarFuture && (
              <div>
                <label className="block text-xs text-jade-glow uppercase tracking-wider mb-3">
                  📋 Cultivator Check-In
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {allUsers.map((u) => {
                    const entry = checkInModal.entries[u.id] || { present: false, weight: "", comment: "" };
                    const color = getUserCultivatorColor(u.id, userColors);
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
                        style={entry.present ? { borderColor: color, boxShadow: `0 0 14px ${getCultivatorGlowColor(color, 0.31)}` } : {}}
                      >
                        <div
                          className={`p-3 text-center ${u.id === user.id ? 'cursor-pointer' : 'cursor-default'}`}
                          onClick={() => { if (u.id === user.id) updateCheckInModalEntry(u.id, "present", !entry.present); }}
                        >
                          <div className="flex flex-col items-center gap-1.5">
                            <span
                              className="text-xl font-bold transition-all drop-shadow-[0_0_4px_currentColor]"
                              style={{ color: entry.present ? color : 'var(--mist-dark)' }}
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

                {/* Personal comment */}
                <div className={isFarFuture ? "" : "mt-4"}>
                  <label className="block text-[10px] text-mist-dark uppercase mb-1">My Comment</label>
                  <input
                    type="text"
                    placeholder="Your personal note..."
                    value={user?.id ? checkInModal.entries[user.id]?.comment || "" : ""}
                    onChange={(e) => {
                      if (user?.id) {
                        updateCheckInModalEntry(user.id, "comment", e.target.value);
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
                            await api.delete("/api/checkins/notes", { noteId: existingNote.id });
                            // Also clear the comment from the check-in entry on the server
                            await api.post("/api/checkins", {
                              date: checkInModal.date,
                              entries: { [user.id]: { present: false, weight: "", comment: "" } },
                            });
                            refreshFutureNotes();
                            broadcastNotesUpdated();
                            if (user?.id) updateCheckInModalEntry(user.id, "comment", "");
                            // Update local checkInRows to clear the comment
                            setCheckInRows(prev => {
                              return prev.map(r => {
                                if (r.date !== checkInModal.date) return r;
                                const updatedEntries = { ...r.entries };
                                if (updatedEntries[user.id]) {
                                  updatedEntries[user.id] = { ...updatedEntries[user.id], comment: "" };
                                }
                                // Remove row if no meaningful data remains
                                const hasData = Object.values(updatedEntries).some(
                                  e => e.present || e.weight || e.comment?.trim()
                                );
                                if (!hasData) return null;
                                return { ...r, entries: updatedEntries };
                              }).filter(Boolean) as typeof prev;
                            });
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

      {typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-0 right-3 z-50">
          {statsTabOpen ? (
            <div
              className="w-[min(320px,calc(100vw-0.75rem))] rounded-t-xl border shadow-2xl overflow-hidden"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-elev-2)",
              }}
            >
              <div
                className="flex items-center justify-between px-3 py-2 border-b"
                style={{ borderColor: "var(--border)", backgroundColor: "var(--nyaa-table-head-bg)" }}
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--text-primary)" }}>
                    Cultivation Stats
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--text-secondary)" }}>
                    Overview sidebar
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close cultivation stats"
                  title="Close"
                  onClick={() => setStatsTabOpen(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border text-xs font-bold transition-colors hover:bg-ink-mid/35"
                  style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
                >
                  x
                </button>
              </div>

              <div className="max-h-[70vh] overflow-y-auto sidebar-scroll p-2">
                <DashboardSidebar
                  stats={stats}
                  allUsers={allUsers}
                  userColors={userColors}
                  onColorChange={handleColorChange}
                  currentUserId={user.id}
                  isAdmin={isAdmin}
                />
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setStatsTabOpen(true)}
              className="w-[min(220px,calc(100vw-0.75rem))] rounded-t-xl border border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-[0.1em] shadow-lg transition-all duration-200 hover:bg-ink-mid/30 hover:shadow-[0_16px_36px_rgb(0_0_0_/_0.35)] hover:border-jade-glow/55"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
            >
              Cultivation Stats
            </button>
          )}
        </div>,
        document.body,
      )}
    </PageLayout>
  );
}
