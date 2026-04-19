"use client";

import { t } from "@/lib/terminology";

interface User {
  id: string;
  name: string;
  username: string;
}

interface Props {
  currentUserId: string;
  allUsers: User[];
  selectedUserIds: string[];
  onSelectionChange: (ids: string[]) => void;
  userColors: Record<string, string>;
}

export default function ChartUserFilter({
  currentUserId,
  allUsers,
  selectedUserIds,
  onSelectionChange,
  userColors,
}: Props) {
  const controlButtonBase = "theme-control-btn rounded-md border px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors";
  const activeControlButton = `${controlButtonBase} theme-control-btn-active`;
  const inactiveControlButton = controlButtonBase;

  const toggleUser = (id: string) => {
    if (selectedUserIds.includes(id)) {
      if (selectedUserIds.length === 1) return;
      onSelectionChange(selectedUserIds.filter((uid) => uid !== id));
    } else {
      onSelectionChange([...selectedUserIds, id]);
    }
  };

  const isOnlyMe = selectedUserIds.length === 1 && selectedUserIds[0] === currentUserId;
  const isAll = selectedUserIds.length === allUsers.length;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-[11px] mr-1" style={{ color: "var(--text-muted)" }}>
        {t("Show:", "normal")}
      </span>
      <button
        type="button"
        onClick={() => onSelectionChange([currentUserId])}
        className={isOnlyMe ? activeControlButton : inactiveControlButton}
      >
        {t("Just Me", "normal")}
      </button>
      {allUsers.length > 1 && (
        <button
          type="button"
          onClick={() => onSelectionChange(allUsers.map((u) => u.id))}
          className={isAll ? activeControlButton : inactiveControlButton}
        >
          {t("All", "normal")}
        </button>
      )}
      {allUsers
        .filter((u) => u.id !== currentUserId)
        .map((u) => {
          const selected = selectedUserIds.includes(u.id);
          const color = userColors[u.id] || "var(--text-secondary)";
          return (
            <button
              key={u.id}
              type="button"
              onClick={() => toggleUser(u.id)}
              className={selected ? activeControlButton : inactiveControlButton}
            >
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                <span>{u.name}</span>
              </span>
            </button>
          );
        })}
    </div>
  );
}
