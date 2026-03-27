"use client";

import { motion } from "framer-motion";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useAppContext } from "@/context/AppContext";
import { formatDateWithPreference } from "@/lib/constants";

export interface DashboardUser {
  id: string;
  name: string;
  username: string;
  sessionCount?: number;
}

export interface DashboardUpcomingNote {
  id: string;
  date: string;
  content: string;
  user: { id: string; name: string };
}

const CULTIVATOR_VAR_TO_RGB_VAR: Record<string, string> = {
  "var(--cultivator-jade)": "--cultivator-jade-rgb",
  "var(--cultivator-gold)": "--cultivator-gold-rgb",
  "var(--cultivator-crimson)": "--cultivator-crimson-rgb",
  "var(--cultivator-azure)": "--cultivator-azure-rgb",
  "var(--cultivator-violet)": "--cultivator-violet-rgb",
  "var(--cultivator-emerald)": "--cultivator-emerald-rgb",
  "var(--cultivator-amber)": "--cultivator-amber-rgb",
  "var(--cultivator-rose)": "--cultivator-rose-rgb",
};

export const DEFAULT_CULTIVATOR_COLORS = [
  "var(--cultivator-jade)", "var(--cultivator-gold)", "var(--cultivator-crimson)", "var(--cultivator-azure)",
  "var(--cultivator-violet)", "var(--cultivator-emerald)", "var(--cultivator-amber)", "var(--cultivator-rose)",
];

export const CULTIVATOR_COLOR_OPTIONS = [
  { name: "Jade", value: "var(--cultivator-jade)" },
  { name: "Gold", value: "var(--cultivator-gold)" },
  { name: "Crimson", value: "var(--cultivator-crimson)" },
  { name: "Azure", value: "var(--cultivator-azure)" },
  { name: "Violet", value: "var(--cultivator-violet)" },
  { name: "Emerald", value: "var(--cultivator-emerald)" },
  { name: "Amber", value: "var(--cultivator-amber)" },
  { name: "Rose", value: "var(--cultivator-rose)" },
];

export function normalizeCultivatorColor(colorValue: string | undefined): string {
  if (!colorValue) return DEFAULT_CULTIVATOR_COLORS[0];
  const normalized = colorValue.trim();
  if (CULTIVATOR_VAR_TO_RGB_VAR[normalized]) return normalized;
  if (normalized.startsWith("var(")) return normalized;
  if (normalized.startsWith("#") && normalized.length === 7) return normalized.toLowerCase();
  if (normalized.startsWith("cultivator-")) {
    const cssVarRef = `var(--${normalized})`;
    if (CULTIVATOR_VAR_TO_RGB_VAR[cssVarRef]) return cssVarRef;
  }
  return normalized;
}

export function getCultivatorGlowColor(colorValue: string | undefined, alpha = 0.5): string {
  const normalized = normalizeCultivatorColor(colorValue);
  const rgbVar = CULTIVATOR_VAR_TO_RGB_VAR[normalized];
  if (rgbVar) return `rgb(var(${rgbVar}) / ${alpha})`;
  if (normalized.startsWith("#") && normalized.length === 7) {
    const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
    return `${normalized}${alphaHex}`;
  }
  return `rgb(255 255 255 / ${alpha})`;
}

export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Dashboard Sidebar ──

export function DashboardSidebar({ stats, allUsers, userColors, onColorChange }: { stats: { sessions: number; techniques: number; streak: number }; allUsers: DashboardUser[]; userColors: Record<string, string>; onColorChange: (userId: string, color: string) => void }) {
  return (
    <div className="dashboard-sidebar-shell">
      <div className="dashboard-sidebar-scroll sidebar-scroll space-y-3">
        <GlowButton variant="jade" size="sm" glow className="w-full">
          ⚔️ Quick Training
        </GlowButton>
        <GlowButton variant="blue" size="sm" className="w-full">
          📋 Today&apos;s Check-In
        </GlowButton>

        <div className="dashboard-sidebar-card space-y-2">
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
            <div className="flex justify-between text-xs">
              <span className="text-mist-mid">Check-In Streak</span>
              <span className="text-jade-glow font-semibold">{stats.streak} days</span>
            </div>
          </div>
        </div>
        {allUsers.length > 0 && (
          <div className="dashboard-sidebar-card space-y-2">
            <h3 className="text-xs text-jade-glow uppercase">Cultivator Colours</h3>
            <div className="space-y-2">
              {allUsers.map((u, idx) => {
                const selectedColor = normalizeCultivatorColor(userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length]);
                return (
                  <div key={u.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: selectedColor }}
                      />
                      <span className="text-xs text-mist-light truncate">{u.name}</span>
                    </div>
                    <div className="flex gap-0.5 shrink-0">
                      {CULTIVATOR_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => onColorChange(u.id, c.value)}
                          className={`w-3.5 h-3.5 rounded-full border-2 transition-all ${
                            selectedColor === c.value
                              ? "border-cloud-white scale-125 shadow-[0_0_6px_currentColor]"
                              : "border-transparent hover:border-mist-dark hover:scale-110"
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Calendar Day Cell ──

function CalendarDay({ date, checkedInUsers, isToday, isPast, hasNote, hasFutureNote, compact, onClick }: { date: Date; checkedInUsers: { id: string; name: string; color: string }[]; isToday: boolean; isPast?: boolean; hasNote?: boolean; hasFutureNote?: boolean; compact: boolean; onClick?: () => void }) {
  const hasCheckIns = checkedInUsers.length > 0;
  return (
    <motion.div
      whileHover={compact ? undefined : { scale: 1.05 }}
      onClick={onClick}
      className={`aspect-square flex flex-col items-center justify-center rounded-lg transition-all relative cursor-pointer ${
        isToday
          ? "border-2 border-jade-glow bg-jade-deep/30 hover:bg-jade-deep/50 shadow-[0_0_8px_rgba(58,143,143,0.3)]"
          : hasFutureNote
          ? "border border-jade/30 bg-jade-deep/15 hover:bg-jade-deep/25 shadow-[0_0_6px_rgba(29,72,72,0.3)]"
          : hasCheckIns
          ? "border border-jade/40 bg-jade-deep/15 hover:bg-jade-deep/30"
          : "border border-ink-light/60 bg-ink-dark/30 hover:bg-ink-mid/40"
      } ${isPast && !isToday ? 'opacity-50' : ''}`}
    >
      <div className="text-center">
        <div className={`${compact ? "text-xs" : "text-sm"} font-medium ${isPast && !isToday ? 'text-mist-mid' : 'text-cloud-white'}`}>{date.getDate()}</div>
        {isToday && <div className={`${compact ? "text-[8px]" : "text-[10px]"} text-jade-glow font-bold`}>TODAY</div>}
      </div>
      {hasCheckIns && (
        <div className={`absolute ${compact ? "bottom-0 left-0.5" : "bottom-0.5 left-1"} flex gap-[2px]`}>
          {checkedInUsers.map((u) => (
            <span
              key={u.id}
              title={u.name}
              className={`${compact ? "text-[9px]" : "text-[11px]"} leading-none font-bold drop-shadow-[0_0_3px_currentColor]`}
              style={{ color: u.color }}
            >
              ✓
            </span>
          ))}
        </div>
      )}
      {(hasNote || hasFutureNote) && (
        <div className={`absolute ${compact ? "top-0 right-0" : "top-0.5 right-0.5"} ${compact ? "text-[7px]" : "text-[8px]"} text-gold-glow`}>📝</div>
      )}
      {hasFutureNote && (
        <div className={`absolute ${compact ? "top-0 right-0" : "top-0.5 right-0.5"} ${compact ? "text-[8px]" : "text-[10px]"} text-gold-glow drop-shadow-[0_0_3px_rgba(232,200,74,0.5)]`}>✏️</div>
      )}
    </motion.div>
  );
}

// ── Calendar Widget ──

export function Calendar({
  checkInUsersByDate,
  currentMonth,
  setCurrentMonth,
  dayNotes,
  futureNoteDates,
  onDayClick,
  allUsers,
  userColors,
  upcomingNotes,
  dateFormat = "dd-mmm-yyyy",
  onManageNotes,
}: {
  checkInUsersByDate: Map<string, string[]>;
  currentMonth: Date;
  setCurrentMonth: (d: Date) => void;
  dayNotes?: Map<string, string>;
  futureNoteDates?: Set<string>;
  onDayClick?: (date: string) => void;
  allUsers: DashboardUser[];
  userColors: Record<string, string>;
  upcomingNotes?: DashboardUpcomingNote[];
  dateFormat?: "dd-mm-yyyy" | "dd-mmm-yyyy" | "dd-mm-yy" | "dd-mmm-yy";
  onManageNotes?: () => void;
}) {
  const { isMobile } = useAppContext();
  const compactMode = isMobile;
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const days = [];
  const today = formatDateLocal(new Date());

  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
    days.push(date);
  }

  return (
    <GlowCard glow="jade" className={`${compactMode ? "p-2.5" : "p-4"} space-y-3 min-w-0 overflow-hidden`}>
      <div className={`flex ${compactMode ? "flex-wrap gap-2" : "items-center justify-between"}`}>
        <h3 className={`${compactMode ? "text-sm" : "text-lg"} font-bold text-cloud-white`}>
          {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </h3>
        <div className="flex gap-1.5 ml-auto">
          <GlowButton
            variant="ghost"
            size="sm"
            onClick={() =>
              setCurrentMonth(
                new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1)
              )
            }
          >
            {compactMode ? "←" : "← Prev"}
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
            {compactMode ? "→" : "Next →"}
          </GlowButton>
        </div>
      </div>

      <div className={`grid grid-cols-7 ${compactMode ? "gap-1 mb-1" : "gap-2 mb-2"}`}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className={`text-center ${compactMode ? "text-[10px]" : "text-xs"} text-mist-dark uppercase font-semibold`}>
            {compactMode ? day[0] : day}
          </div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${compactMode ? "gap-1" : "gap-2"} min-w-0`}>
        {days.map((date, i) => (
          <div key={i}>
            {date ? (
              <CalendarDay
                date={date}
                checkedInUsers={
                  (checkInUsersByDate.get(formatDateLocal(date)) || []).map(uid => {
                    const u = allUsers.find(usr => usr.id === uid);
                    const idx = allUsers.findIndex(usr => usr.id === uid);
                    return {
                      id: uid,
                      name: u?.name || "Unknown",
                      color: normalizeCultivatorColor(userColors[uid] || DEFAULT_CULTIVATOR_COLORS[idx >= 0 ? idx % DEFAULT_CULTIVATOR_COLORS.length : 0]),
                    };
                  })
                }
                isToday={formatDateLocal(date) === today}
                isPast={formatDateLocal(date) < today}
                hasNote={dayNotes?.has(formatDateLocal(date))}
                hasFutureNote={futureNoteDates?.has(formatDateLocal(date))}
                compact={compactMode}
                onClick={() => onDayClick?.(formatDateLocal(date))}
              />
            ) : (
              <div className="aspect-square" />
            )}
          </div>
        ))}
      </div>

      {upcomingNotes && upcomingNotes.length > 0 && (
        <div className="pt-3 border-t border-ink-light/70 space-y-2.5">
          <div className="flex items-center gap-2">
            <h4 className={`${compactMode ? "text-[11px]" : "text-xs"} text-gold-glow uppercase tracking-wide font-semibold`}>Upcoming Notes</h4>
            {!!upcomingNotes?.length && (
              <span className="text-[9px] text-gold-glow bg-gold-dim/20 px-2 py-0.5 rounded-full font-medium">{upcomingNotes.length}</span>
            )}
            {onManageNotes && (
              <button
                onClick={onManageNotes}
                className="ml-auto text-[10px] text-gold-light/70 hover:text-gold-glow transition-colors hover:underline"
                title="Manage notes in Sect Register"
              >
                Manage &rarr;
              </button>
            )}
          </div>

          <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
            {upcomingNotes.map((note) => {
              const noteUserIdx = allUsers.findIndex((u) => u.id === note.user.id);
              const noteColor = normalizeCultivatorColor(
                userColors[note.user.id] ||
                  DEFAULT_CULTIVATOR_COLORS[noteUserIdx >= 0 ? noteUserIdx % DEFAULT_CULTIVATOR_COLORS.length : 0],
              );
              return (
                <button
                  key={note.id}
                  onClick={() => onDayClick?.(note.date)}
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
      )}

      <div className={`pt-3 border-t border-ink-light flex flex-wrap ${compactMode ? "gap-2 text-[10px]" : "gap-3 text-xs"}`}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-2 border-jade-glow bg-jade-deep/30 shadow-[0_0_4px_rgba(58,143,143,0.2)]" />
          <span className="text-mist-mid">Today</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-jade-glow drop-shadow-[0_0_3px_rgba(58,143,143,0.6)]">✓</span>
          <span className="text-mist-mid">Check-In</span>
        </div>
        <div className="flex items-center gap-1">
          {allUsers.slice(0, compactMode ? 3 : 4).map((u, idx) => (
            <span
              key={u.id}
              className="text-[10px] font-bold"
              style={{ color: normalizeCultivatorColor(userColors[u.id] || DEFAULT_CULTIVATOR_COLORS[idx % DEFAULT_CULTIVATOR_COLORS.length]) }}
              title={u.name}
            >
              ✓
            </span>
          ))}
          <span className="text-mist-mid ml-0.5">= cultivator</span>
        </div>
      </div>
    </GlowCard>
  );
}
