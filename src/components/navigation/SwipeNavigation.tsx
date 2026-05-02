"use client";

import { memo } from "react";

function SwipeNavigation({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex-1 min-w-0 overflow-auto"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {children}
    </div>
  );
}

export default memo(SwipeNavigation);
