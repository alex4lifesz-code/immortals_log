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
    const onBackIntent = () => {
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

      if (!config.isRootPath(pathname) && canGoBack) {
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
    };

    const onBackButton = (event: Event) => {
      if (typeof (event as { preventDefault?: () => void }).preventDefault === "function") {
        (event as { preventDefault: () => void }).preventDefault();
      }
      onBackIntent();
    };

    document.addEventListener("backbutton", onBackButton as EventListener);

    return () => {
      document.removeEventListener("backbutton", onBackButton as EventListener);
    };
  }, [canGoBack, config, exitFlow, goBack, haptics, pathname]);

  return {
    awaitingSecondPress: exitFlow.awaitingSecondPress,
    resetExitPrompt: exitFlow.reset,
  };
}
