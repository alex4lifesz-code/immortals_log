"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAppContext } from "@/context/AppContext";

/**
 * Subtle animated mist orbs + floating particles that give the dashboard
 * the same ethereal, zen atmosphere as the login screen.
 * Respects reduced-motion and the eternal/discord theme disable flag.
 */
export default function AtmosphericBackground() {
  const prefersReducedMotion = useReducedMotion();
  const { themeStyle } = useAppContext();
  const disableMotion =
    themeStyle === "eternal" || themeStyle === "discord" || prefersReducedMotion;

  if (disableMotion) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {/* Mist orbs — same palette as login but lower opacity for non-distraction */}
      <div className="absolute inset-0 opacity-20">
        <div
          className="absolute -top-20 left-[10%] w-[32rem] h-[32rem] bg-jade-deep/20 rounded-full blur-xl animate-glow-pulse"
        />
        <div
          className="absolute bottom-[15%] right-[8%] w-[28rem] h-[28rem] bg-mountain-blue/10 rounded-full blur-xl animate-glow-pulse"
          style={{ animationDelay: "2s" }}
        />
        <div
          className="absolute top-[40%] right-[30%] w-[22rem] h-[22rem] bg-crimson-deep/8 rounded-full blur-xl animate-glow-pulse"
          style={{ animationDelay: "4s" }}
        />
      </div>

      {/* Floating particles — sparse and slow */}
      {[...Array(4)].map((_, i) => {
        const seed = (i * 17321) % 100;
        const topOffset = 65 + (seed % 20);
        const xDrift = (seed % 30) - 15;
        const duration = 6 + (seed % 4);

        return (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-jade-glow/30 rounded-full"
            animate={{
              y: [0, -120, 0],
              x: [0, xDrift, 0],
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration,
              repeat: Infinity,
              delay: i * 1.5,
            }}
            style={{
              left: `${10 + i * 22}%`,
              top: `${topOffset}%`,
            }}
          />
        );
      })}
    </div>
  );
}
