"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type MobileButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface MobileButtonProps {
  children: ReactNode;
  variant?: MobileButtonVariant;
  className?: string;
  disabled?: boolean;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  form?: string;
  type?: "button" | "submit" | "reset";
}

export default function MobileButton({ 
  children, 
  className = "", 
  variant = "primary", 
  ...props 
}: MobileButtonProps) {
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
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.95 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`mobile-card-polish min-h-12 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${variantClass} ${className}`}
      {...(props as any)}
    >
      {children}
    </motion.button>
  );
}
