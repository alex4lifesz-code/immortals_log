import { describe, expect, it } from "vitest";
import { rankExerciseSearchResults } from "../exercise-search";

describe("rankExerciseSearchResults", () => {
  it("prioritizes previously logged parent exercises, then exact match, then broader relevant matches", () => {
    const ranked = rankExerciseSearchResults(
      [
        {
          exerciseId: "gym-squat",
          displayLabel: "Gym Squat",
          canonicalName: "Gym Squat",
          searchLabel: "Gym Squat",
          hasHistory: true,
          lastLoggedAt: "2026-04-10T00:00:00.000Z",
          matchSource: "name",
        },
        {
          exerciseId: "squat",
          displayLabel: "Squat",
          canonicalName: "Squat",
          searchLabel: "Squat",
          hasHistory: false,
          matchSource: "name",
        },
        {
          exerciseId: "box-squat",
          displayLabel: "Box Squat",
          canonicalName: "Box Squat",
          searchLabel: "Box Squat",
          hasHistory: false,
          matchSource: "name",
        },
      ],
      "squat",
    );

    expect(ranked.map((item) => item.exerciseId)).toEqual([
      "gym-squat",
      "squat",
      "box-squat",
    ]);
  });

  it("keeps exact match ahead of contextual progression or variant matches when history is equal", () => {
    const ranked = rankExerciseSearchResults(
      [
        {
          exerciseId: "squat",
          displayLabel: "Squat",
          canonicalName: "Squat",
          searchLabel: "Squat",
          hasHistory: false,
          matchSource: "name",
        },
        {
          exerciseId: "gym-squat",
          displayLabel: "(Barbell) Gym Squat",
          canonicalName: "Gym Squat",
          searchLabel: "(Barbell) Gym Squat",
          hasHistory: false,
          matchSource: "progression",
        },
      ],
      "squat",
    );

    expect(ranked.map((item) => item.displayLabel)).toEqual([
      "Squat",
      "(Barbell) Gym Squat",
    ]);
  });
});
