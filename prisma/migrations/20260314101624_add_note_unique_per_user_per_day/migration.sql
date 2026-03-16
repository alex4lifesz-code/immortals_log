/*
  Warnings:

  - A unique constraint covering the columns `[date,userId]` on the table `CheckInNote` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CheckInNote_date_userId_key" ON "CheckInNote"("date", "userId");
