"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageLayout from "@/components/layout/PageLayout";
import ActiveTrainingCard from "@/components/workout/ActiveTrainingCard";
import RecentSessionsDisplay from "@/components/workout/RecentSessionsDisplay";
import TrainingSidebar from "@/components/workout/TrainingSidebar";
import TechniqueManagementDrawer from "@/components/workout/TechniqueManagementDrawer";
import { useAppContext } from "@/context/AppContext";

interface Exercise {
  id: string;
  name: string;
  wuxiaName?: string;
  difficulty: string;
  type: string;
  targetGroup?: string;
  assignedDays?: string;
  story?: string;
}

export default function TrainingGrounds() {
  const { isMobile, registerDrawerClose } = useAppContext();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedTechniques, setSelectedTechniques] = useState<string[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [exerciseOrder, setExerciseOrder] = useState<string[]>([]);
  const [isLoadingExercises, setIsLoadingExercises] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load exercises on mount
  useEffect(() => {
    async function fetchExercises() {
      try {
        const response = await fetch("/api/exercises");
        if (response.ok) {
          const data = await response.json();
          const loaded = data.exercises || [];
          setExercises(loaded);
          // Initialize order from localStorage or default to fetch order
          const storedOrder = localStorage.getItem("cultivateos-exercise-order");
          if (storedOrder) {
            try {
              const parsed: string[] = JSON.parse(storedOrder);
              // Merge: keep stored order for known ids, append any new exercises at end
              const knownIds = new Set(loaded.map((e: Exercise) => e.id));
              const validOrder = parsed.filter((id: string) => knownIds.has(id));
              const remaining = loaded.filter((e: Exercise) => !validOrder.includes(e.id)).map((e: Exercise) => e.id);
              setExerciseOrder([...validOrder, ...remaining]);
            } catch {
              setExerciseOrder(loaded.map((e: Exercise) => e.id));
            }
          } else {
            setExerciseOrder(loaded.map((e: Exercise) => e.id));
          }
        }
      } catch (error) {
        console.error("Failed to load exercises:", error);
      } finally {
        setIsLoadingExercises(false);
      }
    }
    fetchExercises();
  }, []);

  const handleSubmissionSuccess = () => {
    // Trigger refresh of recent sessions display
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectTechnique = (exerciseId: string) => {
    setSelectedTechniques(prev => {
      if (prev.includes(exerciseId)) {
        // If already selected, remove it (deselect)
        return prev.filter(id => id !== exerciseId);
      } else {
        // If not selected, add it
        return [...prev, exerciseId];
      }
    });
  };

  const handleRemoveTechnique = (exerciseId: string) => {
    setSelectedTechniques(prev => prev.filter(id => id !== exerciseId));
  };

  const handleDrawerOpen = () => {
    setIsDrawerOpen(true);
    registerDrawerClose(() => setIsDrawerOpen(false));
  };

  const handleDrawerClose = () => {
    setIsDrawerOpen(false);
    registerDrawerClose(null);
  };

  // Reorder handler — persists to localStorage and updates state
  const handleReorderExercises = (orderedIds: string[]) => {
    setExerciseOrder(orderedIds);
    localStorage.setItem("cultivateos-exercise-order", JSON.stringify(orderedIds));
  };

  // Compute exercises sorted by the established order
  const orderedExercises = [...exercises].sort((a, b) => {
    const ai = exerciseOrder.indexOf(a.id);
    const bi = exerciseOrder.indexOf(b.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  const handleUpdateDayAssignments = async (exerciseId: string, assignedDays: string) => {
    try {
      const dayIndices = assignedDays ? assignedDays.split(',').map(d => parseInt(d)).filter(d => !isNaN(d)) : [];
      
      const response = await fetch(`/api/exercises/${exerciseId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedDays: dayIndices,
        }),
      });

      if (response.ok) {
        const { exercise } = await response.json();
        // Update the exercises list with the new assignment
        setExercises(prev => prev.map(ex => 
          ex.id === exerciseId ? { ...ex, assignedDays: exercise.assignedDays } : ex
        ));
      } else {
        throw new Error("Failed to update day assignments");
      }
    } catch (error) {
      console.error("Error updating day assignments:", error);
      throw error;
    }
  };

  const sidebar = (
    <TrainingSidebar
      exercises={orderedExercises}
      selectedTechniques={selectedTechniques}
      onSelectTechnique={handleSelectTechnique}
      isLoadingExercises={isLoadingExercises}
      isMobile={isMobile}
      onDrawerOpen={handleDrawerOpen}
    />
  );

  return (
    <PageLayout 
      title="Training Grounds"
      subtitle="Record your cultivation sessions and perfect your martial techniques"
      sidebar={sidebar}
      sidebarLabel="Techniques"
    >
      <div className="space-y-6">
        {/* Active Training Cards */}
        <AnimatePresence mode="popLayout">
          {selectedTechniques.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-2"
            >
              {selectedTechniques
                .slice()
                .sort((a, b) => {
                  const ai = exerciseOrder.indexOf(a);
                  const bi = exerciseOrder.indexOf(b);
                  return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
                })
                .map((techniqueId, index) => {
                const exercise = exercises.find(ex => ex.id === techniqueId);
                if (!exercise) return null;
                
                return (
                  <ActiveTrainingCard
                    key={techniqueId}
                    exercise={exercise}
                    onSubmit={() => {
                      handleSubmissionSuccess();
                      // Optionally remove the technique after successful submission
                      // handleRemoveTechnique(techniqueId);
                    }}
                    onRemove={() => handleRemoveTechnique(techniqueId)}
                    delay={index * 0.1}
                  />
                );
              })}
            </motion.div>
          )}
          
          {/* Empty state when no techniques selected */}
          {selectedTechniques.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12"
            >
              <div className="space-y-3">
                <div className="text-6xl opacity-50">⚔️</div>
                <h3 className="text-lg font-medium text-text-secondary">
                  Select Techniques to Begin Training
                </h3>
                <p className="text-text-tertiary">
                  Choose techniques from the sidebar to create your training session
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Recent Sessions Display */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <RecentSessionsDisplay refreshTrigger={refreshTrigger} />
        </motion.div>
      </div>

      {/* Technique Management Drawer */}
      <TechniqueManagementDrawer
        isOpen={isDrawerOpen}
        onClose={handleDrawerClose}
        exercises={orderedExercises}
        onUpdateDayAssignments={handleUpdateDayAssignments}
        onReorderExercises={handleReorderExercises}
      />

    </PageLayout>
  );
}