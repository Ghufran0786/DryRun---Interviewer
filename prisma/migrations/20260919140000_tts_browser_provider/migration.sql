-- AlterTable
ALTER TABLE "Session" ADD COLUMN "ttsChars" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "ttsProvider" TEXT NOT NULL DEFAULT 'browser';
ALTER TABLE "Settings" ADD COLUMN "browserVoiceName" TEXT;
ALTER TABLE "Settings" ADD COLUMN "browserVoiceRate" REAL NOT NULL DEFAULT 1.0;
