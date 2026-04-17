"use client";

import { useEffect, useState } from "react";

const CHECK_INTERVAL_MS = 30000;
const CHECK_TIMEOUT_MS = 7000;

export default function ConnectivityBanner() {
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkConnection = async () => {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

      try {
        const res = await fetch("/api/health", {
          method: "GET",
          cache: "no-store",
          signal: controller.signal,
          credentials: "include",
        });

        if (!mounted) return;
        setShowWarning(!res.ok);
      } catch {
        if (!mounted) return;
        setShowWarning(true);
      } finally {
        window.clearTimeout(timeout);
      }
    };

    void checkConnection();
    const interval = window.setInterval(() => {
      void checkConnection();
    }, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  if (!showWarning) return null;

  return (
    <div className="px-4 py-2 bg-amber-500/15 border-b border-amber-400/30 text-amber-100 text-xs sm:text-sm">
      Unable to connect to the app database right now. Verify the server is reachable and your network connection is stable.
    </div>
  );
}
