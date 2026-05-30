"use client";

import { AnimatePresence, motion } from "framer-motion";
import { KeyboardEvent as ReactKeyboardEvent, ReactNode, useEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glow?: "jade" | "crimson" | "gold" | "blue" | "none";
  hoverable?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
}

const glowHover = {
  jade: "hover:shadow-[var(--shadow-elev-2)] hover:border-jade/40",
  crimson: "hover:shadow-[var(--shadow-elev-2)] hover:border-crimson/40",
  gold: "hover:shadow-[var(--shadow-elev-2)] hover:border-gold-dim/40",
  blue: "hover:shadow-[var(--shadow-elev-2)] hover:border-mountain-blue/40",
  none: "hover:border-ink-light",
};

export default function GlowCard({
  children,
  className = "",
  glow = "jade",
  hoverable = true,
  onClick,
  style,
}: GlowCardProps) {
  const isInteractive = Boolean(onClick);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  const glowBase = {
    jade: "color-mix(in srgb, var(--jade) 22%, transparent)",
    crimson: "color-mix(in srgb, var(--danger) 22%, transparent)",
    gold: "color-mix(in srgb, var(--gold) 20%, transparent)",
    blue: "color-mix(in srgb, var(--accent) 22%, transparent)",
    none: "transparent",
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      className={`
        polished-focus surface-panel interactive-panel p-4
        transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out
        ${hoverable ? "hover:-translate-y-0.5 hover:scale-[1.005] active:scale-[0.99]" : ""}
        ${hoverable ? glowHover[glow] : ""}
        ${isInteractive ? "cursor-pointer touch-manipulation" : ""}
        ${className}
      `}
      style={{
        boxShadow: `var(--shadow-elev-1), 0 0 0 1px ${glowBase[glow]} inset`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface GlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleHint?: string | null;
  children: ReactNode;
  hideHeader?: boolean;
  panelClassName?: string;
  contentClassName?: string;
  glowColor?: string;
}

export function GlowModal({
  isOpen,
  onClose,
  title,
  titleHint = null,
  children,
  hideHeader = false,
  panelClassName = "",
  contentClassName = "",
  glowColor
}: GlowModalProps) {
  const trapRef = useFocusTrap(isOpen);
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-void-black/80 z-[250]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-[260] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
              className={`surface-panel surface-panel-strong w-full max-w-lg max-h-[84vh] overflow-hidden pointer-events-auto glow-modal-container rounded-lg border ${panelClassName}`}
              style={{
                borderColor: "color-mix(in srgb, var(--border) 94%, transparent)",
                background: "linear-gradient(165deg, color-mix(in srgb, var(--surface) 96%, transparent) 0%, color-mix(in srgb, var(--surface-hover) 80%, transparent) 100%)",
                boxShadow: glowColor
                  ? `0 18px 48px rgba(0,0,0,0.55), 0 0 0 1px ${glowColor} inset`
                  : "var(--shadow-elev-2), 0 0 0 1px color-mix(in srgb, var(--accent) 10%, transparent) inset",
              }}
            >
              {!hideHeader && (
                <div
                  className="flex items-center justify-between gap-3 border-b px-3 py-2.5"
                  style={{
                    borderBottomColor: "color-mix(in srgb, var(--ink-light) 72%, transparent)",
                    backgroundColor: "color-mix(in srgb, var(--ink-deep) 96%, var(--ink-mid))",
                  }}
                >
                  <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-mist-light" title={titleHint ?? undefined}>
                    {title}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.94 }}
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="theme-control-btn flex h-8 w-8 items-center justify-center rounded-md border transition-colors"
                  >
                    ✕
                  </motion.button>
                </div>
              )}
              <div className={`${hideHeader ? "p-0" : "p-4"} ${contentClassName}`}>{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
