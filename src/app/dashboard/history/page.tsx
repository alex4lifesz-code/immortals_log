"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";
import ExerciseHistoryModal from "@/components/workout/ExerciseHistoryModal";

interface ProgressionLogEntry {
  exerciseId: string;
  exerciseName: string;
  level: number;
  weight1?: number | null;
  reps1?: number | null;
  weight2?: number | null;
  reps2?: number | null;
  weight3?: number | null;
  reps3?: number | null;
  holdTime?: number | null;
  holdTime2?: number | null;
  holdTime3?: number | null;
  modifier?: string | null;
  variant?: string | null;
  notes?: string | null;
  completed?: boolean;
  createdAt: string;
}

// Group logs by date for display
interface DaySession {
  date: string;
  logs: ProgressionLogEntry[];
}

interface ExerciseStats {
  id: string;
  name: string;
  count: number;
  totalWeight: number;
}

function HistorySidebar({
  stats,
  exerciseStats,
}: {
  stats: { total: number; thisWeek: number; thisMonth: number };
  exerciseStats: ExerciseStats[];
}) {
  const topExercise = exerciseStats[0];
  
  return (
    <div className="space-y-3">
      <div className="ink-border rounded-lg p-3 bg-ink-dark">
        <h3 className="text-xs text-jade-glow mb-2 uppercase font-semibold">Statistics</h3>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">Total Logs</span>
            <span className="text-cloud-white font-bold">{stats.total}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">This Week</span>
            <span className="text-cloud-white font-bold">{stats.thisWeek}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-mist-mid">This Month</span>
            <span className="text-cloud-white font-bold">{stats.thisMonth}</span>
          </div>
        </div>
      </div>

      {topExercise && (
        <div className="ink-border rounded-lg p-3 bg-jade-deep/20 border-jade-glow/50">
          <h3 className="text-xs text-jade-glow uppercase font-semibold mb-2">🏆 Favorite Technique</h3>
          <div className="space-y-1">
            <p className="text-sm font-bold text-cloud-white">{topExercise.name}</p>
            <p className="text-xs text-jade-glow">{topExercise.count} entries</p>
            {topExercise.totalWeight > 0 && (
              <p className="text-xs text-mist-dark">{topExercise.totalWeight.toLocaleString()} kg total</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Simple bar chart component
function SimpleBarChart({ title, data, max }: { title: string; data: { label: string; value: number; color: string }[]; max: number }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-jade-glow uppercase">{title}</h4>
      <div className="space-y-1">
        {data.map((item, i) => (
          <div key={i} className="space-y-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-mist-light truncate">{item.label}</span>
              <span className="text-cloud-white font-semibold">{item.value}</span>
            </div>
            <div className="w-full h-1.5 bg-ink-light rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(item.value / max) * 100}%` }}
                transition={{ delay: i * 0.05, duration: 0.6 }}
                className={`h-full rounded-full bg-gradient-to-r ${item.color}`}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const dateFormat = settings.dateFormat || "dd-mmm-yyyy";
  const [allLogs, setAllLogs] = useState<ProgressionLogEntry[]>([]);
  const [daySessions, setDaySessions] = useState<DaySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, thisWeek: 0, thisMonth: 0 });
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats[]>([]);
  const [chartData, setChartData] = useState<{ label: string; value: number; color: string }[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showDatePopup, setShowDatePopup] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [allCheckIns, setAllCheckIns] = useState<{ id: string; date: string; present: boolean; weight?: number; userId: string }[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [currentCheckIn, setCurrentCheckIn] = useState<{ present: boolean; weight: string }>({ present: false, weight: "" });
  const [historyModal, setHistoryModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!user?.id) return;
      try {
        const res = await fetch(`/api/progressions/logs/export?userId=${encodeURIComponent(user.id)}`);
        const data = await res.json();
        const logs: ProgressionLogEntry[] = data.logs || [];
        
        setAllLogs(logs);

        // Group logs by date (descending)
        const grouped = new Map<string, ProgressionLogEntry[]>();
        for (const log of logs) {
          const dateKey = log.createdAt.split("T")[0];
          if (!grouped.has(dateKey)) grouped.set(dateKey, []);
          grouped.get(dateKey)!.push(log);
        }
        const sessions: DaySession[] = Array.from(grouped.entries())
          .map(([date, logs]) => ({ date, logs }))
          .sort((a, b) => b.date.localeCompare(a.date));
        setDaySessions(sessions);

        // Calculate stats
        const now = new Date();
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const thisWeek = logs.filter(
          (l) => new Date(l.createdAt) >= oneWeekAgo
        ).length;

        const thisMonth = logs.filter(
          (l) => new Date(l.createdAt) >= oneMonthAgo
        ).length;

        setStats({
          total: logs.length,
          thisWeek,
          thisMonth,
        });

        // Calculate exercise frequency
        const exerciseMap = new Map<string, ExerciseStats>();
        for (const log of logs) {
          const key = log.exerciseName;
          if (!exerciseMap.has(key)) {
            exerciseMap.set(key, {
              id: log.exerciseId,
              name: log.exerciseName,
              count: 0,
              totalWeight: 0,
            });
          }
          const s = exerciseMap.get(key)!;
          s.count++;
          s.totalWeight += (log.weight1 || 0) + (log.weight2 || 0) + (log.weight3 || 0);
        }

        const sortedExercises = Array.from(exerciseMap.values()).sort((a, b) => b.count - a.count);
        setExerciseStats(sortedExercises);

        // Create chart data for top exercises
        const topExercises = sortedExercises.slice(0, 5);
        setChartData(
          topExercises.map((ex) => ({
            label: ex.name,
            value: ex.count,
            color: "from-jade-glow to-jade-light",
          }))
        );

      } catch (err) {
        console.error("Failed to fetch progression logs:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchLogs();
    }
  }, [user, dateFormat]);

  // Fetch check-ins and users
  useEffect(() => {
    const fetchCheckInsAndUsers = async () => {
      try {
        const [checkInsRes, usersRes] = await Promise.all([
          fetch("/api/checkins"),
          fetch("/api/users")
        ]);
        const checkInsData = await checkInsRes.json();
        const usersData = await usersRes.json();
        setAllCheckIns(checkInsData.checkins || []);
        setAllUsers(usersData.users || []);
      } catch (err) {
        console.error("Failed to fetch check-ins or users:", err);
      }
    };

    fetchCheckInsAndUsers();
  }, []);

  // Update currentCheckIn when selectedDate changes
  useEffect(() => {
    if (selectedDate && user) {
      const dateString = selectedDate.toISOString().split('T')[0];
      const existingCheckIn = allCheckIns.find(
        c => new Date(c.date).toISOString().split('T')[0] === dateString && c.userId === user.id
      );
      if (existingCheckIn) {
        setCurrentCheckIn({
          present: existingCheckIn.present,
          weight: existingCheckIn.weight?.toString() || ""
        });
      } else {
        setCurrentCheckIn({ present: false, weight: "" });
      }
    }
  }, [selectedDate, user, allCheckIns]);

  // Save check-in
  const saveCheckIn = async () => {
    if (!selectedDate || !user) return;

    try {
      const dateString = selectedDate.toISOString().split('T')[0];
      const response = await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: dateString,
          entries: {
            [user.id]: {
              present: currentCheckIn.present,
              weight: currentCheckIn.weight ? parseFloat(currentCheckIn.weight) : null
            }
          }
        })
      });

      if (response.ok) {
        // Refresh check-ins
        const checkInsRes = await fetch("/api/checkins");
        const checkInsData = await checkInsRes.json();
        setAllCheckIns(checkInsData.checkins || []);
      }
    } catch (err) {
      console.error("Failed to save check-in:", err);
    }
  };

  if (!user) return null;

  return (
    <PageLayout
      title="Ancient Records"
      subtitle="Review your past cultivation sessions"
      sidebar={<HistorySidebar stats={stats} exerciseStats={exerciseStats} />}
      sidebarLabel="Stats"
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
      ) : daySessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="text-5xl mb-4"
          >
            📖
          </motion.div>
          <h3 className="text-lg text-cloud-white mb-2">No Ancient Records</h3>
          <p className="text-sm text-mist-mid text-center max-w-md">
            Complete training sessions to build your cultivation history.
            Each session is recorded here for future reflection.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Visualizations Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <GlowCard glow="jade" className="p-4">
                <SimpleBarChart
                  title="Favorite Techniques"
                  data={chartData}
                  max={chartData.length > 0 ? Math.max(...chartData.map((d) => d.value)) : 1}
                />
              </GlowCard>
            </motion.div>

          </div>

          {/* Summary Stats */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <GlowCard glow="jade" className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-jade-glow">{stats.total}</div>
                  <div className="text-xs text-mist-mid mt-1">Total Sessions</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cloud-white">{exerciseStats.length}</div>
                  <div className="text-xs text-mist-mid mt-1">Unique Techniques</div>
                </div>
              </div>
            </GlowCard>
          </motion.div>

          {/* Calendar View - Cultivation Chronicle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <GlowCard glow="gold" className="p-5">
              <h3 className="text-sm font-semibold text-gold-glow uppercase mb-4 text-center tracking-wider">
                📅 Cultivation Chronicle
              </h3>
              
              {/* Month Navigator */}
              <div className="flex items-center justify-between mb-4">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  className="px-3 py-1 text-xs text-gold-glow hover:text-gold-light transition-colors"
                >
                  ◀ Previous
                </motion.button>
                <h4 className="text-base font-bold text-cloud-white">
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h4>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  className="px-3 py-1 text-xs text-gold-glow hover:text-gold-light transition-colors"
                >
                  Next ▶
                </motion.button>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {/* Day Headers */}
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center py-2 text-xs text-mist-dark font-semibold uppercase">
                    {day}
                  </div>
                ))}
                
                {/* Calendar Days */}
                {(() => {
                  const year = currentMonth.getFullYear();
                  const month = currentMonth.getMonth();
                  const firstDay = new Date(year, month, 1).getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days = [];
                  
                  // Empty cells for days before month starts
                  for (let i = 0; i < firstDay; i++) {
                    days.push(<div key={`empty-${i}`} className="aspect-square" />);
                  }
                  
                  // Days of the month
                  for (let day = 1; day <= daysInMonth; day++) {
                    const date = new Date(year, month, day);
                    const dateString = date.toISOString().split('T')[0];
                    const dayLogs = allLogs.filter(l => 
                      l.createdAt.split('T')[0] === dateString
                    );
                    const hasLogs = dayLogs.length > 0;
                    const isToday = new Date().toISOString().split('T')[0] === dateString;
                    
                    days.push(
                      <motion.button
                        key={day}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setSelectedDate(date);
                          setShowDatePopup(true);
                        }}
                        className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all relative cursor-pointer
                          ${hasLogs 
                            ? 'bg-gold-deep/30 border-2 border-gold-glow/50 hover:border-gold-glow hover:shadow-lg hover:shadow-gold-glow/30' 
                            : 'bg-ink-mid/30 border border-ink-light/20 hover:border-jade-glow/50 text-mist-mid hover:text-cloud-white'
                          }
                          ${isToday ? 'ring-2 ring-jade-glow ring-offset-2 ring-offset-ink-deep' : ''}
                        `}
                      >
                        <span className={hasLogs ? 'text-gold-light font-bold' : ''}>
                          {day}
                        </span>
                      </motion.button>
                    );
                  }
                  
                  return days;
                })()}
              </div>
            </GlowCard>
          </motion.div>

          {/* Date Popup - Sect Register Entry */}
          <AnimatePresence>
            {showDatePopup && selectedDate && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowDatePopup(false)}
                  className="fixed inset-0 bg-void-black/80 z-50 backdrop-blur-sm"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gradient-to-br from-ink-deep via-ink-mid to-ink-deep rounded-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto pointer-events-auto"
                    style={{
                      borderWidth: '3px',
                      borderStyle: 'solid',
                      borderImage: 'linear-gradient(135deg, #c4a84a, #8b5a3c, #c4a84a) 1',
                      boxShadow: '0 0 40px rgba(196, 168, 74, 0.4), inset 0 0 30px rgba(196, 168, 74, 0.1)',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 0 L30 30 L0 60 L30 30 L60 60 L30 30 L60 0 L30 30 Z' fill='none' stroke='rgba(196,168,74,0.05)' stroke-width='1'/%3E%3C/svg%3E")`
                    }}
                  >
                    {(() => {
                      const dateString = selectedDate.toISOString().split('T')[0];
                      const dayLogs = allLogs.filter(l => 
                        l.createdAt.split('T')[0] === dateString
                      );

                      return (
                        <div className="p-8">
                          {/* Decorative Cloud Pattern */}
                          <div className="absolute top-4 left-4 text-4xl opacity-20">☁️</div>
                          <div className="absolute top-4 right-4 text-4xl opacity-20">☁️</div>
                          
                          {/* Header with Close */}
                          <div className="flex items-start justify-between mb-6">
                            <div className="flex-1" />
                            <motion.button
                              whileHover={{ scale: 1.1, rotate: 90 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => setShowDatePopup(false)}
                              className="text-gold-glow hover:text-gold-light transition-colors text-2xl"
                            >
                              ✕
                            </motion.button>
                          </div>

                          {/* Title - Ancient Scroll Style */}
                          <div className="text-center mb-8">
                            <div className="inline-block">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-glow" />
                                <span className="text-2xl">📜</span>
                                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-glow" />
                              </div>
                              <h2 
                                className="text-3xl font-bold mb-2"
                                style={{
                                  fontFamily: "'Cinzel', serif",
                                  color: '#c4a84a',
                                  textShadow: '0 0 20px rgba(196, 168, 74, 0.5)'
                                }}
                              >
                                Sect Register Entry
                              </h2>
                              <p className="text-sm text-mist-mid uppercase tracking-[0.3em]" style={{ fontFamily: "'Cinzel', serif" }}>
                                {formatDateWithPreference(selectedDate, dateFormat)}
                              </p>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="h-px w-16 bg-gradient-to-r from-transparent to-gold-glow" />
                                <span className="text-xl">⚔️</span>
                                <div className="h-px w-16 bg-gradient-to-l from-transparent to-gold-glow" />
                              </div>
                            </div>
                          </div>

                          {/* Personal Check-In Section */}
                          <div className="mb-8 px-4 sm:px-8 md:px-12">
                            <div 
                              className="p-4 sm:p-6 rounded-lg border-2"
                              style={{
                                background: 'linear-gradient(135deg, rgba(45, 95, 79, 0.15), rgba(34, 26, 21, 0.3))',
                                borderColor: 'rgba(45, 95, 79, 0.5)',
                                boxShadow: 'inset 0 0 20px rgba(45, 95, 79, 0.1)'
                              }}
                            >
                              <div className="text-center mb-4">
                                <h3 
                                  className="text-xl font-bold mb-1"
                                  style={{
                                    fontFamily: "'Cinzel', serif",
                                    color: '#2d9d78',
                                    textShadow: '0 0 15px rgba(45, 157, 120, 0.4)'
                                  }}
                                >
                                  Cultivator {user.name}
                                </h3>
                                <p className="text-xs text-mist-mid uppercase tracking-wider" style={{ fontFamily: "'Cinzel', serif" }}>
                                  Personal Sect Register
                                </p>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Check-in Toggle */}
                                <div className="flex items-center justify-between p-3 bg-ink-dark/50 rounded border border-jade-glow/30">
                                  <label className="text-sm text-jade-light font-medium cursor-pointer" style={{ fontFamily: "'Cinzel', serif" }}>
                                    Present Today
                                  </label>
                                  <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={() => setCurrentCheckIn(prev => ({ ...prev, present: !prev.present }))}
                                    className={`w-12 h-6 rounded-full transition-all relative ${
                                      currentCheckIn.present ? 'bg-jade-glow' : 'bg-ink-mid border border-ink-light'
                                    }`}
                                  >
                                    <motion.div
                                      animate={{ x: currentCheckIn.present ? 24 : 0 }}
                                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full ${
                                        currentCheckIn.present ? 'bg-void-black' : 'bg-mist-mid'
                                      }`}
                                    />
                                  </motion.button>
                                </div>

                                {/* Weight Input */}
                                <div className="flex flex-col">
                                  <label className="text-xs text-mist-dark uppercase mb-1" style={{ fontFamily: "'Cinzel', serif" }}>
                                    Body Weight (kg)
                                  </label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={currentCheckIn.weight}
                                    onChange={(e) => setCurrentCheckIn(prev => ({ ...prev, weight: e.target.value }))}
                                    placeholder="Enter weight"
                                    className="px-3 py-2 bg-ink-mid border border-ink-light/50 rounded text-sm text-cloud-white placeholder:text-mist-dark/60 focus:border-jade-glow focus:ring-1 focus:ring-jade-glow/50 outline-none transition-all"
                                  />
                                </div>
                              </div>

                              {/* Save Button */}
                              <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={saveCheckIn}
                                className="w-full mt-4 px-4 py-2 rounded-lg font-bold text-sm bg-jade-glow text-void-black hover:bg-jade-light transition-all shadow-lg"
                                style={{ fontFamily: "'Cinzel', serif" }}
                              >
                                💾 Save Check-In
                              </motion.button>
                            </div>
                          </div>

                          {/* Community Check-Ins */}
                          {(() => {
                            const dateString = selectedDate.toISOString().split('T')[0];
                            const dateCheckIns = allCheckIns.filter(
                              c => new Date(c.date).toISOString().split('T')[0] === dateString
                            );
                            
                            if (allUsers.length > 1) {
                              return (
                                <div className="mb-8 px-4 sm:px-8 md:px-12">
                                  <div 
                                    className="p-4 sm:p-6 rounded-lg border-2"
                                    style={{
                                      background: 'linear-gradient(135deg, rgba(196, 168, 74, 0.1), rgba(139, 90, 60, 0.1))',
                                      borderColor: 'rgba(196, 168, 74, 0.3)',
                                      boxShadow: 'inset 0 0 20px rgba(196, 168, 74, 0.1)'
                                    }}
                                  >
                                    <h3 
                                      className="text-center text-sm uppercase tracking-[0.3em] text-gold-glow font-bold mb-4"
                                      style={{ fontFamily: "'Cinzel', serif" }}
                                    >
                                      🏯 Sect Members Present
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {allUsers.filter(u => u.id !== user.id).map(member => {
                                        const memberCheckIn = dateCheckIns.find(c => c.userId === member.id);
                                        const isPresent = memberCheckIn?.present || false;
                                        const weight = memberCheckIn?.weight;

                                        return (
                                          <div
                                            key={member.id}
                                            className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                              isPresent
                                                ? 'bg-jade-deep/20 border border-jade-glow/40'
                                                : 'bg-ink-dark/30 border border-ink-light/20'
                                            }`}
                                          >
                                            <div className="flex items-center gap-2">
                                              <span className="text-xl">
                                                {isPresent ? '✓' : '○'}
                                              </span>
                                              <span className={`text-sm font-medium ${
                                                isPresent ? 'text-jade-light' : 'text-mist-mid'
                                              }`} style={{ fontFamily: "'Cinzel', serif" }}>
                                                {member.name}
                                              </span>
                                            </div>
                                            {isPresent && weight && (
                                              <span className="text-xs text-gold-glow font-bold">
                                                {weight} kg
                                              </span>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          })()}

                          {/* Training Logs */}
                          <div className="space-y-4">
                            <h3 
                              className="text-center text-sm uppercase tracking-[0.3em] text-gold-glow font-bold mb-4"
                              style={{ fontFamily: "'Cinzel', serif" }}
                            >
                              Training Logs
                            </h3>
                            {dayLogs.length === 0 ? (
                              <p className="text-center text-xs text-mist-dark italic">No training logs for this date.</p>
                            ) : (
                              <div className="space-y-2">
                                {dayLogs.map((log, i) => (
                                  <motion.div
                                    key={i}
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    className="flex items-center justify-between text-xs bg-ink-dark/50 px-3 py-2 rounded border border-ink-light/30 cursor-pointer hover:border-jade-glow/30 hover:bg-jade-deep/10 transition-all"
                                    onClick={() => setHistoryModal({ exerciseId: log.exerciseId, exerciseName: log.exerciseName })}
                                  >
                                    <span className="text-jade-light font-medium">{log.exerciseName} <span className="text-mist-dark">Lv.{log.level}</span></span>
                                    <div className="flex items-center gap-3 text-mist-mid flex-wrap">
                                      {log.reps1 && <span className="text-purple-300">Set 1: {log.weight1 || "—"}kg × {log.reps1}</span>}
                                      {log.reps2 && <span className="text-purple-300">Set 2: {log.weight2 || "—"}kg × {log.reps2}</span>}
                                      {log.reps3 && <span className="text-purple-300">Set 3: {log.weight3 || "—"}kg × {log.reps3}</span>}
                                      {log.holdTime && <span className="text-blue-300">Hold: {log.holdTime}s</span>}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Footer Decoration */}
                          <div className="mt-8 text-center">
                            <div className="inline-flex items-center gap-3 text-gold-glow/40">
                              <span>⚔️</span>
                              <div className="h-px w-24 bg-gold-glow/20" />
                              <span>🏔️</span>
                              <div className="h-px w-24 bg-gold-glow/20" />
                              <span>🐉</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>

          {/* Training Log List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-jade-glow uppercase">Recent Sessions</h3>
            {daySessions.map((session, i) => (
                <motion.div
                  key={session.date}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.03 }}
                >
                  <GlowCard glow="jade" className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-cloud-white">
                          Training Session
                        </h3>
                        <p className="text-xs text-mist-dark mt-1">
                          {formatDateWithPreference(new Date(session.date), dateFormat)}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-mist-dark">
                          {session.logs.length} log{session.logs.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {session.logs.slice(0, 5).map((log, j) => {
                        const totalWeight = (log.weight1 || 0) + (log.weight2 || 0) + (log.weight3 || 0);
                        const displayWeight = totalWeight > 0 ? `${totalWeight} kg` : "—";
                        
                        return (
                          <div
                            key={j}
                            className="text-xs bg-ink-dark px-2 py-1 rounded text-cloud-white flex items-center gap-1 cursor-pointer hover:bg-jade-deep/20 hover:ring-1 hover:ring-jade-glow/30 transition-all"
                            title={`Tap to view history for ${log.exerciseName}`}
                            onClick={() => setHistoryModal({ exerciseId: log.exerciseId, exerciseName: log.exerciseName })}
                          >
                            <span>{log.exerciseName}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-jade-deep/30 text-jade-glow">
                              Lv.{log.level}
                            </span>
                            <span className="text-mist-dark ml-1">
                              ({displayWeight})
                            </span>
                          </div>
                        );
                      })}
                      {session.logs.length > 5 && (
                        <div className="text-xs bg-ink-dark px-2 py-1 rounded text-mist-dark">
                          +{session.logs.length - 5} more
                        </div>
                      )}
                    </div>
                  </GlowCard>
                </motion.div>
            ))}
          </div>
        </div>
      )}
      {/* Exercise History Modal */}
      {historyModal && (
        <ExerciseHistoryModal
          exerciseId={historyModal.exerciseId}
          exerciseName={historyModal.exerciseName}
          isOpen={true}
          onClose={() => setHistoryModal(null)}
        />
      )}
    </PageLayout>
  );
}
