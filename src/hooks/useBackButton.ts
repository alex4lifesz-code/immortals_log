"use client";

import { useEffect } from "react";
import { useNavigationStack } from "@/hooks/useNavigationStack";
import { useExitApp } from "@/hooks/useExitApp";
import { useHapticFeedback } from "@/hooks/useHapticFeedback";

type BackHandlerConfig = {
  isRootPath: (path: string) => boolean;
  closeModalIfAny: () => boolean;
  hasUnsavedChanges: () => boolean;
  onUnsavedChangesBack: () => void;
  onExitPrompt: () => void;
  onExitConfirmed: () => void;
};

export function useBackButton(config: BackHandlerConfig) {
  const { canGoBack, goBack, pathname } = useNavigationStack();
  const exitFlow = useExitApp();
  const haptics = useHapticFeedback();

  useEffect(() => {
    let removeAppListener: (() => void) | null = null;

    const setup = async () => {
      try {
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", async ({ canGoBack: nativeCanGoBack }) => {
          if (config.closeModalIfAny()) {
            haptics.light();
            return;
          }

          const keyboardOpen = document.activeElement instanceof HTMLElement &&
            (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA");
          if (keyboardOpen) {
            (document.activeElement as HTMLElement).blur();
            haptics.light();
            return;
          }

          if (config.hasUnsavedChanges()) {
            haptics.medium();
            config.onUnsavedChangesBack();
            return;
          }

          if (!config.isRootPath(pathname) && (canGoBack || nativeCanGoBack)) {
            haptics.light();
            goBack();
            return;
          }

          const shouldExit = exitFlow.requestExitConfirmation();
          if (!shouldExit) {
            haptics.medium();
            config.onExitPrompt();
            return;
          }

          haptics.heavy();
          config.onExitConfirmed();
          await App.exitApp();
        });

        removeAppListener = () => {
          void listener.remove();
        };
      } catch {
        // Not running with Capacitor App plugin.
      }
    };

    void setup();

    return () => {
      if (removeAppListener) removeAppListener();
    };
  }, [canGoBack, config, exitFlow, goBack, haptics, pathname]);

  return {
    awaitingSecondPress: exitFlow.awaitingSecondPress,
    resetExitPrompt: exitFlow.reset,
  };
}
