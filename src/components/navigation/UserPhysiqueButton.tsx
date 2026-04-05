"use client";

import { useEffect, useMemo, useState } from "react";
import { GlowModal } from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { t, tHint } from "@/lib/terminology";
import { DEFAULT_USER_PHYSIQUE, loadUserPhysique, saveUserPhysique, syncWeightFromLatestCheckin, UserGender } from "@/lib/user-physique";

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
  const [syncEnabled, setSyncEnabled] = useState(initial.syncWeightFromCheckins === true);
  const [latestCheckinWeight, setLatestCheckinWeight] = useState<{ weight: number; date: string } | null>(null);
  const [checkinWeightLoading, setCheckinWeightLoading] = useState(false);
  const [checkinWeightError, setCheckinWeightError] = useState("");

  // Auto-sync weight on mount if sync is enabled
  useEffect(() => {
    const current = loadUserPhysique(userId);
    if (current.syncWeightFromCheckins) {
      syncWeightFromLatestCheckin(userId);
    }
  }, [userId]);

  const handleOpen = () => {
    const latest = loadUserPhysique(userId);
    setGender(latest.gender);
    setBodyWeightKg(latest.bodyWeightKg != null ? String(latest.bodyWeightKg) : "");
    setSyncEnabled(latest.syncWeightFromCheckins === true);
    setCheckinWeightError("");
    setLatestCheckinWeight(null);
    setCheckinWeightLoading(true);
    setOpen(true);

    fetch("/api/checkins/latest-weight", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.weight != null) {
          setLatestCheckinWeight({ weight: data.weight, date: data.date });
          // If sync is enabled, immediately populate with latest value
          if (latest.syncWeightFromCheckins) {
            setBodyWeightKg(String(data.weight));
          }
        } else {
          setCheckinWeightError("No check-in weight records found");
        }
      })
      .catch(() => {
        setCheckinWeightError("Failed to load check-in data");
      })
      .finally(() => {
        setCheckinWeightLoading(false);
      });
  };

  const handleToggleSync = (enabled: boolean) => {
    setSyncEnabled(enabled);
    if (enabled && latestCheckinWeight) {
      setBodyWeightKg(String(latestCheckinWeight.weight));
    }
  };

  const handleSave = () => {
    const nextWeight = bodyWeightKg.trim() ? Number(bodyWeightKg) : null;
    saveUserPhysique(userId, {
      gender,
      bodyWeightKg: Number.isFinite(nextWeight as number) ? nextWeight : null,
      syncWeightFromCheckins: syncEnabled,
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
        title={tHint("Open user physique settings", "normal") ?? undefined}
      >
        {userName}
      </button>

      <GlowModal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t("User Settings", "normal")}
        titleHint={tHint("User Settings", "normal")}
        panelClassName="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-mist-light" title={tHint("Used to auto-select gym progression tier from average set weight vs bodyweight percentage.", "normal") ?? undefined}>
            {t("Used to auto-select gym progression tier from average set weight vs bodyweight percentage.", "normal")}
          </p>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-mist-light uppercase tracking-wider" title={tHint("Gender", "normal") ?? undefined}>{t("Gender", "normal")}</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGender("male")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                  gender === "male"
                    ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                    : "border-ink-light bg-ink-dark text-mist-light hover:border-jade/30"
                }`}
              >
                ♂️ {t("Male", "normal")}
              </button>
              <button
                type="button"
                onClick={() => setGender("female")}
                className={`flex-1 px-3 py-2 rounded-lg text-sm border transition-all duration-200 ${
                  gender === "female"
                    ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                    : "border-ink-light bg-ink-dark text-mist-light hover:border-jade/30"
                }`}
              >
                ♀️ {t("Female", "normal")}
              </button>
            </div>
            <p className="text-[9px] text-mist-dark/70 italic" title={tHint("Gender affects weight standard calculations for your tier", "normal") ?? undefined}>{t("Gender affects weight standard calculations for your tier", "normal")}</p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[11px] text-mist-light uppercase tracking-wider" title={tHint("Bodyweight (kg)", "normal") ?? undefined}>{t("Bodyweight (kg)", "normal")}</label>

            {/* Sync Toggle */}
            <div className="flex items-center justify-between py-1.5">
              <span className="text-[10px] text-mist-light/80" title={tHint("Sync with Check-In Weight", "normal") ?? undefined}>{t("Sync with Check-In Weight", "normal")}</span>
              <button
                type="button"
                role="switch"
                aria-checked={syncEnabled}
                onClick={() => handleToggleSync(!syncEnabled)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-jade-glow/40 ${
                  syncEnabled ? 'bg-jade-glow/70' : 'bg-ink-light/50'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transform transition-transform duration-200 ${
                    syncEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {syncEnabled && (
              <p className="text-[9px] text-jade-glow/70 italic">
                {latestCheckinWeight
                  ? t("Automatically updated from check-ins", "normal")
                  : checkinWeightError
                    ? t(checkinWeightError, "normal")
                    : t("Loading check-in data...", "normal")
                }
              </p>
            )}

            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="0.1"
                value={bodyWeightKg}
                onChange={(e) => { if (!syncEnabled) setBodyWeightKg(e.target.value); }}
                readOnly={syncEnabled}
                placeholder={t("e.g. 82.5", "normal")}
                className={`flex-1 bg-ink-dark border border-ink-light rounded-lg px-3 py-2 text-sm text-cloud-white placeholder:text-mist-dark outline-none focus:border-jade-glow/50 ${
                  syncEnabled ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              />
              {!syncEnabled && (
                checkinWeightLoading ? (
                  <span className="self-center text-[10px] text-mist-dark animate-pulse whitespace-nowrap">{t("Loading...", "normal")}</span>
                ) : latestCheckinWeight ? (
                  <button
                    type="button"
                    onClick={() => setBodyWeightKg(String(latestCheckinWeight.weight))}
                    className="whitespace-nowrap rounded-lg border border-jade/40 bg-jade-deep/20 px-2.5 py-2 text-[10px] font-semibold text-jade-light transition-all hover:bg-jade-deep/40 hover:border-jade-glow/60"
                    title={tHint("Use Last Known Weight", "normal") ?? undefined}
                  >
                    {t("Use Last Known Weight", "normal")}
                  </button>
                ) : checkinWeightError ? (
                  <span className="self-center text-[10px] text-mist-dark/60 whitespace-nowrap">{t(checkinWeightError, "normal")}</span>
                ) : null
              )}
            </div>
            {latestCheckinWeight && (
              <p className="text-[10px] text-mist-dark">
                {t("Last check-in:", "normal")} {latestCheckinWeight.weight} kg ({new Date(latestCheckinWeight.date).toLocaleDateString()})
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <GlowButton
              variant="ghost"
              size="sm"
              className="flex-1"
              onClick={() => {
                setGender(DEFAULT_USER_PHYSIQUE.gender);
                setBodyWeightKg("");
                setSyncEnabled(false);
              }}
            >
              Clear
            </GlowButton>
            <GlowButton
              variant="jade"
              size="sm"
              className="flex-1"
              onClick={handleSave}
              disabled={!canSave}
            >
              Save
            </GlowButton>
          </div>
        </div>
      </GlowModal>
    </>
  );
}
