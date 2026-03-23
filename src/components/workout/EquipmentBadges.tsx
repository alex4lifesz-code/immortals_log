import type { ProgressionExercise, ProgressionLog } from "@/app/dashboard/workout/types";

export function EquipmentBadges({ exercise }: { exercise: ProgressionExercise }) {
  const badges: { label: string; color: string }[] = [];
  if (exercise.bodyweight) badges.push({ label: "BW", color: "text-jade-glow border-jade/40" });
  if (exercise.weighted) badges.push({ label: "W", color: "text-gold border-gold-dim/40" });
  if (exercise.rings) badges.push({ label: "R", color: "text-crimson-light border-crimson/40" });
  if (badges.length === 0) badges.push({ label: exercise.equipmentType, color: "text-mist-light border-ink-light" });

  return (
    <div className="flex gap-0.5">
      {badges.map((b) => (
        <span key={b.label} className={`text-[9px] px-1 py-0 border rounded ${b.color}`}>
          {b.label}
        </span>
      ))}
    </div>
  );
}

export function LevelStatus({ tierLevel, currentLevel, logs }: { tierLevel: number; currentLevel: number; logs: ProgressionLog[] }) {
  const completedLogs = logs.filter((l) => l.level === tierLevel && l.completed);
  if (completedLogs.length > 0) return <span className="text-jade-glow text-xs">✦</span>;
  if (tierLevel === currentLevel) return <span className="text-gold text-xs animate-pulse">◆</span>;
  if (tierLevel < currentLevel) return <span className="text-jade/60 text-xs">✓</span>;
  return <span className="text-mist-dark text-xs">○</span>;
}
