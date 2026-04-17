export interface ProgressionTier {
  id: string;
  level: number;
  name: string;
  wuxiaName: string;
  difficulty: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
  description: string;
  targetHold: number | null;
  targetReps: number | null;
  targetRepsText?: string | null;
}

export interface ProgressionVariation {
  id: string;
  name: string;
  wuxiaName: string;
  difficulty: string;
  description: string;
  wuxiaDifficulty: string;
  wuxiaType: string;
}

export interface ProgressionModifier {
  id: string;
  type: string;
  available: boolean;
  difficultyMod: number;
  notes: string;
}

export interface DynamicSetRow {
  weight: string;
  reps: string;
}

export interface ProgressionLog {
  id: string;
  level: number;
  weight1: number | null;
  reps1: number | null;
  weight2: number | null;
  reps2: number | null;
  weight3: number | null;
  reps3: number | null;
  holdTime: number | null;
  holdTime2: number | null;
  holdTime3: number | null;
  reps: number | null;
  modifier: string | null;
  variant: string | null;
  notes: string | null;
  dynamicSetRows?: DynamicSetRow[];
  completed: boolean;
  createdAt: string;
}

export interface UserProgress {
  id: string;
  currentLevel: number;
  logs: ProgressionLog[];
}

export interface ProgressionExercise {
  id: string;
  name: string;
  wuxiaName: string;
  englishName?: string;
  vietnameseName?: string;
  difficulty: string;
  wuxiaDifficulty: string;
  type: string;
  wuxiaType: string;
  story: string;
  tips: string;
  category: string;
  equipmentType: string;
  bodyweight: boolean;
  weighted: boolean;
  rings: boolean;
  primaryMuscles: string;
  secondaryMuscles: string;
  assignedDays: string;
  tiers: ProgressionTier[];
  variations: ProgressionVariation[];
  modifiers: ProgressionModifier[];
  userProgress: UserProgress[];
}

export interface ReadyToLogQueueItem {
  id: string;
  exerciseId: string;
}

export interface LogTableFilter {
  exerciseId: string;
  levelNameLevel: number | null;
}
