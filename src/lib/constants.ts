// Navigation items configuration
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  pinned: boolean;
  visible: boolean;
}

export const defaultNavItems: NavItem[] = [
  { id: "dashboard", label: "Dao Hall", icon: "⛩️", path: "/dashboard", pinned: false, visible: true },
  { id: "workout", label: "Training Grounds", icon: "⚔️", path: "/dashboard/workout", pinned: false, visible: true },
  { id: "checkin", label: "Sect Register", icon: "📋", path: "/dashboard/checkin", pinned: false, visible: true },
  { id: "exercise-library", label: "Exercise Library", icon: "📚", path: "/dashboard/exercise-library", pinned: false, visible: true },
  { id: "settings", label: "Inner Chamber", icon: "⚙️", path: "/dashboard/settings", pinned: false, visible: true },
  { id: "admin", label: "Administrative Palace", icon: "👑", path: "/dashboard/admin", pinned: false, visible: true },
];

// TODO: These will be populated dynamically from the new exercise database system
export const DIFFICULTY_LEVELS = [] as const;

// TODO: These will be populated dynamically from the new exercise database system
export const EXERCISE_TYPES = [] as const;

// TODO: These will be populated dynamically from the new exercise database system
export const TARGET_GROUPS = [] as const;

// TODO: These will be populated dynamically from the new exercise database system
export const TARGET_GROUP_CATEGORIES: { label: string; groups: string[] }[] = [];

export type DifficultyLevel = (typeof DIFFICULTY_LEVELS)[number];
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export type TargetGroup = (typeof TARGET_GROUPS)[number];

function normalizeDifficultyKey(difficulty: string): string {
  const raw = (difficulty || "").trim();
  const lower = raw.toLowerCase();

  const aliases: Record<string, string> = {
    beginner: "Mortal",
    intermediate: "Core Formation",
    advanced: "Nascent Soul",
    expert: "Soul Splitting",
    elite: "Heavenly Dao",
    master: "Immortal",
    grandmaster: "Heavenly Dao",
  };

  return aliases[lower] || raw;
}

export function getDifficultyColor(difficulty: string): string {
  const key = normalizeDifficultyKey(difficulty);
  const colors: Record<string, string> = {
    "Mortal": "text-difficulty-green",
    "Foundation Establishment": "text-difficulty-amber",
    "Core Formation": "text-difficulty-red",
    "Nascent Soul": "text-difficulty-violet",
    "Soul Splitting": "text-difficulty-pink",
    "Tribulation Transcendence": "text-gold",
    "Immortal": "text-difficulty-light-pink",
    "Heavenly Dao": "text-cyan-300",
  };
  return colors[key] || "text-mist-light";
}

export function getDifficultyGlow(difficulty: string): string {
  const key = normalizeDifficultyKey(difficulty);
  const glows: Record<string, string> = {
    "Mortal": "glow-difficulty-green",
    "Foundation Establishment": "glow-difficulty-amber",
    "Core Formation": "glow-difficulty-red",
    "Nascent Soul": "glow-difficulty-violet",
    "Soul Splitting": "glow-difficulty-pink",
    "Tribulation Transcendence": "glow-gold",
    "Immortal": "glow-difficulty-light-pink",
    "Heavenly Dao": "glow-difficulty-cyan",
  };
  return glows[key] || "";
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    "Upper Heaven": "text-mountain-blue-glow",
    "Lower Realms": "text-crimson",
    "Heart Meridian": "text-jade-glow",
    "Unified Realm": "text-gold",
  };
  return colors[type] || "text-mist-light";
}

export function getTargetGroupColor(targetGroup: string): string {
  const colors: Record<string, string> = {
    "Iron Body Conditioning": "text-difficulty-amber",
    "Lightfoot Movement": "text-mountain-blue-glow",
    "Meridian Flow": "text-jade-glow",
    "Inner Strength": "text-crimson",
    "Sword Forms": "text-difficulty-violet",
    "Palm Techniques": "text-gold",
    "Breathing Arts": "text-difficulty-light-pink",
    "Mental Cultivation": "text-difficulty-pink",
    "Energy Circulation": "text-jade-deep",
    "Combat Reflexes": "text-crimson-glow",
  };
  return colors[targetGroup] || "text-mist-light";
}

// Day assignment constants and utilities
export const DAYS_OF_WEEK = [
  "Sunday",
  "Monday", 
  "Tuesday",
  "Wednesday", 
  "Thursday",
  "Friday",
  "Saturday"
] as const;

export const DAY_ABBREVIATIONS = [
  "Sun",
  "Mon",
  "Tue", 
  "Wed",
  "Thu",
  "Fri",
  "Sat"
] as const;

export const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

// Utility functions for day assignments
export function parseDayAssignments(assignedDays: string): number[] {
  if (!assignedDays || assignedDays.trim() === "") return [];
  return assignedDays.split(",").map(d => parseInt(d.trim())).filter(d => !isNaN(d));
}

export function serializeDayAssignments(days: number[]): string {
  return days.filter(d => d >= 0 && d <= 6).sort().join(",");
}

export function isDayAssigned(assignedDays: string, dayIndex: number): boolean {
  const assignedDayNumbers = parseDayAssignments(assignedDays);
  return assignedDayNumbers.includes(dayIndex);
}

export function toggleDayAssignment(assignedDays: string, dayIndex: number): string {
  const assignedDayNumbers = parseDayAssignments(assignedDays);
  if (assignedDayNumbers.includes(dayIndex)) {
    return serializeDayAssignments(assignedDayNumbers.filter(d => d !== dayIndex));
  } else {
    return serializeDayAssignments([...assignedDayNumbers, dayIndex]);
  }
}

export function formatAssignedDays(assignedDays: string): string {
  const dayNumbers = parseDayAssignments(assignedDays);
  if (dayNumbers.length === 0) return "No days assigned";
  if (dayNumbers.length === 7) return "Every day";
  return dayNumbers.map(d => DAY_ABBREVIATIONS[d]).join(", ");
}

// ── Configurable Date Formatting ──

import type { DateFormatOption } from "@/context/DisplaySettingsContext";

const MONTH_NAMES_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Format a date string (YYYY-MM-DD) or Date object using the user's chosen format.
 */
export function formatDateWithPreference(dateInput: string | Date, format: DateFormatOption): string {
  const date = typeof dateInput === "string" ? new Date(dateInput + "T00:00:00") : dateInput;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const mmm = MONTH_NAMES_SHORT[date.getMonth()];
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);

  switch (format) {
    case "dd-mm-yyyy":
      return `${dd}-${mm}-${yyyy}`;
    case "dd-mmm-yyyy":
      return `${dd}-${mmm}-${yyyy}`;
    case "dd-mm-yy":
      return `${dd}-${mm}-${yy}`;
    case "dd-mmm-yy":
      return `${dd}-${mmm}-${yy}`;
    default:
      return `${dd}-${mmm}-${yyyy}`;
  }
}
