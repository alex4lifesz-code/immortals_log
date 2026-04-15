"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/layout/PageLayout";
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

type ProfileCheckin = {
  userId?: string;
  weight?: number | string | null;
  date?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { settings } = useDisplaySettings();
  const [gender, setGender] = useState<UserGender>(DEFAULT_USER_PHYSIQUE.gender);
  const [bodyWeightKg, setBodyWeightKg] = useState("");
  const [syncEnabled, setSyncEnabled] = useState(false);
  const [latestCheckinWeight, setLatestCheckinWeight] = useState<{ weight: number; date: string | null } | null>(null);
  const [checkinWeightLoading, setCheckinWeightLoading] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [weightTrendLabel, setWeightTrendLabel] = useState<string | null>(null);
  const [checkInTotalCount, setCheckInTotalCount] = useState<number | null>(null);
  const [isPhysiqueExpanded, setIsPhysiqueExpanded] = useState(false);

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

  useEffect(() => {
    if (!user?.id) {
      setWeightTrendLabel(null);
      setCheckInTotalCount(null);
      return;
    }

    let cancelled = false;

    fetch("/api/checkins", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;

        const rawCheckins: ProfileCheckin[] = Array.isArray(data?.checkins) ? (data.checkins as ProfileCheckin[]) : [];
        const userCheckIns = rawCheckins.filter((checkin: ProfileCheckin) => checkin.userId === user.id);
        setCheckInTotalCount(userCheckIns.length);

        const userWeights = userCheckIns
          .filter((checkin: ProfileCheckin) => checkin.weight != null && Number.isFinite(Number(checkin.weight)) && Number(checkin.weight) > 0)
          .map((checkin: ProfileCheckin) => ({ date: String(checkin.date), weight: Number(checkin.weight) }))
          .sort((a, b) => a.date.localeCompare(b.date));

        if (userWeights.length < 2) {
          setWeightTrendLabel(null);
          return;
        }

        const first = userWeights[0].weight;
        const latest = userWeights[userWeights.length - 1].weight;
        if (!Number.isFinite(first) || first <= 0 || !Number.isFinite(latest)) {
          setWeightTrendLabel(null);
          return;
        }

        const changePct = ((latest - first) / first) * 100;
        const absPct = Math.abs(changePct).toFixed(1);
        if (absPct === "0.0") {
          setWeightTrendLabel("0.0%");
          return;
        }

        setWeightTrendLabel(changePct >= 0 ? `+${absPct}%` : `-${absPct}%`);
      })
      .catch(() => {
        if (!cancelled) {
          setWeightTrendLabel(null);
          setCheckInTotalCount(null);
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

  const quickAccessItems = [
    { id: "profile", label: "Profile", path: DASHBOARD_ROUTES.profile, icon: "👤" },
    { id: "checkin", label: "Check-In", path: DASHBOARD_ROUTES.checkIn, icon: "📝" },
    { id: "settings", label: "Settings", path: DASHBOARD_ROUTES.settings, icon: "⚙️" },
    { id: "friends", label: "Friends", path: DASHBOARD_ROUTES.friends, icon: "👥" },
  ] as const;

  const pageItems = [
    { id: "train", label: "Train", path: DASHBOARD_ROUTES.workoutHistory, icon: "🕘" },
    { id: "community", label: "Community Feed", path: DASHBOARD_ROUTES.community, icon: "🌐" },
    { id: "completionist", label: "Completionist", path: DASHBOARD_ROUTES.rankUp, icon: "✅" },
    { id: "exercises", label: "Exercise Library", path: DASHBOARD_ROUTES.exercises, icon: "📚" },
  ] as const;

  const adminItems = user?.role === "admin"
    ? [
        { id: "website-information", label: "Website Information", path: DASHBOARD_ROUTES.websiteInformation, icon: "🛠️" },
        { id: "admin", label: "Admin Panel", path: DASHBOARD_ROUTES.admin, icon: "🛡️" },
      ] as const
    : [];

  return (
    <PageLayout
      title="Me"
      mobileContentPaddingClass="p-2 pb-24"
    >
      <div className="space-y-3 px-0 py-2 sm:py-3">
        <section className="rounded-md border border-[#32353b] bg-[#2b2d31] p-3 shadow-[0_10px_26px_rgba(0,0,0,0.28)]">
          <div className="mb-3 border-b border-[#32353b] pb-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#b5bac1]">Me</span>
            <p className="mt-1 text-[13px] text-[#949ba4]">Profile, settings and personal pages</p>
          </div>

          {user && (
            <div className="mb-3 rounded-md border border-[#3b3f48] bg-[#313338] p-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-[#3b3f48] bg-[#383a40] text-[#f2f3f5]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[#f2f3f5]">{user.name}</p>
                  <p className="truncate text-[11px] text-[#949ba4]">@{user.username}</p>
                  <p className="mt-1 text-[12px] text-[#b5bac1]">Open your profile and manage personal preferences.</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Weight</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#f2f3f5]">{bodyWeightKg || "--"}{bodyWeightKg ? " kg" : ""}</p>
                </div>
                <div className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Trend</p>
                  <p
                    className="mt-1 text-[12px] font-semibold"
                    style={{
                      color:
                        weightTrendLabel?.startsWith("+")
                          ? "var(--difficulty-green)"
                          : weightTrendLabel?.startsWith("-")
                            ? "var(--difficulty-red)"
                            : "#f2f3f5",
                    }}
                  >
                    {weightTrendLabel ?? "--"}
                  </p>
                </div>
                <div className="rounded-md border border-[#3b3f48] bg-[#2b2d31] px-2.5 py-2">
                  <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Check-ins</p>
                  <p className="mt-1 text-[12px] font-semibold text-[#f2f3f5]">{checkInTotalCount ?? 0}</p>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-[#3b3f48] bg-[#2b2d31] p-2.5">
                <button
                  type="button"
                  onClick={() => setIsPhysiqueExpanded((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 text-left"
                  aria-expanded={isPhysiqueExpanded}
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Physique</p>
                    <p className="mt-1 truncate text-[11px] text-[#dbdee1]">
                      {gender === "male" ? "Male" : "Female"} • {bodyWeightKg ? `${bodyWeightKg} kg` : "No weight set"} • {syncEnabled ? "Synced" : "Manual"}
                    </p>
                  </div>
                  <span className="rounded-md border border-[#3b3f48] bg-[#313338] px-2 py-1 text-[11px] font-semibold text-[#f2f3f5]">
                    {isPhysiqueExpanded ? "Hide" : "Edit"}
                  </span>
                </button>

                {isPhysiqueExpanded ? (
                  <div className="mt-2 border-t border-[#3b3f48] pt-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setGender("male")}
                        className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-all ${
                          gender === "male"
                            ? "border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]"
                            : "border-[#3b3f48] bg-[#313338] text-[#dbdee1]"
                        }`}
                      >
                        Male
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender("female")}
                        className={`rounded-md border px-2.5 py-1.5 text-[11px] transition-all ${
                          gender === "female"
                            ? "border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]"
                            : "border-[#3b3f48] bg-[#313338] text-[#dbdee1]"
                        }`}
                      >
                        Female
                      </button>

                      <label className="ml-auto flex items-center gap-2 text-[11px] text-[#dbdee1]">
                        <span>Sync</span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={syncEnabled}
                          onClick={() => handleToggleSync(!syncEnabled)}
                          className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${
                            syncEnabled ? "bg-[#5865f2]" : "bg-[#4f545c]"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
                              syncEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </label>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={bodyWeightKg}
                        onChange={(event) => {
                          if (!syncEnabled) setBodyWeightKg(event.target.value);
                        }}
                        readOnly={syncEnabled}
                        placeholder="Weight in kg"
                        className={`min-w-0 flex-1 rounded-md border border-[#3b3f48] bg-[#313338] px-3 py-2 text-[12px] text-[#f2f3f5] outline-none ${
                          syncEnabled ? "cursor-not-allowed opacity-70" : ""
                        }`}
                      />
                      {!syncEnabled && latestCheckinWeight ? (
                        <button
                          type="button"
                          onClick={() => setBodyWeightKg(String(latestCheckinWeight.weight))}
                          className="rounded-md border border-[#3b3f48] bg-[#383a40]/65 px-2.5 py-2 text-[11px] font-semibold text-[#f2f3f5]"
                        >
                          Use latest
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-md border border-[#5865f2]/60 bg-[#383a40] px-2.5 py-2 text-[11px] font-semibold text-[#f2f3f5]"
                      >
                        Save
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-[#949ba4]">
                      {checkinWeightLoading
                        ? "Loading latest check-in…"
                        : latestCheckinWeight
                          ? `Latest check-in: ${latestCheckinWeight.weight} kg on ${formattedLatestCheckinDate}`
                          : "No check-in weight recorded yet"}
                    </p>

                    {saveMessage ? <p className="mt-1 text-[11px] text-[#7289da]">{saveMessage}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Quick access</p>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            {quickAccessItems.map((item) => {
              const isCurrent = item.path === DASHBOARD_ROUTES.profile;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => router.push(item.path)}
                  className={`flex min-h-[44px] items-center gap-2 rounded-md border px-3 py-2 text-left text-[12px] font-medium transition-colors ${
                    isCurrent
                      ? "border-[#5865f2]/60 bg-[#383a40] text-[#f2f3f5]"
                      : "border-[#3b3f48] bg-[#313338] text-[#dbdee1] active:border-[#5865f2]/60 active:bg-[#383a40]"
                  }`}
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[#3b3f48] bg-[#2b2d31] text-[13px]">
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="mb-2">
            <p className="text-[10px] uppercase tracking-[0.1em] text-[#949ba4]">Pages</p>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {pageItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="flex min-h-[46px] items-center gap-2.5 rounded-md border border-[#3b3f48] bg-[#313338] px-3 py-2.5 text-[#dbdee1] transition-colors active:border-[#5865f2]/60 active:bg-[#383a40]"
                onClick={() => router.push(item.path)}
              >
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#3b3f48] bg-[#2b2d31]">
                  <span className="text-base">{item.icon}</span>
                </span>
                <span className="truncate text-[13px] font-medium">{item.label}</span>
              </button>
            ))}
          </div>

          {adminItems.length > 0 && (
            <>
              <div className="mb-2 mt-3">
                <p className="text-[10px] uppercase tracking-[0.1em] text-[#f0b96a]">Admin</p>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {adminItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="flex min-h-[46px] items-center gap-2.5 rounded-md border border-[#4c4030] bg-[#313338] px-3 py-2.5 text-[#f0c991] transition-colors"
                    onClick={() => router.push(item.path)}
                  >
                    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#4c4030] bg-[#2b2d31]">
                      <span className="text-base">{item.icon}</span>
                    </span>
                    <span className="truncate text-[13px] font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          <button
            type="button"
            className="mt-3 flex min-h-[46px] w-full items-center gap-2.5 rounded-md border border-[#5a2b31] bg-[#3a2328] px-3 py-2.5 text-[#ffb3b8] transition-colors active:bg-[#49292f]"
            onClick={() => logout()}
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#6a343b] bg-[#49292f]">↩</span>
            <span className="text-[13px] font-medium">Logout</span>
          </button>
        </section>

      </div>
    </PageLayout>
  );
}
