"use client";

import { useMemo, useState } from "react";
import { GlowModal } from "@/components/ui/GlowCard";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique, saveUserPhysique, UserGender } from "@/lib/user-physique";

interface UserPhysiqueButtonProps {
  userId: string;
  userName: string;
  className?: string;
}

export default function UserPhysiqueButton({ userId, userName, className }: UserPhysiqueButtonProps) {
  const initial = useMemo(() => loadUserPhysique(userId), [userId]);
  const [open, setOpen] = useState(false);
  const [gender, setGender] = useState<UserGender>(initial.gender);
  const [bodyWeightKg, setBodyWeightKg] = useState(initial.bodyWeightKg != null ? String(initial.bodyWeightKg) : "");

  const handleOpen = () => {
    const latest = loadUserPhysique(userId);
    setGender(latest.gender);
    setBodyWeightKg(latest.bodyWeightKg != null ? String(latest.bodyWeightKg) : "");
    setOpen(true);
  };

  const handleSave = () => {
    const nextWeight = bodyWeightKg.trim() ? Number(bodyWeightKg) : null;
    saveUserPhysique(userId, {
      gender,
      bodyWeightKg: Number.isFinite(nextWeight as number) ? nextWeight : null,
    });
    setOpen(false);
  };

  const parsedWeight = bodyWeightKg.trim() ? Number(bodyWeightKg) : null;
  const canSave = bodyWeightKg.trim().length === 0 || (Number.isFinite(parsedWeight) && (parsedWeight as number) > 0);

  return (
    <>
      <button
        onClick={handleOpen}
        className={className || "text-xs text-cloud-white font-medium truncate hover:text-jade-glow transition-colors"}
        title="Open user physique settings"
      >
        {userName}
      </button>

      <GlowModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="User Settings"
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-mist-light">
            Used to auto-select gym progression tier from average set weight vs bodyweight percentage.
          </p>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-mist-light uppercase tracking-wider">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value as UserGender)}
              className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-sm text-cloud-white outline-none focus:border-jade-glow/50"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-mist-light uppercase tracking-wider">Bodyweight (kg)</label>
            <input
              type="number"
              min="1"
              step="0.1"
              value={bodyWeightKg}
              onChange={(e) => setBodyWeightKg(e.target.value)}
              placeholder="e.g. 82.5"
              className="w-full bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark outline-none focus:border-jade-glow/50"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                setGender(DEFAULT_USER_PHYSIQUE.gender);
                setBodyWeightKg("");
              }}
              className="flex-1 px-3 py-2 rounded-lg text-xs border border-ink-light text-mist-light hover:bg-ink-mid/30 transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 px-3 py-2 rounded-lg text-xs border border-jade/50 bg-jade-deep/30 text-jade-light hover:bg-jade-deep/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </GlowModal>
    </>
  );
}
