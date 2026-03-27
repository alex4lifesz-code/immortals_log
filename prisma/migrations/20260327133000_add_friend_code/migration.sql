-- AddColumn
ALTER TABLE "User" ADD COLUMN "friendCode" TEXT;

-- Backfill existing users with deterministic unique values
UPDATE "User"
SET "friendCode" = "id"
WHERE "friendCode" IS NULL OR "friendCode" = '';

-- CreateIndex
CREATE UNIQUE INDEX "User_friendCode_key" ON "User"("friendCode");
