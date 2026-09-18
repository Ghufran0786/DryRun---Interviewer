-- AlterTable
ALTER TABLE "TranscriptEntry" ADD COLUMN "kind" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "verdict" TEXT,
    "evaluationJson" TEXT,
    "sceneJson" TEXT,
    "currentPhase" TEXT NOT NULL DEFAULT 'requirements',
    "phaseNotesJson" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_Session" ("createdAt", "endedAt", "evaluationJson", "id", "problem", "sceneJson", "startedAt", "status", "targetLevel", "title", "verdict") SELECT "createdAt", "endedAt", "evaluationJson", "id", "problem", "sceneJson", "startedAt", "status", "targetLevel", "title", "verdict" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "candidateName" TEXT NOT NULL DEFAULT '',
    "defaultTargetLevel" TEXT NOT NULL DEFAULT 'SDE-2',
    "classifierModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "interviewerModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "evaluatorModel" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
    "interviewDurationMin" INTEGER NOT NULL DEFAULT 45,
    "strictness" TEXT NOT NULL DEFAULT 'Standard',
    "resumeText" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("candidateName", "defaultTargetLevel", "evaluatorModel", "id", "interviewerModel", "resumeText", "strictness") SELECT "candidateName", "defaultTargetLevel", "evaluatorModel", "id", "interviewerModel", "resumeText", "strictness" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
