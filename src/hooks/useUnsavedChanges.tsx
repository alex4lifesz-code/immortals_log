"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface UnsavedChangesContextValue {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);

  const value = useMemo(() => ({ dirty, setDirty }), [dirty]);

  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

export function useUnsavedChanges() {
  const ctx = useContext(UnsavedChangesContext);
  if (!ctx) {
    throw new Error("useUnsavedChanges must be used within UnsavedChangesProvider");
  }

  return {
    dirty: ctx.dirty,
    markDirty: useCallback(() => ctx.setDirty(true), [ctx]),
    clearDirty: useCallback(() => ctx.setDirty(false), [ctx]),
    setDirty: ctx.setDirty,
  };
}
