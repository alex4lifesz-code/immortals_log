"use client";

import { useState, useEffect, CSSProperties } from "react";
import { motion } from "framer-motion";
import GlowCard from "@/components/ui/GlowCard";
import GlowInput from "@/components/ui/GlowInput";
import GlowButton from "@/components/ui/GlowButton";
import { useAuth } from "@/context/AuthContext";
import { useDisplaySettings } from "@/context/DisplaySettingsContext";
import { getDifficultyColorClass, getDifficultyGlowStyle } from "@/lib/difficulty-styles";
import { getExerciseDisplayName } from "@/lib/exercise-name";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty: string;
  type: string;
  targetGroup?: string;
}

interface WorkoutSubmissionProps {
  onSubmissionSuccess?: () => void;
  preSelectedExerciseId?: string;
}

export default function WorkoutSubmission({ onSubmissionSuccess, preSelectedExerciseId }: WorkoutSubmissionProps) {
  const { user } = useAuth();
  const { settings } = useDisplaySettings();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string>("");
  const [weight1, setWeight1] = useState<string>("");
  const [reps1, setReps1] = useState<string>("");
  const [weight2, setWeight2] = useState<string>("");
  const [reps2, setReps2] = useState<string>("");
  const [weight3, setWeight3] = useState<string>("");
  const [reps3, setReps3] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<{ type: "success" | "error", text: string } | null>(null);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);

  // Load exercises on mount
  useEffect(() => {
    async function fetchExercises() {
      try {
        const response = await fetch("/api/exercises");
        if (response.ok) {
          const data = await response.json();
          setExercises(data.exercises || []);
        }
      } catch (error) {
        console.error("Failed to load exercises:", error);
      } finally {
        setIsLoadingExercises(false);
      }
    }
    fetchExercises();
  }, []);

  // Update selected exercise when pre-selected ID changes
  useEffect(() => {
    if (preSelectedExerciseId) {
      setSelectedExercise(preSelectedExerciseId);
    }
  }, [preSelectedExerciseId]);

  // Clear message after 5 seconds
  useEffect(() => {
    if (submitMessage) {
      const timer = setTimeout(() => {
        setSubmitMessage(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [submitMessage]);

  const resetForm = () => {
    setSelectedExercise("");
    setWeight1("");
    setReps1("");
    setWeight2("");
    setReps2("");
    setWeight3("");
    setReps3("");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user?.id) {
      setSubmitMessage({ type: "error", text: "User not authenticated" });
      return;
    }

    if (!selectedExercise || (!reps1 && !reps2 && !reps3)) {
      setSubmitMessage({ type: "error", text: "Please select a technique and enter at least one set of reps" });
      return;
    }

    setIsSubmitting(true);
    setSubmitMessage(null);

    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id,
          exerciseId: selectedExercise,
          weight1: weight1 ? parseFloat(weight1) : undefined,
          reps1: reps1 ? parseInt(reps1) : undefined,
          weight2: weight2 ? parseFloat(weight2) : undefined,
          reps2: reps2 ? parseInt(reps2) : undefined,
          weight3: weight3 ? parseFloat(weight3) : undefined,
          reps3: reps3 ? parseInt(reps3) : undefined,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSubmitMessage({ type: "success", text: data.message || "Training session recorded successfully!" });
        resetForm();
        onSubmissionSuccess?.();
      } else {
        setSubmitMessage({ type: "error", text: data.error || "Failed to record training session" });
      }
    } catch (error) {
      console.error("Submission error:", error);
      setSubmitMessage({ type: "error", text: "Network error - please try again" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedExerciseData = exercises.find(ex => ex.id === selectedExercise);

  return (
    <GlowCard className="w-full max-w-4xl mx-auto" glow="jade">
      {/* Compact Header */}
      <div className="mb-3">
        <h2 className="text-base font-bold text-jade-glow mb-1">Record Training Session</h2>
        
        {/* Success/Error Messages */}
        {submitMessage && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className={`p-2 rounded-lg border text-center text-xs mt-2 ${
              submitMessage.type === "success"
                ? "bg-jade-deep/20 border-jade/40 text-jade-light"
                : "bg-crimson-deep/20 border-crimson/40 text-crimson-light"
            }`}
          >
            {submitMessage.text}
          </motion.div>
        )}
      </div>

      {/* Compact Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Main Input Row - Horizontal Layout */}
        <div className="grid gap-2 md:gap-3 grid-cols-1 md:grid-cols-4 lg:grid-cols-5 items-end">
          {/* Technique Selection - Spans 2 columns on larger screens */}
          <div className="md:col-span-2 lg:col-span-2 space-y-1">
            <label className="block text-xs text-mist-light uppercase tracking-wide">
              Technique
            </label>
            <select
              value={selectedExercise}
              onChange={(e) => setSelectedExercise(e.target.value)}
              disabled={isLoadingExercises}
              className="w-full bg-ink-dark border border-ink-light rounded px-2 py-1.5 text-sm
                         outline-none transition-all duration-300 focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.3)]"
            >
              <option value="">
                {isLoadingExercises ? "Loading..." : "Select technique"}
              </option>
              {exercises.map((exercise) => (
                <option key={exercise.id} value={exercise.id}>
                  {getExerciseDisplayName(exercise, settings.terminologyMode)}
                </option>
              ))}
            </select>
          </div>

          {/* Set 1 Inputs */}
          <div className="grid grid-cols-2 gap-1">
            <GlowInput
              type="number"
              min="0"
              step="0.5"
              value={weight1}
              onChange={(e) => setWeight1(e.target.value)}
              placeholder="Weight"
              className="text-xs py-1"
            />
            <GlowInput
              type="number"
              min="1"
              max="500"
              value={reps1}
              onChange={(e) => setReps1(e.target.value)}
              placeholder="Reps"
              className="text-xs py-1"
            />
          </div>

          {/* Set 2 Inputs - Hidden on smallest screens */}
          <div className="hidden md:grid grid-cols-2 gap-1">
            <GlowInput
              type="number"
              min="0"
              step="0.5"
              value={weight2}
              onChange={(e) => setWeight2(e.target.value)}
              placeholder="Weight 2"
              className="text-xs py-1"
            />
            <GlowInput
              type="number"
              min="1"
              max="500"
              value={reps2}
              onChange={(e) => setReps2(e.target.value)}
              placeholder="Reps 2"
              className="text-xs py-1"
            />
          </div>

          {/* Submit Button */}
          <GlowButton
            type="submit"
            disabled={isSubmitting || !selectedExercise || (!reps1 && !reps2 && !reps3)}
            variant="jade"
            size="sm"
            className="px-3 py-1.5 text-sm"
          >
            {isSubmitting ? "⏳" : "⚔️ Record"}
          </GlowButton>
        </div>

        {/* Additional Sets for Mobile — always visible */}
        <div className="md:hidden">
            <div className="space-y-2 pt-2 border-t border-ink-light">
              <p className="text-[10px] text-mist-dark uppercase tracking-wide">Additional Sets</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="grid grid-cols-2 gap-1">
                  <GlowInput
                    type="number"
                    min="0"
                    step="0.5"
                    value={weight2}
                    onChange={(e) => setWeight2(e.target.value)}
                    placeholder="Wt 2"
                    className="text-xs py-1"
                  />
                  <GlowInput
                    type="number"
                    min="1"
                    max="500"
                    value={reps2}
                    onChange={(e) => setReps2(e.target.value)}
                    placeholder="Reps 2"
                    className="text-xs py-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <GlowInput
                    type="number"
                    min="0"
                    step="0.5"
                    value={weight3}
                    onChange={(e) => setWeight3(e.target.value)}
                    placeholder="Wt 3"
                    className="text-xs py-1"
                  />
                  <GlowInput
                    type="number"
                    min="1"
                    max="500"
                    value={reps3}
                    onChange={(e) => setReps3(e.target.value)}
                    placeholder="Reps 3"
                    className="text-xs py-1"
                  />
                </div>
              </div>
            </div>
        </div>

        {/* Hidden Set 3 for Desktop */}
        <div className="hidden lg:grid lg:grid-cols-5 gap-3 items-center">
          <div className="lg:col-span-2"></div>
          <div className="grid grid-cols-2 gap-1">
            <GlowInput
              type="number"
              min="0"
              step="0.5"
              value={weight3}
              onChange={(e) => setWeight3(e.target.value)}
              placeholder="Weight 3"
              className="text-xs py-1"
            />
            <GlowInput
              type="number"
              min="1"
              max="500"
              value={reps3}
              onChange={(e) => setReps3(e.target.value)}
              placeholder="Reps 3"
              className="text-xs py-1"
            />
          </div>
          <div></div>
          <div></div>
        </div>

        {/* Compact Notes */}
        <div>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes..."
            className="w-full bg-ink-dark border border-ink-light rounded px-2 py-1 text-xs
                       placeholder:text-mist-dark outline-none transition-all duration-300
                       focus:border-jade-glow focus:shadow-[0_0_8px_rgba(58,143,143,0.3)]"
          />
        </div>

        {/* Selected Exercise Info - Compact */}
        {selectedExerciseData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            style={getDifficultyGlowStyle(selectedExerciseData.difficulty) as CSSProperties}
            className="p-2 rounded border text-xs"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{getExerciseDisplayName(selectedExerciseData, settings.terminologyMode)}</span>
              <div className="flex items-center gap-2 text-mist-light">
                <span className={getDifficultyColorClass(selectedExerciseData.difficulty)}>
                  {selectedExerciseData.difficulty}
                </span>
                <span>{selectedExerciseData.type}</span>
              </div>
            </div>
          </motion.div>
        )}
      </form>
    </GlowCard>
  );
}