"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
import GlowCard from "@/components/ui/GlowCard";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { formatDateWithPreference } from "@/lib/constants";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import {
  DEFAULT_USER_PHYSIQUE,
  extractLatestWeightPayload,
  loadUserPhysique,
  saveUserPhysique,
  syncWeightFromLatestCheckin,
  type UserGender,
} from "@/lib/user-physique";

export default function ProfilePage() {
  const router = useRouter();
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const [gender, setGender] = useState<UserGender>(DEFAULT_USER_PHYSIQUE.gender);
  const [bodyWeightKg, setBodyWeightKg] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [latestCheckinWeight, setLatestCheckinWeight] = useState<{ weight: number; date: string | null } | null>(null);
  const [checkinWeightLoading, setCheckinWeightLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  useEffect(() => {
    if (!user?.id) return;
    const current = loadUserPhysique(user.id);
    setGender(current.gender);
    setBodyWeightKg(current.bodyWeightKg != null ? String(current.bodyWeightKg) : "");
    setSyncEnabled(current.syncWeightFromCheckins === true);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    setCheckinWeightLoading(true);

    fetch("/api/checkins/latest-weight", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;

        const latest = extractLatestWeightPayload(data);
        if (latest.weight != null) {
          setLatestCheckinWeight({ weight: latest.weight, date: latest.date });
        } else {
          setLatestCheckinWeight(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLatestCheckinWeight(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCheckinWeightLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleToggleSync = (enabled: boolean) => {
    setSyncEnabled(enabled);
    if (enabled && latestCheckinWeight) {
      setBodyWeightKg(String(latestCheckinWeight.weight));
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    const nextWeight = bodyWeightKg.trim() ? Number(bodyWeightKg) : null;
    saveUserPhysique(user.id, {
      gender,
      bodyWeightKg: Number.isFinite(nextWeight as number) ? nextWeight : null,
      syncWeightFromCheckins: syncEnabled,
    });

    if (syncEnabled) {
      const syncedWeight = await syncWeightFromLatestCheckin(user.id);
      if (syncedWeight != null) {
        setBodyWeightKg(String(syncedWeight));
      }
    }

    setSaveMessage("Profile updated");
    window.setTimeout(() => setSaveMessage(""), 1800);
  };

  const formattedLatestCheckinDate = latestCheckinWeight?.date
    ? formatDateWithPreference(latestCheckinWeight.date, settings.dateFormat || "dd-mmm-yyyy", settings.timeZone)
    : "-";

  return (
    <PageLayout
      title="Profile"
      subtitle="View your account information and update your physique settings"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-4 px-0 py-2 sm:py-3">
        <GlowCard glow="jade" hoverable={false}>
          <h3 className="mb-3 text-sm uppercase tracking-wider text-jade-glow">Account Summary</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Name</p>
              <p className="text-sm text-cloud-white">{user?.name || "Unknown"}</p>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Username</p>
              <p className="text-sm text-cloud-white">{user?.username || "Unknown"}</p>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Role</p>
              <p className="text-sm text-cloud-white">{user?.role || "user"}</p>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Time Zone</p>
              <p className="text-sm text-cloud-white">{settings.timeZone || "UTC"}</p>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Language</p>
              <p className="text-sm text-cloud-white">{settings.languageMode}</p>
            </div>
            <div className="rounded-lg border border-ink-light/40 bg-ink-dark/40 px-3 py-2">
              <p className="text-[11px] uppercase tracking-wide text-mist-dark">Weight Unit</p>
              <p className="text-sm text-cloud-white">{settings.defaultWeightUnit}</p>
            </div>
          </div>
        </GlowCard>

        <GlowCard glow="jade" hoverable={false}>
          <h3 className="mb-3 text-sm uppercase tracking-wider text-jade-glow">Physique Settings</h3>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[11px] uppercase tracking-wider text-mist-light">Gender</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setGender("male")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                    gender === "male"
                      ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                      : "border-ink-light bg-ink-dark text-mist-light"
                  }`}
                >
                  Male
                </button>
                <button
                  type="button"
                  onClick={() => setGender("female")}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm transition-all ${
                    gender === "female"
                      ? "border-jade-glow/50 bg-jade-deep/30 text-jade-light"
                      : "border-ink-light bg-ink-dark text-mist-light"
                  }`}
                >
                  Female
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] uppercase tracking-wider text-mist-light">Sync weight from check-ins</label>
                <button
                  type="button"
                  role="switch"
                  aria-checked={syncEnabled}
                  onClick={() => handleToggleSync(!syncEnabled)}
                  className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${
                    syncEnabled ? "bg-jade-glow/70" : "bg-ink-light/50"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
                      syncEnabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="0.1"
                  value={bodyWeightKg}
                  onChange={(event) => {
                    if (!syncEnabled) setBodyWeightKg(event.target.value);
                  }}
                  readOnly={syncEnabled}
                  placeholder="e.g. 82.5"
                  className={`flex-1 rounded-lg border border-ink-light bg-ink-dark px-3 py-2 text-sm text-cloud-white outline-none ${
                    syncEnabled ? "cursor-not-allowed opacity-70" : ""
                  }`}
                />
                {!syncEnabled && latestCheckinWeight ? (
                  <GlowButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setBodyWeightKg(String(latestCheckinWeight.weight))}
                  >
                    Use Last Weight
                  </GlowButton>
                ) : null}
              </div>

              <p className="text-xs text-mist-dark">
                {checkinWeightLoading
                  ? "Loading latest check-in…"
                  : latestCheckinWeight
                    ? `Latest check-in: ${latestCheckinWeight.weight} kg on ${formattedLatestCheckinDate}`
                    : "No check-in weight recorded yet"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <GlowButton variant="jade" onClick={handleSave}>
                Save Profile
              </GlowButton>
              <GlowButton variant="ghost" onClick={() => router.push(DASHBOARD_ROUTES.friends)}>
                Friends
              </GlowButton>
              <GlowButton variant="ghost" onClick={() => router.push(DASHBOARD_ROUTES.settings)}>
                Settings
              </GlowButton>
            </div>

            {saveMessage ? <p className="text-sm text-jade-glow">{saveMessage}</p> : null}
          </div>
        </GlowCard>
      </div>
    </PageLayout>
  );
}
