-- Add progression JSON array field to ProgressionExercise
ALTER TABLE "ProgressionExercise" ADD COLUMN "progression" TEXT NOT NULL DEFAULT '[]';
