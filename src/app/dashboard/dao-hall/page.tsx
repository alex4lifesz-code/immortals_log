"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import GlowCard, { GlowModal } from "@/components/ui/GlowCard";
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
import { createCalendarMonthAnchor, formatDateWithPreference } from "@/lib/constants";
import { t } from "@/lib/terminology";
import { syncWeightFromLatestCheckin } from "@/lib/user-physique";
import { api } from "@/lib/api-client";
import GettingStartedCard from "@/components/getting-started/GettingStartedCard";
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

  // Persist charts toggle
  useEffect(() => {
    try { localStorage.setItem("dao-charts-open", String(chartsOpen)); } catch {}
  }, [chartsOpen]);

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
        <div className="dao-modern-page space-y-6 px-0 py-2 sm:py-3">
          {/* Getting Started checklist for new users */}
          <GettingStartedCard />

          {/* Upcoming Notes */}
          {scopedFutureNotes.length > 0 && (
            <GlowCard glow="gold" hoverable={false}>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm text-gold-glow uppercase tracking-wider font-semibold">Upcoming Notes</h4>
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
            </GlowCard>
          )}

          {/* Calendar — always visible */}
          <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4 dao-modern-grid`}> 
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

            {/* Stats panel — always visible beside calendar on desktop */}
            {!isMobile && (
              <GlowCard glow="jade" hoverable={false} className="dao-modern-monthly-stats flex flex-col min-h-[260px]">
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
              </GlowCard>
            )}
          </div>

          {/* Charts + cultivation stats are desktop-only */}
          {!isMobile && (
            <GlowCard glow="jade" hoverable={false} className="dao-modern-chart-toolbar flex items-center gap-3">
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
                  <span>{chartsOpen ? t("Hide Charts", "normal") : t("Show Charts", "normal")}</span>
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
            </GlowCard>
          )}

          {!isMobile && chartsOpen && (
            <div className={`grid ${isMobile ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
              {/* Monthly Comparison (last 6 months) */}
              <GlowCard glow="jade" hoverable={false} className="dao-modern-monthly-chart flex flex-col min-h-[220px]">
                {user && effectiveChartUserIds.length > 0 && (
                  <MonthlyComparisonChart
                    checkInRows={checkInRows}
                    currentMonth={currentMonth}
                    selectedUserIds={effectiveChartUserIds}
                    userNames={chartUserNames}
                    userColors={userColors}
                  />
                )}
              </GlowCard>

              {/* Weight Trend (all-time) */}
              <GlowCard glow="jade" hoverable={false} className="dao-modern-weight-trend flex flex-col min-h-[220px]">
                {user && effectiveChartUserIds.length > 0 && (
                  <WeightTrendChart
                    checkInRows={checkInRows}
                    selectedUserIds={effectiveChartUserIds}
                    userNames={chartUserNames}
                    userColors={userColors}
                  />
                )}
              </GlowCard>
            </div>
          )}

          {/* Check-In Feed — clean scrolling timeline */}
          <GlowCard glow="jade" hoverable={false} className="dao-modern-cultivation-view">
            <div ref={sectRegisterRef} className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h3 className="text-sm uppercase tracking-wider text-jade-glow">{t("Check-In Feed", "normal")}</h3>
                  <p className="mt-1 text-xs text-mist-dark">
                    {t("A clean, mobile-friendly timeline for recent check-ins and notes.", "normal")}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md border border-ink-light/50 bg-ink-dark/30 px-2.5 py-1 text-[11px] text-mist-light">
                    {renderedCheckInRows.length} {t("entries", "normal")}
                  </span>
                  <div
                    className="flex items-center gap-1 border border-ink-light/50 p-0.5"
                    style={{
                      borderColor: "color-mix(in srgb, var(--jade-glow) 32%, var(--border))",
                      background: "linear-gradient(135deg, color-mix(in srgb, var(--ink-mid) 78%, var(--ink-deep)) 0%, color-mix(in srgb, var(--jade-glow) 8%, var(--ink-deep)) 100%)",
                    }}
                  >
                    {(["all", "mine", "friends"] as const).map((scope) => {
                      const active = calendarScope === scope;
                      return (
                        <button
                          key={scope}
                          onClick={() => setCalendarScope(scope)}
                          className="text-xs px-2.5 py-1 transition-all"
                          style={{
                            borderColor: active ? "color-mix(in srgb, var(--jade-glow) 45%, var(--border))" : "transparent",
                            color: active ? "var(--cloud-white)" : "var(--text-secondary)",
                            background: active
                              ? "linear-gradient(135deg, color-mix(in srgb, var(--jade-glow) 24%, var(--ink-mid)) 0%, color-mix(in srgb, var(--jade) 20%, var(--ink-deep)) 100%)"
                              : "transparent",
                          }}
                        >
                          {t(scope === "all" ? "All" : scope === "mine" ? "Mine" : "Friends", "normal")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {renderedCheckInRows.length === 0 ? (
                <div className="flex flex-col items-center border border-ink-light/40 bg-ink-mid/10 py-10 text-center">
                  <div className="mb-2 text-2xl opacity-30">🧭</div>
                  <p className="text-xs text-mist-dark">{t("No entries for this view", "normal")}</p>
                  <p className="mt-1 text-[10px] text-mist-dark/60">{t("Use the calendar above to check in and add notes", "normal")}</p>
                </div>
              ) : (
                <div className={isMobile ? "space-y-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]" : "grid grid-cols-1 gap-3 xl:grid-cols-2"}>
                  {visibleRenderedCheckInRows.map(({ date, mine, mineWeight, presentCount, everyoneDetails }) => {
                    const hasCheckin = calendarScope === "mine" ? mine.present : presentCount > 0;

                    return (
                      <article
                        key={date}
                        className="rounded-lg border border-[#3b3f48] bg-[#313338] p-3 shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-[#949ba4]">{t("Check-In", "normal")}</p>
                            <button
                              onClick={() => handleDayClick(date)}
                              className="mt-1 text-left text-sm font-semibold text-[#f2f3f5] transition-colors hover:text-[#8ea1e1]"
                              title={t("Open this day", "normal")}
                            >
                              {formatDateWithPreference(date, dateFormat)}
                            </button>
                          </div>

                          <button
                            onClick={() => handleDayClick(date)}
                            className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-1 text-[11px] font-medium text-[#dbdee1] transition-colors hover:border-[#5865f2]/60 hover:text-[#f2f3f5]"
                          >
                            {t("Open", "normal")}
                          </button>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-md border px-2 py-1 text-[11px] ${hasCheckin ? "border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]" : "border-[#3b3f48] bg-[#2b2d31] text-[#949ba4]"}`}>
                            {calendarScope === "mine"
                              ? (mine.present ? t("Checked in", "normal") : t("Rest day", "normal"))
                              : `${presentCount} ${t("active", "normal")}`}
                          </span>
                          <span className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2 py-1 text-[11px] text-[#b5bac1]">
                            {calendarScope === "mine" ? mineWeight : `${everyoneDetails.length} ${t("people", "normal")}`}
                          </span>
                        </div>

                        {calendarScope === "mine" ? (
                          <div className="mt-3 rounded-md border border-[#3b3f48] bg-[#2b2d31] px-3 py-2.5">
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="h-2 w-2 rounded-full bg-[#5865f2]" />
                              <span className="font-medium text-[#f2f3f5]">{t("You", "normal")}</span>
                              <span className="ml-auto text-[#949ba4]">
                                {mine.present ? t("In", "normal") : t("Rest", "normal")}
                              </span>
                            </div>
                            <p className="mt-1 pl-4 text-sm leading-6 text-[#dbdee1]">
                              {mine.comment?.trim() || t("No note added for this day.", "normal")}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-1.5">
                            {everyoneDetails.slice(0, isMobile ? 4 : 5).map((detail) => {
                              const c = getUserCultivatorColor(detail.id, userColors);
                              return (
                                <div key={detail.id} className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-2">
                                  <div className="flex items-center gap-2 text-[11px]">
                                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: c }} />
                                    <span className="min-w-0 truncate font-medium" style={{ color: c }}>{detail.name}</span>
                                    <span className="ml-auto shrink-0 text-[#949ba4]">
                                      {detail.present ? t("In", "normal") : t("Rest", "normal")}
                                    </span>
                                    {detail.weight ? <span className="shrink-0 text-[#b5bac1]">{detail.weight} kg</span> : null}
                                  </div>
                                  {detail.comment ? (
                                    <p className="mt-1 pl-4 text-[11px] leading-5 text-[#dbdee1]">
                                      {detail.comment}
                                    </p>
                                  ) : null}
                                </div>
                              );
                            })}
                            {everyoneDetails.length > (isMobile ? 4 : 5) && (
                              <p className="text-[11px] text-mist-dark">
                                +{everyoneDetails.length - (isMobile ? 4 : 5)} {t("more people", "normal")}
                              </p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {(hasMoreRows || isLoadingMoreRows) && (
                    <div ref={rowsObserverTargetRef} className="flex justify-center py-2 xl:col-span-2">
                      <span className="text-[11px] text-mist-dark">
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
        panelClassName="!max-w-2xl !max-h-[86vh] !overflow-hidden"
        contentClassName="!p-0"
      >
        {checkInModal && (() => {
          const todayKey = formatDateLocal(new Date(), settings.timeZone);
          const isFarFuture = checkInModal.date > todayKey;

          return (
            <div
              className="border overflow-hidden rounded-lg"
              style={{
                borderColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                background: "#2b2d31",
              }}
            >
              <div
                className="flex items-center justify-between gap-3 border-b px-3 py-2"
                style={{
                  borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                  backgroundColor: "#232428",
                }}
              >
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Day Check-In</p>
                  <h2 className="truncate text-sm font-semibold text-[#f2f3f5]">
                    {formatDateWithPreference(checkInModal.date, dateFormat)}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${isFarFuture ? "border-[#f0b96a]/55 bg-[#383533] text-[#ffe0a8]" : "border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]"}`}>
                    {isFarFuture ? "Notes Mode" : "Check-In Mode"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setCheckInModal(null)}
                    aria-label="Close dialog"
                    className="flex h-8 w-8 items-center justify-center rounded-md border border-[#3b3f48] bg-[#383a40]/65 text-[#b5bac1] transition-colors hover:border-[#5865f2]/60 hover:text-[#f2f3f5]"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(86vh-3.25rem)] overflow-y-auto px-2.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] scrollbar-hide" style={{ WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y" }}>
                <div className="space-y-2.5">
                  {isFarFuture && (
                    <div className="rounded-md border border-[#f0b96a]/35 bg-[#383533] px-2.5 py-1.5 text-[11px] text-[#ffe0a8]">
                      Save a personal note for this future day. Full check-in is available only for today.
                    </div>
                  )}

                  {!isFarFuture && (
                    <section className="rounded-md border border-[#3b3f48] bg-[#232428] p-3">
                      <div className="mb-3">
                        <label className="block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">
                          Cultivator Check-In
                        </label>
                        <p className="mt-1 text-[11px] text-[#b5bac1]">
                          Check-in and weight are tracked separately. Logging at least one workout for this day will auto-mark you as present.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {allUsers.map((u) => {
                          const entry = checkInModal.entries[u.id] || { present: false, weight: "", comment: "" };
                          const color = getUserCultivatorColor(u.id, userColors);
                          const isSelf = u.id === user.id;
                          return (
                            <motion.div
                              key={u.id}
                              whileHover={isSelf ? { scale: 1.01 } : {}}
                              whileTap={isSelf ? { scale: 0.99 } : {}}
                              className={`rounded-md border p-2.5 transition-all ${
                                entry.present
                                  ? "bg-[#313338]"
                                  : "bg-[#232428]"
                              } ${isSelf ? "" : "opacity-70 cursor-default"}`}
                              style={{
                                borderColor: entry.present
                                  ? `color-mix(in srgb, ${color} 55%, var(--ink-light))`
                                  : "#3b3f48",
                                boxShadow: "none",
                              }}
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-[12px] font-semibold text-[#f2f3f5]">{u.name}</span>
                                  {isSelf ? <span className="rounded-md border border-[#5865f2]/45 bg-[#5865f2]/12 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-[#c8cdfa]">Me</span> : null}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-lg font-bold" style={{ color: entry.present ? color : "var(--mist-dark)" }}>
                                    {entry.present ? "✓" : "○"}
                                  </span>
                                  <span className={`text-[11px] font-medium ${entry.present ? "text-[#f2f3f5]" : "text-[#949ba4]"}`}>
                                    {entry.present ? "Checked in" : "Not checked in"}
                                  </span>
                                  {entry.weight ? <span className="ml-auto text-[10px] text-[#b5bac1]">{entry.weight} kg</span> : null}
                                </div>
                              </div>

                              {isSelf && (
                                <div className="mt-3 space-y-2">
                                  <button
                                    type="button"
                                    onClick={() => updateCheckInModalEntry(u.id, "present", !entry.present)}
                                    className={`w-full rounded-md border px-2.5 py-2 text-[11px] font-medium transition-colors ${entry.present ? "border-[#5865f2]/60 bg-[#5865f2]/12 text-[#c8cdfa]" : "border-[#3b3f48] bg-[#2b2d31] text-[#dbdee1] hover:border-[#5865f2]/45"}`}
                                  >
                                    {entry.present ? "Checked In" : "Mark Check-In"}
                                  </button>

                                  <div>
                                    <label className="mb-1 block text-[10px] uppercase tracking-[0.08em] text-[#949ba4]">Weight</label>
                                    <input
                                      type="number"
                                      placeholder="Weight (kg)"
                                      value={entry.weight}
                                      onChange={(e) => updateCheckInModalEntry(u.id, "weight", e.target.value)}
                                      className="w-full rounded-md border px-2.5 py-2 text-[11px] outline-none"
                                      style={{
                                        borderColor: "color-mix(in srgb, var(--ink-light) 70%, transparent)",
                                        backgroundColor: "color-mix(in srgb, var(--ink-mid) 90%, var(--ink-deep))",
                                        color: "var(--cloud-white)",
                                      }}
                                      min="0"
                                      max="500"
                                      step="0.1"
                                    />
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  <section className="rounded-md border border-[#3b3f48] bg-[#232428] p-3">
                    <label className="block text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Personal Note</label>
                    <p className="mt-1 text-[11px] text-[#b5bac1]">Add a short update for this day.</p>
                    <textarea
                      placeholder="Add a short note for this day"
                      value={user?.id ? checkInModal.entries[user.id]?.comment || "" : ""}
                      onChange={(e) => {
                        if (user?.id) {
                          updateCheckInModalEntry(user.id, "comment", e.target.value);
                        }
                      }}
                      rows={3}
                      className="mt-2 w-full resize-none rounded-md border px-2.5 py-2 text-xs outline-none"
                      style={{
                        borderColor: "#3b3f48",
                        backgroundColor: "#313338",
                        color: "var(--cloud-white)",
                      }}
                    />
                  </section>

                  <div className="sticky bottom-0 -mx-2.5 mt-1 border-t border-[#32353b] bg-[#2b2d31]/95 px-2.5 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] backdrop-blur-sm">
                    {isFarFuture ? (
                      <div className="flex gap-2">
                        <GlowButton
                          variant="jade"
                          glow
                          className="flex-1"
                          onClick={handleSaveCheckIn}
                          size="sm"
                        >
                          Save Note
                        </GlowButton>
                        {futureNotes.some(n => n.date === checkInModal.date && n.user.id === user.id) && (
                          <GlowButton
                            variant="crimson"
                            className="flex-1"
                            onClick={async () => {
                              const existingNote = futureNotes.find(n => n.date === checkInModal.date && n.user.id === user.id);
                              if (existingNote) {
                                await api.delete("/api/checkins/notes", { noteId: existingNote.id });
                                await api.post("/api/checkins", {
                                  date: checkInModal.date,
                                  entries: { [user.id]: { present: false, weight: "", comment: "" } },
                                });
                                refreshFutureNotes();
                                broadcastNotesUpdated();
                                if (user?.id) updateCheckInModalEntry(user.id, "comment", "");
                                setCheckInRows(prev => {
                                  return prev.map(r => {
                                    if (r.date !== checkInModal.date) return r;
                                    const updatedEntries = { ...r.entries };
                                    if (updatedEntries[user.id]) {
                                      updatedEntries[user.id] = { ...updatedEntries[user.id], comment: "" };
                                    }
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
                            Clear Note
                          </GlowButton>
                        )}
                      </div>
                    ) : (
                      <GlowButton
                        variant="jade"
                        glow
                        className="w-full"
                        onClick={handleSaveCheckIn}
                        size="sm"
                      >
                        Save Check-In
                      </GlowButton>
                    )}
                  </div>
                </div>
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

      {!isMobile && typeof document !== "undefined" && createPortal(
        <div className="fixed bottom-0 right-3 z-50">
          {statsTabOpen ? (
            <div
              className="w-[min(320px,calc(100vw-0.75rem))] rounded-t-xl border border-ink-light shadow-2xl overflow-hidden bg-ink-deep"
            >
              <div
                className="flex items-center justify-between px-3 py-2 border-b border-ink-light"
              >
                <div className="min-w-0">
                  <p className="text-sm text-jade-glow uppercase tracking-wider">
                    Cultivation Stats
                  </p>
                  <p className="text-[11px] truncate text-mist-dark">
                    Overview sidebar
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close cultivation stats"
                  title="Close"
                  onClick={() => setStatsTabOpen(false)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-ink-light text-xs font-bold text-mist-dark transition-colors hover:bg-ink-mid/35"
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
              className="w-[min(220px,calc(100vw-0.75rem))] rounded-t-xl border border-ink-light border-b-0 px-4 py-2 text-xs font-semibold uppercase tracking-wider shadow-lg transition-all duration-200 bg-ink-deep text-cloud-white hover:bg-ink-mid/30 hover:shadow-[0_16px_36px_rgb(0_0_0_/_0.35)] hover:border-jade-glow/55"
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
