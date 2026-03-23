"use client";

import { useNavigationStack } from "@/hooks/useNavigationStack";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

export default function MobileBackButton() {
  const { canGoBack, goBack } = useNavigationStack();
  const haptics = useHapticFeedback();

  if (!canGoBack) return <span className="inline-block h-11 w-11" aria-hidden="true" />;

  return (
    <button
      onClick={() => {
        haptics.light();
        goBack();
      }}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-ink-deep text-cloud-white"
      aria-label="Go back"
    >
      ←
    </button>
  );
}
