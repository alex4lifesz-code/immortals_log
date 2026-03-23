"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useBackButton } from "@/hooks/useBackButton";
import { useNavigationStack } from "@/hooks/useNavigationStack";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import ExitConfirmationToast from "@/components/mobile/feedback/ExitConfirmationToast";
import UnsavedChangesModal from "@/components/mobile/layout/UnsavedChangesModal";

interface BackButtonContextValue {
  setModalCloser: (closer: (() => boolean) | null) => void;
}

const BackButtonContext = createContext<BackButtonContextValue | null>(null);

export function BackButtonProvider({ children }: { children: ReactNode }) {
  const [exitToastOpen, setExitToastOpen] = useState(false);
  const [unsavedPromptOpen, setUnsavedPromptOpen] = useState(false);
  const [modalCloser, setModalCloser] = useState<(() => boolean) | null>(null);
  const { dirty, clearDirty } = useUnsavedChanges();
  const { goBack } = useNavigationStack();

  useBackButton({
    isRootPath: (path) => path === "/dashboard/mobile",
    closeModalIfAny: () => (modalCloser ? modalCloser() : false),
    hasUnsavedChanges: () => dirty,
    onUnsavedChangesBack: () => setUnsavedPromptOpen(true),
    onExitPrompt: () => {
      setExitToastOpen(true);
      window.setTimeout(() => setExitToastOpen(false), 2300);
    },
    onExitConfirmed: () => setExitToastOpen(false),
  });

  const value = useMemo(
    () => ({
      setModalCloser,
    }),
    [],
  );

  return (
    <BackButtonContext.Provider value={value}>
      {children}
      <ExitConfirmationToast open={exitToastOpen} />
      <UnsavedChangesModal
        open={unsavedPromptOpen}
        onStay={() => setUnsavedPromptOpen(false)}
        onLeave={() => {
          clearDirty();
          setUnsavedPromptOpen(false);
          goBack();
        }}
      />
    </BackButtonContext.Provider>
  );
}

export function useBackButtonContext() {
  const ctx = useContext(BackButtonContext);
  if (!ctx) throw new Error("useBackButtonContext must be used within BackButtonProvider");
  return ctx;
}
