"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const ONBOARD_KEY = "wuxia-onboarding-complete";

export default function SplashPage() {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const timer = setTimeout(() => {
      if (isAuthenticated) {
        router.replace("/home");
        return;
      }

      const seenOnboarding = localStorage.getItem(ONBOARD_KEY) === "true";
      router.replace(seenOnboarding ? "/login" : "/welcome");
    }, 1200);

    return () => clearTimeout(timer);
  }, [isLoading, isAuthenticated, router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-void-black px-6 text-cloud-white">
      <div className="text-center">
        <p className="text-xs uppercase tracking-[0.35em] text-gold">Wuxia Workout</p>
        <h1 className="mt-3 text-4xl font-semibold text-pure-white">修炼日志</h1>
        <div className="mx-auto mt-5 h-1.5 w-40 overflow-hidden rounded-full bg-ink-light">
          <div className="h-full w-1/2 animate-pulse bg-gold" />
        </div>
      </div>
    </main>
  );
}
