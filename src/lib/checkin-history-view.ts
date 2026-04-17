export type CheckInHistoryViewMode = "detailed" | "compact";

export function getDetailLabelVisibility(
  viewMode: CheckInHistoryViewMode,
  label: "Name:" | "Weight:" | "Status:" | "Notes:"
): boolean {
  if (viewMode !== "compact") return true;
  return label === "Name:";
}

export function getCheckInHistoryPreviewLimit(
  isMobile: boolean,
  viewMode: CheckInHistoryViewMode
): number {
  if (viewMode === "compact") {
    return isMobile ? 6 : 8;
  }

  return isMobile ? 4 : 5;
}
