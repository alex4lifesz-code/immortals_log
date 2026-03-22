"use client";

import { useState, useEffect } from "react";
import { AppProvider } from "@/context/AppContext";
import { DisplaySettingsProvider } from "@/context/DisplaySettingsContext";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import TopBar from "@/components/navigation/TopBar";
import LeftSidebar from "@/components/navigation/LeftSidebar";
import RightPanel from "@/components/navigation/RightPanel";
import BottomBar from "@/components/navigation/BottomBar";
import FloatingMobileSidebar from "@/components/navigation/FloatingMobileSidebar";
import SetupWizard, { SETUP_WIZARD_COMPLETED_KEY } from "@/components/ui/SetupWizard";
import { useAppContext } from "@/context/AppContext";

function DashboardContent({ children }: { children: React.ReactNode }) {
  const { viewportMode, isNativeApp } = useAppContext();
  const [showWizard, setShowWizard] = useState(() => {
    if (typeof window === "undefined") return false;
    return !localStorage.getItem(SETUP_WIZARD_COMPLETED_KEY);
  });
  const [mobilePreviewScale, setMobilePreviewScale] = useState(1);
  const [previewBaseWidth, setPreviewBaseWidth] = useState<number | null>(null);

  const isDesktopMobilePreview = viewportMode === "mobile" && !isNativeApp;

  useEffect(() => {
    if (!isDesktopMobilePreview) {
      setMobilePreviewScale(1);
      setPreviewBaseWidth(null);
      return;
    }

    if (previewBaseWidth === null) {
      setPreviewBaseWidth(window.innerWidth);
      return;
    }

    const updateMobilePreviewScale = () => {
      const widthRatio = window.innerWidth / previewBaseWidth;
      const nextScale = Math.max(0.65, Math.min(1.65, widthRatio));

      setMobilePreviewScale(Number(nextScale.toFixed(3)));
    };

    updateMobilePreviewScale();
    window.addEventListener("resize", updateMobilePreviewScale);
    return () => window.removeEventListener("resize", updateMobilePreviewScale);
  }, [isDesktopMobilePreview, previewBaseWidth]);

  return (
    <>
      {showWizard && <SetupWizard onComplete={() => setShowWizard(false)} />}
      <div
        className="h-screen flex flex-col overflow-hidden"
        style={
          isDesktopMobilePreview
            ? {
                zoom: mobilePreviewScale,
              }
            : undefined
        }
      >
        <TopBar />
        <div className="flex-1 flex overflow-hidden">
          <LeftSidebar />
          <div className="flex-1 overflow-auto">{children}</div>
          <RightPanel />
        </div>
        <FloatingMobileSidebar />
        <BottomBar />
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
