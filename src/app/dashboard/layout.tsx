"use client";

import { useEffect } from "react";
import { AppProvider } from "@/context/AppContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import DesktopNavBar from "@/components/navigation/DesktopNavBar";
import DesktopSidebar from "@/components/navigation/DesktopSidebar";
import MobileNavBar from "@/components/navigation/MobileNavBar";
import SwipeNavigation from "@/components/navigation/SwipeNavigation";
import ConnectivityBanner from "@/components/system/ConnectivityBanner";
import { useAppContext } from "@/context/AppContext";
import UserPhysiqueButton from "@/components/navigation/UserPhysiqueButton";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isMobile } = useAppContext();
  const { user } = useAuth();

  return (
    <>
      <div className="h-screen flex flex-col overflow-hidden">
        <DesktopNavBar />
        <ConnectivityBanner />
        <div className="flex-1 flex min-w-0 overflow-y-hidden overflow-x-auto">
          <DesktopSidebar />
          <SwipeNavigation>
            <div className="h-full min-w-0">{children}</div>
          </SwipeNavigation>
        </div>
        <MobileNavBar />
      </div>
    </>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-void-black">
        <p className="text-mist-mid text-sm animate-pulse">Restoring session…</p>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <AppProvider>
      <DisplaySettingsProvider>
        <DashboardContent>{children}</DashboardContent>
      </DisplaySettingsProvider>
    </AppProvider>
  );
}
