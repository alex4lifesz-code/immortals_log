import { describe, expect, it } from "vitest";
import { buildAutoCheckInDates, mergeCheckinsWithWorkoutDates } from "@/lib/checkins-autoPresence";

describe("check-in auto presence", () => {
  it("preserves an existing checked-in row and its saved weight", () => {
    const merged = mergeCheckinsWithWorkoutDates({
      checkins: [
        {
          date: new Date("2026-04-15T00:00:00.000Z"),
          userId: "u1",
          present: true,
          weight: 71,
          comment: "",
        },
      ],
      workoutDatesByUser: new Map([["u1", new Set(["2026-04-15"])]]),
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.present).toBe(true);
    expect(merged[0]?.weight).toBe(71);
  });

  it("creates a derived present row when no manual check-in exists", () => {
    const merged = mergeCheckinsWithWorkoutDates({
      checkins: [],
      workoutDatesByUser: new Map([["u2", new Set(["2026-04-16"])]]),
    });

    expect(merged).toEqual([
      expect.objectContaining({
        userId: "u2",
        present: true,
        weight: null,
        comment: null,
      }),
    ]);
  });

  it("preserves an explicit manual unchecked state for an existing check-in row", () => {
    const merged = mergeCheckinsWithWorkoutDates({
      checkins: [
        {
          date: new Date("2026-04-17T00:00:00.000Z"),
          userId: "u3",
          present: false,
          weight: null,
          comment: "rest day",
        },
      ],
      workoutDatesByUser: new Map([["u3", new Set(["2026-04-17"])]]),
    });

    expect(merged).toHaveLength(1);
    expect(merged[0]?.present).toBe(false);
    expect(merged[0]?.comment).toBe("rest day");
  });

  it("extracts unique workout dates from training timestamps", () => {
    const dates = buildAutoCheckInDates([
      { userId: "u1", createdAt: new Date("2026-04-15T09:00:00.000Z") },
      { userId: "u1", createdAt: new Date("2026-04-15T18:30:00.000Z") },
      { userId: "u1", createdAt: new Date("2026-04-16T06:10:00.000Z") },
    ]);

    expect([...dates.get("u1") ?? []]).toEqual(["2026-04-15", "2026-04-16"]);
  });
});
