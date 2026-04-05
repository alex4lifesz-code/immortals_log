"use client";

import { useState } from "react";
import MobileHeader from "@/components/mobile/navigation/MobileHeader";
import MobileCard from "@/components/mobile/layout/MobileCard";
import MobileInput from "@/components/mobile/inputs/MobileInput";
import MobileButton from "@/components/mobile/inputs/MobileButton";
import MobileSlider from "@/components/mobile/inputs/MobileSlider";
import MobileToast from "@/components/mobile/feedback/MobileToast";
import { useAuth } from "@/context/AuthContext";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

function todayISO() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function MobileCheckinPage() {
  const { user } = useAuth();
  const { markDirty, clearDirty } = useUnsavedChanges();
  const haptics = useHapticFeedback();
  const [weight, setWeight] = useState(70);
  const [comment, setComment] = useState("");
  const [toastOpen, setToastOpen] = useState(false);

  const submit = async () => {
    if (!user?.id) return;

    await fetch("/api/checkins", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        date: todayISO(),
        entries: {
          [user.id]: {
            present: true,
            weight: String(weight),
            comment,
          },
        },
      }),
    });

    clearDirty();
    setToastOpen(true);
    haptics.medium();
    window.setTimeout(() => setToastOpen(false), 1600);
  };

  return (
    <div>
      <MobileHeader title="Daily Check-In" />
      <section className="mobile-content-stack space-y-4 p-4">
        <MobileCard>
          <h2 className="text-base font-semibold text-cloud-white">Log today</h2>
          <p className="mt-1 text-sm text-mist-light">Shared check-in API and user identity from existing auth context.</p>

          <div className="mt-4 space-y-3">
            <MobileSlider
              label={`Body weight: ${weight} kg`}
              min={35}
              max={180}
              step={1}
              value={weight}
              onChange={(event) => {
                setWeight(Number(event.currentTarget.value));
                markDirty();
              }}
            />

            <MobileInput
              label="Comment"
              value={comment}
              onChange={(event) => {
                setComment(event.currentTarget.value);
                markDirty();
              }}
              placeholder="How did cultivation feel today?"
            />

            <MobileButton onClick={submit}>Save Check-In</MobileButton>
          </div>
        </MobileCard>
      </section>
      <MobileToast open={toastOpen} message="Check-in saved" tone="success" />
    </div>
  );
}
