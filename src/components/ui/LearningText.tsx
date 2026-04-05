"use client";

import { useEffect, useRef, useState } from "react";
import type { LanguageMode } from "@/lib/language";
import { getLearningHintFromEnglish, translateEnglishToLanguage } from "@/lib/language";

interface LearningTextProps {
  text: string;
  languageMode: LanguageMode;
  className?: string;
  enabled?: boolean;
}

export default function LearningText({ text, languageMode, className, enabled = true }: LearningTextProps) {
  const [showHint, setShowHint] = useState(false);
  const longPressTimerRef = useRef<number | null>(null);

  const translated = enabled ? translateEnglishToLanguage(text, languageMode) : text;
  const hintText = enabled ? getLearningHintFromEnglish(text, languageMode) : null;

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current != null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const startLongPress = () => {
    if (!hintText) return;
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setShowHint(true);
    }, 380);
  };

  const endLongPress = () => {
    if (longPressTimerRef.current != null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setShowHint(false);
  };

  return (
    <span
      className={`relative inline-block ${className ?? ""}`.trim()}
      title={hintText ?? undefined}
      onMouseEnter={() => hintText && setShowHint(true)}
      onMouseLeave={() => setShowHint(false)}
      onTouchStart={startLongPress}
      onTouchEnd={endLongPress}
      onTouchCancel={endLongPress}
    >
      {translated}
      {showHint && hintText ? (
        <span
          className="pointer-events-none absolute left-1/2 top-full z-[120] mt-1 -translate-x-1/2 whitespace-nowrap rounded border px-2 py-1 text-[10px] font-medium"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text-primary)",
            boxShadow: "var(--shadow-elev-2)",
          }}
        >
          {hintText}
        </span>
      ) : null}
    </span>
  );
}
