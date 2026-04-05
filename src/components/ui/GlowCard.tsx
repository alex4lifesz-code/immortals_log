"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "@/hooks/useFocusTrap";

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glow?: "jade" | "crimson" | "gold" | "blue" | "none";
  hoverable?: boolean;
  onClick?: () => void;
}

const glowHover = {
  jade: "hover:shadow-[0_0_20px_rgba(58,143,143,0.3)] hover:border-jade/40",
  crimson: "hover:shadow-[0_0_20px_rgba(196,48,48,0.3)] hover:border-crimson/40",
  gold: "hover:shadow-[0_0_20px_rgba(232,200,74,0.3)] hover:border-gold-dim/40",
  blue: "hover:shadow-[0_0_20px_rgba(74,143,184,0.3)] hover:border-mountain-blue/40",
  none: "hover:border-ink-light",
};

export default function GlowCard({
  children,
  className = "",
  glow = "jade",
  hoverable = true,
  onClick,
}: GlowCardProps) {
  const glowBase = {
    jade: "rgba(58,143,143,0.22)",
    crimson: "rgba(196,48,48,0.22)",
    gold: "rgba(232,200,74,0.2)",
    blue: "rgba(74,143,184,0.22)",
    none: "transparent",
  };

  return (
    <div
      onClick={onClick}
      className={`
        surface-panel interactive-panel p-4
        transition-[transform,box-shadow,border-color] duration-150 ease-out
        ${hoverable ? "hover:-translate-y-0.5 hover:scale-[1.005] active:scale-[0.985]" : ""}
        ${hoverable ? glowHover[glow] : ""}
        ${onClick ? "cursor-pointer" : ""}
        ${className}
      `}
      style={{
        boxShadow: `var(--shadow-elev-1), 0 0 0 1px ${glowBase[glow]} inset`,
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
            className="fixed inset-0 bg-void-black/80 z-[110]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 pointer-events-none"
          >
            <div
              ref={trapRef}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              onClick={(e) => e.stopPropagation()}
              className={`bg-ink-deep w-full max-w-lg max-h-[80vh] overflow-y-auto pointer-events-auto glow-modal-container ${panelClassName}`}
              style={{
                borderRadius: '2px',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.4)'
              }}
            >
              {!hideHeader && (
                <div className="flex items-center justify-between p-4 border-b border-ink-light">
                  <h2 className="text-sm text-jade-glow uppercase tracking-wider" title={titleHint ?? undefined}>
                    {title}
                  </h2>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    aria-label="Close dialog"
                    className="text-mist-dark hover:text-crimson-light transition-colors text-lg"
                  >
                    ✕
                  </motion.button>
                </div>
              )}
              <div className={`${hideHeader ? "p-5" : "p-4"} ${contentClassName}`}>{children}</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
