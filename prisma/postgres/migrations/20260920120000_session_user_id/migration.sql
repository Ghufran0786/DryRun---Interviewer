-- AlterTable
ALTER TABLE "Session" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
