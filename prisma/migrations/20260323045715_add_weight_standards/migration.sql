-- CreateTable
CREATE TABLE "WeightStandard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "exerciseId" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "tier1Min" REAL NOT NULL DEFAULT 0,
    "tier1Max" REAL NOT NULL,
    "tier2Min" REAL NOT NULL,
    "tier2Max" REAL NOT NULL,
    "tier3Min" REAL NOT NULL,
    "tier3Max" REAL NOT NULL,
    "tier4Min" REAL NOT NULL,
    "tier4Max" REAL NOT NULL,
    "tier5Min" REAL NOT NULL,
    "tier5Max" REAL NOT NULL,
    "tier6Min" REAL NOT NULL,
    "tier6Max" REAL NOT NULL DEFAULT 999,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "WeightStandard_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "ProgressionExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeightStandard_updatedBy_fkey" FOREIGN KEY ("updatedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "WeightStandard_exerciseId_idx" ON "WeightStandard"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightStandard_exerciseId_gender_key" ON "WeightStandard"("exerciseId", "gender");
