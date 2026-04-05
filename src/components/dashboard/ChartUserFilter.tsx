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
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] mr-1" style={{ color: "var(--text-muted)" }}>
        {t("Show:", "normal")}
      </span>
      <button
        onClick={() => onSelectionChange([currentUserId])}
        className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
          isOnlyMe ? "font-semibold" : "opacity-60 hover:opacity-80"
        }`}
        style={{
          borderColor: isOnlyMe ? "var(--jade-glow)" : "var(--border)",
          color: isOnlyMe ? "var(--jade-glow)" : "var(--text-secondary)",
          backgroundColor: isOnlyMe ? "rgba(0,255,128,0.08)" : "transparent",
        }}
      >
        {t("Just Me", "normal")}
      </button>
      {allUsers.length > 1 && (
        <button
          onClick={() => onSelectionChange(allUsers.map((u) => u.id))}
          className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
            isAll ? "font-semibold" : "opacity-60 hover:opacity-80"
          }`}
          style={{
            borderColor: isAll ? "var(--text-primary)" : "var(--border)",
            color: isAll ? "var(--text-primary)" : "var(--text-secondary)",
            backgroundColor: isAll ? "rgba(255,255,255,0.05)" : "transparent",
          }}
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
              onClick={() => toggleUser(u.id)}
              className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
                selected ? "font-semibold" : "opacity-50 hover:opacity-75"
              }`}
              style={{
                borderColor: selected ? color : "var(--border)",
                color: selected ? color : "var(--text-muted)",
              }}
            >
              {u.name}
            </button>
          );
        })}
    </div>
  );
}
