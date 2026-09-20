-- AlterTable
ALTER TABLE "Session" ADD COLUMN "userId" TEXT NOT NULL DEFAULT 'local';

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
