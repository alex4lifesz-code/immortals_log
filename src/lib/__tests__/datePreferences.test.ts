import { describe, expect, it } from "vitest";
import {
  buildDateFromDateKey,
  buildIsoAtUserDateTime,
  createCalendarMonthAnchor,
  formatDateLocal,
  getTimeZoneDateParts,
  normalizeDateOnlyKey,
  resolveCalendarWeekStartsOn,
} from "../constants";

describe("timezone-aware date preferences", () => {
  it("uses the selected timezone when deriving a calendar date", () => {
    const source = new Date("2026-04-14T18:30:00.000Z");

    expect(formatDateLocal(source, "Asia/Ho_Chi_Minh")).toBe("2026-04-15");
    expect(formatDateLocal(source, "Pacific/Auckland")).toBe("2026-04-15");
    expect(formatDateLocal(source, "America/Los_Angeles")).toBe("2026-04-14");
  });

  it("returns the correct timezone date parts for month/day calculations", () => {
    const parts = getTimeZoneDateParts(new Date("2026-12-31T13:30:00.000Z"), "Pacific/Auckland");

    expect(parts.year).toBe(2027);
    expect(parts.month).toBe(1);
    expect(parts.day).toBe(1);
  });

  it("defaults calendar week start based on region when auto is selected", () => {
    expect(resolveCalendarWeekStartsOn("auto", "Australia/Sydney")).toBe(1);
    expect(resolveCalendarWeekStartsOn("auto", "Pacific/Auckland")).toBe(1);
    expect(resolveCalendarWeekStartsOn("auto", "Asia/Ho_Chi_Minh")).toBe(1);
    expect(resolveCalendarWeekStartsOn("auto", "America/New_York")).toBe(0);
  });

  it("creates a stored ISO timestamp that stays on the chosen user date", () => {
    const createdAt = buildIsoAtUserDateTime("2026-04-15", "Asia/Ho_Chi_Minh", {
      hour: 9,
      minute: 30,
      second: 0,
      millisecond: 0,
    });

    expect(createdAt).toBeTruthy();
    expect(formatDateLocal(new Date(createdAt as string), "Asia/Ho_Chi_Minh")).toBe("2026-04-15");
  });

  it("anchors calendar month state without slipping into the previous month across timezones", () => {
    const anchor = createCalendarMonthAnchor(2026, 4);

    expect(getTimeZoneDateParts(anchor, "America/Los_Angeles").month).toBe(4);
    expect(getTimeZoneDateParts(anchor, "Pacific/Auckland").month).toBe(4);
  });

  it("normalizes date-only keys consistently for backup imports", () => {
    expect(normalizeDateOnlyKey("2026-04-20")).toBe("2026-04-20");
    expect(normalizeDateOnlyKey("2026-04-20T18:45:00.000Z")).toBe("2026-04-20");
    expect(normalizeDateOnlyKey(new Date("2026-04-20T03:15:00.000Z"))).toBe("2026-04-20");
  });

  it("builds a stable stored check-in date from a date key", () => {
    const stored = buildDateFromDateKey("2026-04-20");

    expect(stored).toBeTruthy();
    expect(stored?.toISOString()).toBe("2026-04-20T00:00:00.000Z");
  });
});
