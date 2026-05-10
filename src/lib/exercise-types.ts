// ── Exercise System Types ──
// Simplified exercise types (no tiers/levels/progression)

export type TrainingCategory = string;
export type SimpleExerciseType = string;
export type MuscleGroup = string;
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export const ALL_TRAINING_CATEGORIES: TrainingCategory[] = ['Calisthenics', 'Gym', 'Yoga', 'Cardio', 'Stretching', 'Other'];
export const ALL_EXERCISE_TYPES: SimpleExerciseType[] = ['weighted', 'timed', 'bodyweight'];
export const ALL_MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Forearms',
  'Core', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Full Body', 'Other',
];
export const ALL_DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];
export const ALL_EQUIPMENT: string[] = [
  'Barbell', 'Dumbbells', 'Bench', 'Cable', 'Machine',
  'Pull-up Bar', 'Dip Station', 'Rings', 'Bands', 'Kettlebell',
  'Squat Rack', 'Parallel Bars', 'Bodyweight Only',
];

export interface SimpleExercise {
  id: string;
  name: string;
  englishName?: string;
  vietnameseName?: string;
  category: TrainingCategory;
  exerciseType: SimpleExerciseType;
  muscleGroups: MuscleGroup[];
  progression?: string[];
  variations?: Array<{
    id?: string;
    name: string;
  }>;
  equipment?: string[];
  setupOptions?: string[];
  difficulty?: Difficulty;
  description?: string;
  instructions?: string[];
  imageUrl?: string;
  videoUrl?: string;
  isCustom: boolean;
  isPendingAddition?: boolean;
  isPendingEdited?: boolean;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExerciseLogEntry {
  id: string;
  date: string;
  category: TrainingCategory;
  exerciseId: string;
  exerciseName: string;
  exerciseType: SimpleExerciseType;
  sets: SetData[];
  modifier?: string;
  modifierWeight?: number; // Additional weight in KG when modifier is "Weighted"
  band?: string;
  variant?: string;
  notes?: string;
}

export interface SetData {
  weight?: number;
  reps?: number;
  holdTime?: number;
}

/** Map ProgressionExercise from DB into simplified exercise interface */
export function mapProgressionToSimpleExercise(pe: {
  id: string;
  name: string;
  category: string;
  bodyweight: boolean;
  weighted: boolean;
  primaryMuscles: string;
  secondaryMuscles?: string;
  equipmentType?: string;
  difficulty?: string;
  story?: string;
  tips?: string;
  userId: string;
  createdAt?: string | Date;
}): SimpleExercise {
  const category = inferCategory(pe.category);
  const exerciseType = inferSimpleExerciseType(pe);
  const muscleGroups = parseMuscleGroups(pe.primaryMuscles, pe.secondaryMuscles);
  const equipment = pe.equipmentType ? [pe.equipmentType] : undefined;
  const difficulty = inferDifficulty(pe.difficulty);

  return {
    id: pe.id,
    name: pe.name,
    category,
    exerciseType,
    muscleGroups,
    equipment,
    difficulty,
    description: pe.story || undefined,
    isCustom: true,
    userId: pe.userId,
    createdAt: pe.createdAt instanceof Date ? pe.createdAt.toISOString() : pe.createdAt,
  };
}

function inferCategory(cat: string): TrainingCategory {
  const lower = (cat || '').toLowerCase();
  if (lower.includes('gym')) return 'Gym';
  if (lower.includes('calisthenics') || lower.includes('cali')) return 'Calisthenics';
  if (lower.includes('yoga')) return 'Yoga';
  if (lower.includes('cardio')) return 'Cardio';
  if (lower.includes('stretch')) return 'Stretching';
  return 'Other';
}

function inferSimpleExerciseType(pe: { bodyweight: boolean; weighted: boolean; category?: string }): SimpleExerciseType {
  if (pe.weighted) return 'weighted';
  if (pe.bodyweight) return 'bodyweight';
  const cat = (pe.category || '').toLowerCase();
  if (cat.includes('yoga') || cat.includes('stretch')) return 'timed';
  if (cat.includes('gym')) return 'weighted';
  return 'bodyweight';
}

function parseMuscleGroups(primary: string, secondary?: string): MuscleGroup[] {
  const all = [primary, secondary || '']
    .join(',')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const mapped: MuscleGroup[] = [];
  for (const m of all) {
    const match = ALL_MUSCLE_GROUPS.find(g => g.toLowerCase() === m.toLowerCase());
    if (match && !mapped.includes(match)) {
      mapped.push(match);
    }
  }
  return mapped.length > 0 ? mapped : ['Other'];
}

function inferDifficulty(diff?: string): Difficulty | undefined {
  if (!diff) return undefined;
  const lower = diff.toLowerCase();
  if (lower === 'beginner') return 'Beginner';
  if (lower === 'intermediate') return 'Intermediate';
  if (lower === 'advanced') return 'Advanced';
  return undefined;
}

/** Get the exercise type icon emoji */
export function getExerciseTypeIcon(type: SimpleExerciseType): string {
  switch ((type || '').toLowerCase()) {
    case 'weighted': return '🏋️';
    case 'timed': return '⏱️';
    case 'bodyweight': return '🤸';
    default: return '⚙️';
  }
}

/** Get category icon emoji */
export function getCategoryIcon(category: TrainingCategory): string {
  switch ((category || '').toLowerCase()) {
    case 'gym': return '🏋️';
    case 'calisthenics': return '💪';
    case 'yoga': return '🧘';
    case 'cardio': return '🏃';
    case 'stretching': return '🤸';
    case 'other': return '🔱';
    default: return '🧩';
  }
}
