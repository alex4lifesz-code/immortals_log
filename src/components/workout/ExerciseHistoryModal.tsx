"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GlowModal } from "@/components/ui/GlowCard";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings, DISPLAY_DEFAULTS } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";
import { t, tHint } from "@/lib/terminology";

interface ExerciseHistoryModalProps {
  exerciseId: string;
  exerciseName: string;
  isOpen: boolean;
  onClose: () => void;
}

interface HistoryEntry {
  id: string;
  date: string;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  notes: string | null;
}

export default function ExerciseHistoryModal({ exerciseId, exerciseName, isOpen, onClose }: ExerciseHistoryModalProps) {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const [historyData, setHistoryData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user?.id || !exerciseId) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loading state before async fetch
    setLoading(true);
    fetch(`/api/exercises/history?exerciseId=${encodeURIComponent(exerciseId)}`, { credentials: "include" })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (!cancelled) setHistoryData(data.history || []); })
      .catch(() => { if (!cancelled) setHistoryData([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isOpen, exerciseId, user?.id]);

  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title={`${t("Training History", "normal")} — ${exerciseName}`}>
      {loading ? (
        <div className="text-center py-6">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-5 h-5 border-2 border-jade-glow border-t-transparent rounded-full mx-auto"
          />
          <p className="text-xs text-mist-dark mt-2" title={tHint("Loading history...", "normal") ?? undefined}>{t("Loading history...", "normal")}</p>
        </div>
      ) : historyData.length === 0 ? (
        <div className="text-center py-6">
          <div className="text-3xl mb-3 opacity-50">📜</div>
          <p className="text-xs text-mist-dark" title={tHint("No training sessions recorded for this technique yet.", "normal") ?? undefined}>{t("No training sessions recorded for this technique yet.", "normal")}</p>
        </div>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto overflow-x-auto sidebar-scroll">
          <table className="w-full text-[11px] min-w-[400px]">
            <thead className="sticky top-0 bg-ink-deep">
              <tr className="border-b border-ink-light/40 text-mist-dark">
                <th className="text-left py-1.5 px-1.5 font-semibold" title={tHint("Date", "normal") ?? undefined}>{t("Date", "normal")}</th>
                {(DISPLAY_DEFAULTS.columnOrderGrouped ? ["W1","W2","W3","R1","R2","R3"] : ["W1","R1","W2","R2","W3","R3"]).map(h => (
                  <th
                    key={h}
                    className="text-center py-1.5 px-1 font-semibold"
                    style={
                      DISPLAY_DEFAULTS.columnColorsEnabled && h.startsWith('W')
                        ? { color: 'var(--col-weight)' }
                        : DISPLAY_DEFAULTS.columnColorsEnabled && h.startsWith('R')
                          ? { color: 'var(--col-reps)' }
                          : undefined
                    }
                  >{h}</th>
                ))}
                <th className="text-center py-1.5 px-1 font-semibold" style={{ color: 'var(--mountain-blue-glow)' }} title={tHint("Hold", "normal") ?? undefined}>{t("Hold", "normal")}</th>
                <th className="text-left py-1.5 px-1.5 font-semibold" title={tHint("Notes", "normal") ?? undefined}>{t("Notes", "normal")}</th>
              </tr>
            </thead>
            <tbody>
              {historyData.map((entry) => {
                const colTypes = DISPLAY_DEFAULTS.columnOrderGrouped
                  ? ['weight','weight','weight','reps','reps','reps'] as const
                  : ['weight','reps','weight','reps','weight','reps'] as const;
                const fields = DISPLAY_DEFAULTS.columnOrderGrouped
                  ? [entry.weight1, entry.weight2, entry.weight3, entry.reps1, entry.reps2, entry.reps3]
                  : [entry.weight1, entry.reps1, entry.weight2, entry.reps2, entry.weight3, entry.reps3];
                return (
                <tr key={entry.id} className="border-b border-ink-light/20 hover:bg-ink-mid/10">
                  <td className="py-1.5 px-1.5 text-mist-light whitespace-nowrap">
                    {formatDateWithPreference(new Date(entry.date), settings.dateFormat || "dd-mmm-yyyy")}
                  </td>
                  {fields.map((v, i) => (
                    <td
                      key={i}
                      className="py-1.5 px-1 text-center text-cloud-white"
                      style={
                        DISPLAY_DEFAULTS.columnColorsEnabled && colTypes[i] === 'weight'
                          ? { backgroundColor: 'var(--col-weight-bg)' }
                          : DISPLAY_DEFAULTS.columnColorsEnabled && colTypes[i] === 'reps'
                            ? { backgroundColor: 'var(--col-reps-bg)' }
                            : undefined
                      }
                    >{v != null ? v : "—"}</td>
                  ))}
                  <td className="py-1.5 px-1 text-center text-mountain-blue-glow">{entry.holdTime != null ? `${entry.holdTime}s` : "—"}</td>
                  <td className="py-1.5 px-1.5 text-mist-dark truncate max-w-[100px]" title={entry.notes || ""}>{entry.notes || "—"}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </GlowModal>
  );
}
