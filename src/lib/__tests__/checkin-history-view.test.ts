import { describe, expect, it } from "vitest";
import { getCheckInHistoryPreviewLimit, getDetailLabelVisibility } from "@/lib/checkin-history-view";

describe("check-in history view helpers", () => {
  it("keeps all labels in detailed mode", () => {
    expect(getDetailLabelVisibility("detailed", "Name:")).toBe(true);
    expect(getDetailLabelVisibility("detailed", "Weight:")).toBe(true);
    expect(getDetailLabelVisibility("detailed", "Status:")).toBe(true);
    expect(getDetailLabelVisibility("detailed", "Notes:")).toBe(true);
  });

  it("only keeps the name label in compact mode", () => {
    expect(getDetailLabelVisibility("compact", "Name:")).toBe(true);
    expect(getDetailLabelVisibility("compact", "Weight:")).toBe(false);
    expect(getDetailLabelVisibility("compact", "Status:")).toBe(false);
    expect(getDetailLabelVisibility("compact", "Notes:")).toBe(false);
  });

  it("shows more people in compact mode", () => {
    expect(getCheckInHistoryPreviewLimit(false, "detailed")).toBe(5);
    expect(getCheckInHistoryPreviewLimit(true, "detailed")).toBe(4);
    expect(getCheckInHistoryPreviewLimit(false, "compact")).toBe(8);
    expect(getCheckInHistoryPreviewLimit(true, "compact")).toBe(6);
  });
});
