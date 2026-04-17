"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { getCopy } from "@/lib/copy";
import type { LanguageMode } from "@/lib/language";
import { useAuth } from "@/context/AuthContext";
import { useGettingStarted, type GettingStartedTasks } from "@/hooks/useGettingStarted";

interface GettingStartedCardProps {
  lang?: LanguageMode;
  onTaskNavigate?: (taskId: keyof GettingStartedTasks) => void;
}

const TASK_ROUTES: Record<keyof GettingStartedTasks, string> = {
  firstCheckin: "/dashboard/check-in",
  firstTraining: "/dashboard/train",
  exploreLibrary: "/dashboard/exercise-db",
  addFriend: "/dashboard/friends",
  customizeSettings: "/dashboard/settings",
};

const TASK_ORDER: (keyof GettingStartedTasks)[] = [
  "firstCheckin",
  "firstTraining",
  "exploreLibrary",
  "addFriend",
  "customizeSettings",
];

export default function GettingStartedCard({ lang = "english", onTaskNavigate }: GettingStartedCardProps) {
  const { tasks, dismissed, loading, dismiss } = useGettingStarted();
  const { user } = useAuth();
  const router = useRouter();
  const copy = getCopy(lang).gettingStarted;
  const visibleTaskOrder = user?.role === "admin" ? TASK_ORDER : TASK_ORDER.filter((taskId) => taskId !== "exploreLibrary");
  const visibleCompletedCount = visibleTaskOrder.filter((taskId) => tasks[taskId]).length;
  const visibleTotalCount = visibleTaskOrder.length;
  const visibleAllComplete = visibleCompletedCount === visibleTotalCount;

  if (loading || dismissed) return null;

  const handleTaskClick = (taskId: keyof GettingStartedTasks) => {
    if (onTaskNavigate) {
      onTaskNavigate(taskId);
    } else {
      router.push(TASK_ROUTES[taskId]);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="surface-panel p-4 mb-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-cloud-white">{copy.title}</h3>
            <p className="text-xs text-mist-mid">{copy.subtitle}</p>
          </div>
          <button
            onClick={dismiss}
            className="text-xs text-mist-dark hover:text-mist-mid transition-colors px-2 py-1"
          >
            {copy.dismiss}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-mist-mid mb-1">
            <span>
              {visibleCompletedCount}/{visibleTotalCount}
            </span>
          </div>
          <div className="w-full h-1.5 bg-ink-deep rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-jade-deep to-jade-glow rounded-full"
              animate={{ width: `${visibleTotalCount > 0 ? (visibleCompletedCount / visibleTotalCount) * 100 : 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>

        {visibleAllComplete ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-2"
          >
            <p className="text-jade-light text-sm">✨ {copy.allComplete}</p>
          </motion.div>
        ) : (
          <div className="space-y-1.5">
            {visibleTaskOrder.map((taskId) => {
              const taskCopy = copy.tasks[taskId];
              const completed = tasks[taskId];

              return (
                <button
                  key={taskId}
                  onClick={() => !completed && handleTaskClick(taskId)}
                  disabled={completed}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-colors ${
                    completed
                      ? "opacity-50"
                      : "hover:bg-ink-mid/30"
                  }`}
                >
                  {/* Checkbox */}
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      completed
                        ? "border-jade bg-jade-deep/40"
                        : "border-ink-light"
                    }`}
                  >
                    {completed && (
                      <svg className="w-3 h-3 text-jade-light" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${completed ? "text-mist-dark line-through" : "text-cloud-white"}`}>
                      {taskCopy.title}
                    </p>
                    <p className="text-xs text-mist-mid truncate">{taskCopy.description}</p>
                  </div>

                  {!completed && (
                    <svg className="w-4 h-4 text-mist-dark flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
