-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckIn_userId_idx" ON "CheckIn"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Workout_userId_idx" ON "Workout"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimplifiedWorkoutExercise_workoutId_idx" ON "SimplifiedWorkoutExercise"("workoutId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SimplifiedWorkoutExercise_exerciseId_idx" ON "SimplifiedWorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DetailedWorkoutExercise_workoutId_idx" ON "DetailedWorkoutExercise"("workoutId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DetailedWorkoutExercise_exerciseId_idx" ON "DetailedWorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "CheckInNote_userId_idx" ON "CheckInNote"("userId");

-- Add cascade delete for Exercise relations by recreating the tables
-- SimplifiedWorkoutExercise: add ON DELETE CASCADE for exerciseId FK
CREATE TABLE "new_SimplifiedWorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "weight1" REAL,
    "reps1" INTEGER,
    "weight2" REAL,
    "reps2" INTEGER,
    "weight3" REAL,
    "reps3" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SimplifiedWorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SimplifiedWorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_SimplifiedWorkoutExercise" SELECT * FROM "SimplifiedWorkoutExercise";
DROP TABLE "SimplifiedWorkoutExercise";
ALTER TABLE "new_SimplifiedWorkoutExercise" RENAME TO "SimplifiedWorkoutExercise";
CREATE INDEX "SimplifiedWorkoutExercise_workoutId_idx" ON "SimplifiedWorkoutExercise"("workoutId");
CREATE INDEX "SimplifiedWorkoutExercise_exerciseId_idx" ON "SimplifiedWorkoutExercise"("exerciseId");

-- DetailedWorkoutExercise: add ON DELETE CASCADE for exerciseId FK
CREATE TABLE "new_DetailedWorkoutExercise" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workoutId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "weight1" REAL,
    "reps1" INTEGER,
    "weight2" REAL,
    "reps2" INTEGER,
    "weight3" REAL,
    "reps3" INTEGER,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DetailedWorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DetailedWorkoutExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "new_DetailedWorkoutExercise" SELECT * FROM "DetailedWorkoutExercise";
DROP TABLE "DetailedWorkoutExercise";
ALTER TABLE "new_DetailedWorkoutExercise" RENAME TO "DetailedWorkoutExercise";
CREATE INDEX "DetailedWorkoutExercise_workoutId_idx" ON "DetailedWorkoutExercise"("workoutId");
CREATE INDEX "DetailedWorkoutExercise_exerciseId_idx" ON "DetailedWorkoutExercise"("exerciseId");
