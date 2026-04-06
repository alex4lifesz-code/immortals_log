// src/components/hints/hints.config.ts — Hint definitions
// Import from cultivation copy to get localized strings

import type { CultivationCopy } from "@/lib/copy";

export type HintId =
  | "checkin-form"
  | "train-tab"
  | "exercise-db"
  | "progression"
  | "rank-up"
  | "friend-request";

export function getHintConfig(copy: CultivationCopy) {
  return {
    "checkin-form": copy.hints.checkinForm,
    "train-tab": copy.hints.trainTab,
    "exercise-db": copy.hints.exerciseDb,
    "progression": copy.hints.progression,
    "rank-up": copy.hints.rankUp,
    "friend-request": copy.hints.friendRequest,
  } as const;
}
