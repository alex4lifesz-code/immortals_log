"use client";

import { useCallback, useRef, useState } from "react";

export function useExitApp(timeoutMs = 2500) {
  const [awaitingSecondPress, setAwaitingSecondPress] = useState(false);
  const timerRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setAwaitingSecondPress(false);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const requestExitConfirmation = useCallback(() => {
    if (awaitingSecondPress) {
      reset();
      return true;
    }

    setAwaitingSecondPress(true);
    timerRef.current = window.setTimeout(() => {
      setAwaitingSecondPress(false);
      timerRef.current = null;
    }, timeoutMs);

    return false;
  }, [awaitingSecondPress, reset, timeoutMs]);

  return {
    awaitingSecondPress,
    requestExitConfirmation,
    reset,
  };
}
