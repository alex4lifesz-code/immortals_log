"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type MobileButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface MobileButtonProps extends HTMLMotionProps<"button"> {
  children: ReactNode;
  variant?: MobileButtonVariant;
}

export default function MobileButton({ children, className = "", variant = "primary", ...props }: MobileButtonProps) {
  const variantClass =
    variant === "secondary"
      ? "bg-ink-mid text-cloud-white border-border"
      : variant === "ghost"
      ? "bg-transparent text-cloud-white border-border"
      : variant === "danger"
      ? "bg-crimson text-cloud-white border-crimson-glow"
      : "bg-jade text-cloud-white border-jade-glow";

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      className={`min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${variantClass} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  );
}
