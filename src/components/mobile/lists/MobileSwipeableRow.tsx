"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import type { ReactNode } from "react";

interface MobileSwipeableRowProps {
  children: ReactNode;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
}

export default function MobileSwipeableRow({ children, onSwipeLeft, onSwipeRight }: MobileSwipeableRowProps) {
  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-120, 0, 120], [0.25, 0, 0.25]);

  return (
    <motion.div
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      style={{ x }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 96) onSwipeRight?.();
        if (info.offset.x < -96) onSwipeLeft?.();
      }}
      className="relative"
    >
      <motion.div style={{ opacity: bgOpacity }} className="absolute inset-0 rounded-xl bg-jade/20" />
      <div className="relative">{children}</div>
    </motion.div>
  );
}
