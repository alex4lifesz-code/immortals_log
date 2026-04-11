"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="safe-area-shell min-h-app flex items-center justify-center bg-void-black">
        <p className="text-mist-mid text-sm animate-pulse">Preparing your path…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="safe-area-shell min-h-app bg-void-black">
      {children}
    </div>
  );
}
