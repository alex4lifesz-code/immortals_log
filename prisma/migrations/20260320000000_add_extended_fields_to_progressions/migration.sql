-- Add extended fields to ProgressionExercise
ALTER TABLE "ProgressionExercise" ADD COLUMN "wuxiaDifficulty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionExercise" ADD COLUMN "wuxiaType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionExercise" ADD COLUMN "prerequisites" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProgressionExercise" ADD COLUMN "cues" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProgressionExercise" ADD COLUMN "commonMistakes" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProgressionExercise" ADD COLUMN "breathing" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionExercise" ADD COLUMN "safetyConsiderations" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "ProgressionExercise" ADD COLUMN "competitionStandards" TEXT NOT NULL DEFAULT '{}';

-- Add extended fields to ProgressionTier
ALTER TABLE "ProgressionTier" ADD COLUMN "wuxiaDifficulty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionTier" ADD COLUMN "wuxiaType" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionTier" ADD COLUMN "targetRepsText" TEXT NOT NULL DEFAULT '';

-- Add extended fields to ProgressionVariation
ALTER TABLE "ProgressionVariation" ADD COLUMN "wuxiaDifficulty" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionVariation" ADD COLUMN "wuxiaType" TEXT NOT NULL DEFAULT '';

-- Add extended fields to ProgressionModifier
ALTER TABLE "ProgressionModifier" ADD COLUMN "method" TEXT NOT NULL DEFAULT '';
ALTER TABLE "ProgressionModifier" ADD COLUMN "difficultyIncrease" TEXT NOT NULL DEFAULT '';
