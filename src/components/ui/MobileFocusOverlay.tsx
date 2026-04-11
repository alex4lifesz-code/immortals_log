"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface MobileFocusOverlayProps {
  isOpen: boolean;
  onDismiss: () => void;
  label: string;
  children: React.ReactNode;
}

/**
 * Full-screen overlay for mobile focus mode.
 * When open, locks body scroll and renders children in a fixed viewport portal
 * with a sticky header containing the label and a dismiss button.
 */
export default function MobileFocusOverlay({ isOpen, onDismiss, label, children }: MobileFocusOverlayProps) {
  // Lock body scroll when overlay is active
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Dismiss on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    },
    [onDismiss],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: "var(--surface, #0a0f14)" }}
    >
      {/* Sticky header with label + dismiss */}
      <div
        className="sticky top-0 z-10 safe-area-top flex items-center justify-between px-4 py-3 border-b shrink-0"
        style={{
          borderColor: "color-mix(in srgb, var(--jade-glow) 35%, var(--border))",
          backgroundColor: "var(--header-bg)",
        }}
      >
        <span
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: "var(--jade-glow)" }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border text-sm font-bold transition-colors"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-muted)",
            backgroundColor: "var(--surface)",
          }}
          aria-label="Exit focus mode"
        >
          ✕
        </button>
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-2 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)]">
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Small "focus" trigger button for mobile section headers */
export function MobileFocusTrigger({ onClick, label }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition-all active:scale-95"
      style={{
        borderColor: "color-mix(in srgb, var(--jade-glow) 40%, var(--border))",
        color: "var(--jade-glow)",
        backgroundColor: "color-mix(in srgb, var(--jade-glow) 8%, transparent)",
      }}
      aria-label={label || "Enter focus mode"}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 3H5a2 2 0 00-2 2v3" />
        <path d="M21 8V5a2 2 0 00-2-2h-3" />
        <path d="M3 16v3a2 2 0 002 2h3" />
        <path d="M16 21h3a2 2 0 002-2v-3" />
      </svg>
      <span>{label || "Focus"}</span>
    </button>
  );
}
