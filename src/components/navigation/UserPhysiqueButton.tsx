"use client";

import { useRouter } from "next/navigation";
import { DASHBOARD_ROUTES } from "@/lib/navigation";
import { tHint } from "@/lib/terminology";

interface UserPhysiqueButtonProps {
  userId: string;
  userName: string;
  className?: string;
}

export default function UserPhysiqueButton({ userId, userName, className }: UserPhysiqueButtonProps) {
  const router = useRouter();
  void userId;

  return (
    <button
      type="button"
      onClick={() => router.push(DASHBOARD_ROUTES.profile)}
      className={className || "text-xs text-cloud-white font-medium truncate hover:text-jade-glow transition-colors"}
      title={tHint("Open user settings page", "normal") ?? undefined}
    >
      {userName}
    </button>
  );
}
