import { describe, expect, it } from "vitest";
import { extractLatestWeightPayload } from "../user-physique";

describe("extractLatestWeightPayload", () => {
  it("reads the wrapped apiSuccess payload shape", () => {
    expect(
      extractLatestWeightPayload({
        success: true,
        data: { weight: 72.5, date: "2026-04-14" },
      }),
    ).toEqual({ weight: 72.5, date: "2026-04-14" });
  });

  it("supports legacy flat payloads", () => {
    expect(extractLatestWeightPayload({ weight: 70, date: "2026-04-10" })).toEqual({
      weight: 70,
      date: "2026-04-10",
    });
  });

  it("returns nulls when no usable weight is present", () => {
    expect(extractLatestWeightPayload({ success: true, data: { weight: null, date: null } })).toEqual({
      weight: null,
      date: null,
    });
  });
});
