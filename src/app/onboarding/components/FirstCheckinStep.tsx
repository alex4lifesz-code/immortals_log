"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import type { CultivationCopy } from "@/lib/copy";

interface FirstCheckinStepProps {
  copy: CultivationCopy["onboarding"]["firstCheckin"];
  onContinue: () => void;
  onBack: () => void;
}

export default function FirstCheckinStep({ copy, onContinue, onBack }: FirstCheckinStepProps) {
  const [weight, setWeight] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      await fetch("/api/checkins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          date: dateStr,
          present: true,
          weight: weight ? parseFloat(weight) : null,
          comment: comment || null,
        }),
      });

      setSuccess(true);
    } catch {
      // Still allow continuing even if check-in fails
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex flex-col min-h-[80vh] px-6 py-8"
    >
      <AnimatePresence mode="wait">
        {!success ? (
          <motion.div key="form" exit={{ opacity: 0 }} className="flex-1 flex flex-col">
            <h2 className="text-2xl font-bold text-cloud-white mb-1">{copy.title}</h2>
            <p className="text-mist-mid text-sm mb-2">{copy.subtitle}</p>
            <p className="text-mist-mid/70 text-xs mb-8 leading-relaxed">{copy.explanation}</p>

            <div className="space-y-5 flex-1">
              {/* Weight field */}
              <div>
                <label className="block text-mist-light text-sm font-medium mb-2">
                  {copy.fields.weight}
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="500"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="kg"
                  className="w-full px-4 py-3 rounded-xl bg-ink-deep border border-ink-light/30
                             text-cloud-white placeholder:text-mist-dark text-sm
                             focus:border-jade/50 focus:outline-none transition-colors"
                />
              </div>

              {/* Comment field */}
              <div>
                <label className="block text-mist-light text-sm font-medium mb-2">
                  {copy.fields.comment}
                </label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={copy.fields.commentPlaceholder}
                  rows={4}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl bg-ink-deep border border-ink-light/30
                             text-cloud-white placeholder:text-mist-dark text-sm resize-none
                             focus:border-jade/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3 mt-8 pt-4 border-t border-ink-light/10">
              <button
                onClick={onBack}
                className="flex-1 py-3 rounded-xl border border-ink-light text-mist-light
                           hover:bg-ink-mid transition-colors text-sm font-medium"
              >
                Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                           hover:bg-jade/30 transition-colors text-sm font-semibold disabled:opacity-50"
              >
                {submitting ? "..." : copy.cta}
              </button>
            </div>

            {/* Skip option */}
            <button
              onClick={onContinue}
              className="mt-3 text-xs text-mist-dark hover:text-mist-mid transition-colors text-center"
            >
              Skip for now
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
              className="w-20 h-20 rounded-full bg-jade-deep/40 border border-jade/30
                         flex items-center justify-center mb-6"
            >
              <span className="text-4xl">✨</span>
            </motion.div>
            <h3 className="text-2xl font-bold text-jade-light mb-3">{copy.successTitle}</h3>
            <p className="text-mist-mid text-sm max-w-sm mb-10">{copy.successMessage}</p>
            <button
              onClick={onContinue}
              className="w-full max-w-sm py-3 rounded-xl bg-jade-deep border border-jade/50 text-jade-light
                         hover:bg-jade/30 transition-colors text-sm font-semibold"
            >
              Continue
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
