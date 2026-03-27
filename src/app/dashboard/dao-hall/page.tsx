"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import PageSkeleton from "@/components/ui/PageSkeleton";
import { GlowModal } from "@/components/ui/GlowCard";
import PageLayout from "@/components/layout/PageLayout";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { useAppContext } from "@/context/AppContext";
import { formatDateWithPreference } from "@/lib/constants";
import { syncWeightFromLatestCheckin } from "@/lib/user-physique";
import { api } from "@/lib/api-client";
import {
  DashboardSidebar,
  Calendar,
  DEFAULT_CULTIVATOR_COLORS,
  CULTIVATOR_COLOR_OPTIONS,
  getCultivatorGlowColor,
  normalizeCultivatorColor,
  formatDateLocal,
  type DashboardUser,
} from "@/components/dashboard/DashboardCalendar";

type User = DashboardUser;

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

export default function DaoHallPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { settings } = useDisplaySettings();
  const { isMobile } = useAppContext();
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
  const sectRegisterRef = useRef<HTMLDivElement>(null);
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
  const [isSectEditMode, setIsSectEditMode] = useState(false);
  const [sectEditData, setSectEditData] = useState<Record<string, Record<string, { weight: string; comment: string }>>>({});
  const [deletingRowDate, setDeletingRowDate] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("dao-hall-calendar-scope", calendarScope);
  }, [calendarScope]);

  // Load user colors from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("cultivator-colors");
      if (saved) {
        const parsed = JSON.parse(saved) as Record<string, string>;
        const normalized = Object.fromEntries(
          Object.entries(parsed).map(([userId, color]) => [userId, normalizeCultivatorColor(color)]),
        );
        setUserColors(normalized);
      }
    } catch { /* ignore */ }
  }, []);

  const handleColorChange = (userId: string, color: string) => {
    setUserColors(prev => {
      const updated = { ...prev, [userId]: normalizeCultivatorColor(color) };
      localStorage.setItem("cultivator-colors", JSON.stringify(updated));
      return updated;
    });
  };

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
      sidebar={<DashboardSidebar stats={stats} allUsers={allUsers} userColors={userColors} onColorChange={handleColorChange} />}
      sidebarLabel="Cultivation Stats"
    >
      {loading ? (
        <PageSkeleton statCards={4} wideBlock rows={3} />
      ) : (
        <div className="space-y-6">
          {/* Upcoming Notes */}
          {scopedFutureNotes.length > 0 && (
            <GlowCard glow="gold" className="w-full">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs text-gold-glow uppercase tracking-wide font-semibold">Upcoming Notes</h4>
                  <span className="text-[9px] text-gold-glow bg-gold-dim/20 px-2 py-0.5 rounded-full font-medium">{scopedFutureNotes.length}</span>
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {scopedFutureNotes.map((note) => {
                    const noteUserIdx = allUsers.findIndex((u) => u.id === note.user.id);
                    const noteColor = normalizeCultivatorColor(
                      userColors[note.user.id] ||
                        DEFAULT_CULTIVATOR_COLORS[noteUserIdx >= 0 ? noteUserIdx % DEFAULT_CULTIVATOR_COLORS.length : 0],
                    );
                    return (
                      <button
                        key={note.id}
                        onClick={() => handleDayClick(note.date)}
                        className="w-full text-left p-2 rounded-lg border border-ink-light/45 bg-gradient-to-r from-ink-dark/40 to-ink-mid/20 hover:from-gold-dim/12 hover:to-gold-dim/8 hover:border-gold-dim/45 transition-all duration-200"
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

          {/* Calendar */}
          <div>
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
            />
          </div>

          {/* User View — Personal cultivation history */}
          <GlowCard glow="jade" className="w-full">
            <div ref={sectRegisterRef} className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-jade-glow">My Cultivation View</h3>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border border-ink-light/50 p-0.5">
                    <button
                      onClick={() => setCalendarScope("all")}
                      className={`text-xs px-2 py-1 rounded transition-all ${
                        calendarScope === "all"
                          ? "bg-jade-deep/20 border border-jade/40 text-jade-light"
                          : "text-mist-light hover:text-jade-light"
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCalendarScope("mine")}
                      className={`text-xs px-2 py-1 rounded transition-all ${
                        calendarScope === "mine"
                          ? "bg-jade-deep/20 border border-jade/40 text-jade-light"
                          : "text-mist-light hover:text-jade-light"
                      }`}
                    >
                      Mine
                    </button>
                    <button
                      onClick={() => setCalendarScope("friends")}
                      className={`text-xs px-2 py-1 rounded transition-all ${
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
                <div className="flex flex-col items-center py-10 text-center border border-ink-light/40 rounded-lg bg-ink-mid/10">
                  <div className="text-2xl opacity-30 mb-2">🧭</div>
                  <p className="text-xs text-mist-dark">No entries for this view</p>
                  <p className="text-[10px] text-mist-dark/60 mt-1">Use the calendar above to check in and add notes</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {renderedCheckInRows.map(({ date, mine, mineWeight, presentCount, everyoneDetails }) => {
                    return (
                      <div
                        key={date}
                        className="rounded-xl border border-ink-light/45 bg-gradient-to-b from-ink-mid/15 to-ink-mid/5 p-3.5 sm:p-4 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            onClick={() => handleDayClick(date)}
                            className="text-sm text-mist-light hover:text-jade-glow transition-colors text-left"
                            title="Open this day"
                          >
                            {formatDateWithPreference(date, dateFormat)}
                          </button>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded border ${
                              (calendarScope === "mine" ? mine.present : presentCount > 0)
                                ? "border-jade-glow/40 text-jade-glow bg-jade-deep/20"
                                : "border-ink-light/50 text-mist-dark"
                            }`}
                          >
                            {calendarScope === "mine"
                              ? (mine.present ? "Checked In" : "Not Checked In")
                              : `${presentCount} Checked In`}
                          </span>
                        </div>

                        {calendarScope === "mine" ? (
                          <>
                            <div className="flex items-center gap-4 text-xs text-mist-light">
                              <span>
                                Weight: <span className="text-cloud-white">{mineWeight}</span>
                              </span>
                            </div>

                            <div className="text-xs text-mist-light/90">
                              <span className="text-mist-dark">Comment:</span>{" "}
                              {mine.comment?.trim() || "-"}
                            </div>
                          </>
                        ) : (
                          <div className="pt-0.5">
                            <div className="rounded-lg border border-ink-light/30 bg-ink-dark/40 overflow-hidden divide-y divide-ink-light/20">
                              {everyoneDetails.map((detail) => (
                                <div key={detail.id} className="px-3 py-2.5">
                                  <div className="flex items-start justify-between gap-2 text-xs">
                                    <div className="min-w-0 flex-1 grid grid-cols-[minmax(108px,160px)_minmax(0,1fr)] items-start gap-x-1">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-jade-glow/18 border border-jade-glow/35 grid place-items-center shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.05)]">
                                          <span className="text-sm font-bold text-jade-light leading-none">
                                            {(detail.name || "?").charAt(0).toUpperCase()}
                                          </span>
                                        </div>
                                        <span className="text-cloud-white font-semibold truncate tracking-wide">{detail.name}</span>
                                      </div>

                                      <div className="text-[11px] text-mist-light">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-mist-dark uppercase tracking-wide">Weight</span>
                                          <span className="text-cloud-white font-medium">{detail.weight ? `${detail.weight} kg` : "-"}</span>
                                        </div>
                                        <div className="mt-1 text-mist-light/90 break-words leading-relaxed">
                                          <span className="text-mist-dark uppercase tracking-wide mr-1">Note</span>
                                          <span className="text-cloud-white/90">{detail.comment || "-"}</span>
                                        </div>
                                      </div>
                                    </div>

                                    <span
                                      className={`px-2 py-0.5 rounded-full border text-[10px] shrink-0 ${
                                        detail.present
                                          ? "border-jade-glow/40 text-jade-glow bg-jade-deep/20"
                                          : "border-ink-light/45 text-mist-dark"
                                      }`}
                                    >
                                      {detail.present ? "Checked In" : "Not Checked In"}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
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
                  {allUsers.map((u, idx) => {
                    const entry = checkInModal.entries[u.id] || { present: false, weight: "", comment: "" };
                    const color = normalizeCultivatorColor(userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length]);
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
                            refreshFutureNotes();
                            broadcastNotesUpdated();
                            if (user?.id) updateCheckInModalEntry(user.id, "comment", "");
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
