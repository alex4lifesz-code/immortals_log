"use client";

import { motion } from "framer-motion";
import { DIFFICULTY_SCALE } from "@/app/dashboard/workout/utils";
import { GlowModal } from "@/components/ui/GlowCard";

const GUIDE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Mortal": { bg: "bg-green-500/15", text: "text-green-400", border: "border-green-500/30" },
  "Foundation Establishment": { bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" },
  "Core Formation": { bg: "bg-red-500/15", text: "text-red-400", border: "border-red-500/30" },
  "Nascent Soul": { bg: "bg-violet-500/15", text: "text-violet-400", border: "border-violet-500/30" },
  "Soul Splitting": { bg: "bg-pink-500/15", text: "text-pink-400", border: "border-pink-500/30" },
  "Tribulation Transcendence": { bg: "bg-yellow-400/15", text: "text-yellow-300", border: "border-yellow-400/30" },
  "Immortal": { bg: "bg-pink-300/15", text: "text-pink-300", border: "border-pink-300/30" },
  "Heavenly Dao": { bg: "bg-cyan-300/15", text: "text-cyan-300", border: "border-cyan-300/30" },
};

export function CultivationColorGuide({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <GlowModal isOpen={isOpen} onClose={onClose} title="Cultivation Color System">
      <div className="space-y-5 text-xs">
        <p className="text-mist-mid leading-relaxed text-sm">
          Each training log entry glows with a colour representing its <span className="text-cloud-white font-medium">cultivation rank</span> — computed from three weighted factors.
        </p>

        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">The Eight Ranks</h4>
          <div className="flex rounded-lg overflow-hidden border border-ink-light">
            {DIFFICULTY_SCALE.map((d) => {
              const c = GUIDE_COLORS[d];
              return (
                <div key={d} className={`flex-1 py-2 px-0.5 text-center ${c.bg}`}>
                  <div className={`text-[9px] font-bold ${c.text} leading-tight`}>
                    {d.split(" ").map((w, i) => <span key={i} className="block">{w}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between mt-1 px-1">
            <span className="text-[9px] text-green-400/70">← Easiest</span>
            <span className="text-[9px] text-cyan-300/70">Hardest →</span>
          </div>
        </div>

        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">How Colour Is Determined</h4>
          <p className="text-mist-mid mb-3 leading-relaxed">
            A weighted score from <span className="text-cloud-white">0.0</span> to <span className="text-cloud-white">1.0</span> is computed, then mapped to the rank scale above.
          </p>

          <div className="space-y-2.5">
            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">📊</span> Tier Level
                </span>
                <span className="text-jade-glow font-bold text-[11px] bg-jade-deep/20 px-2 py-0.5 rounded-full">Base Score</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Your tier position within the exercise determines the <span className="text-cloud-white">base colour</span>.
                The lowest tier = <span className="text-green-400">0.0</span> (Mortal), the highest = <span className="text-cyan-300">1.0</span> (Heavenly Dao).
                Tiers in between are spaced evenly across the scale.
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">score = tierIndex / (totalTiers − 1)</span>
              </div>
            </div>

            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">🔀</span> Variation
                </span>
                <span className="text-purple-400 font-bold text-[11px] bg-purple-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Selecting a variation shifts the score based on its <span className="text-purple-400">difficulty rank</span>.
                A <span className="text-green-400">Mortal</span>-difficulty variation shifts down (−0.15), while a <span className="text-cyan-300">Heavenly Dao</span>-grade one shifts up (+0.15).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = (variationRank / 6 − 0.5) × 0.30</span>
              </div>
            </div>

            <div className="rounded-lg border border-ink-light p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-cloud-white font-semibold flex items-center gap-1.5">
                  <span className="text-sm">⚡</span> Modifier
                </span>
                <span className="text-amber-400 font-bold text-[11px] bg-amber-500/15 px-2 py-0.5 rounded-full">±0.15 shift</span>
              </div>
              <p className="text-mist-mid leading-relaxed">
                Modifiers with a positive <span className="text-amber-400">difficulty mod</span> push the score upward, while negative ones pull it down.
                The shift is proportional to the modifier value (capped at ±3).
              </p>
              <div className="flex items-center gap-2 bg-ink-mid/30 rounded px-2 py-1.5">
                <span className="text-mist-dark text-[10px] font-mono">shift = clamp(diffMod / 3, −1, 1) × 0.15</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-jade-glow/30 bg-jade-deep/10 p-3 space-y-2">
          <h4 className="text-[11px] text-jade-glow uppercase tracking-wider font-semibold">Final Computation</h4>
          <div className="bg-ink-mid/40 rounded px-3 py-2 text-center">
            <span className="text-[11px] font-mono text-cloud-white">
              finalScore = <span className="text-jade-glow">base</span> + <span className="text-purple-400">variationShift</span> + <span className="text-amber-400">modifierShift</span>
            </span>
          </div>
          <p className="text-mist-mid leading-relaxed">
            The result is clamped to <span className="text-cloud-white">0.0 – 1.0</span> and mapped to the nearest cultivation rank.
            Without a variation or modifier, the colour is determined purely by tier level.
          </p>
        </div>

        <div>
          <h4 className="text-[11px] text-mist-light uppercase tracking-wider font-semibold mb-2">Examples</h4>
          <div className="space-y-1.5">
            {([
              { desc: "Lowest tier, no modifiers", score: "0.00", rank: "Mortal" },
              { desc: "Mid tier, no modifiers", score: "0.50", rank: "Nascent Soul" },
              { desc: "Mid tier + hard variation", score: "0.65", rank: "Soul Splitting" },
              { desc: "Mid tier + hard variation + weighted (+2)", score: "0.75", rank: "Tribulation Transcendence" },
              { desc: "Highest tier, no modifiers", score: "1.00", rank: "Heavenly Dao" },
            ] as const).map((ex) => {
              const c = GUIDE_COLORS[ex.rank];
              return (
                <div key={ex.desc} className="flex items-center gap-2 text-[11px]">
                  <span className={`w-2 h-2 rounded-full ${c.bg} border ${c.border} shrink-0`} />
                  <span className="text-mist-mid flex-1">{ex.desc}</span>
                  <span className="text-mist-dark font-mono">{ex.score}</span>
                  <span className={`${c.text} font-semibold text-[10px] min-w-[80px] text-right`}>{ex.rank}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </GlowModal>
  );
}

export function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-20 text-center"
    >
      <div className="text-6xl mb-6 opacity-40">🏛️</div>
      <h2 className="text-xl text-cloud-white mb-2">No Progressions Yet</h2>
      <p className="text-sm text-mist-mid max-w-md mb-6">
        Upload a JSON file in the <span className="text-jade-glow font-medium">Technique Scroll</span> page to populate your progression exercises.
      </p>
    </motion.div>
  );
}
