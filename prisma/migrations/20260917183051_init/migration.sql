-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" DATETIME,
    "endedAt" DATETIME,
    "verdict" TEXT,
    "evaluationJson" TEXT
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tsMs" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "capturedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pngPath" TEXT NOT NULL,
    "elementsJson" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    CONSTRAINT "Snapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "candidateName" TEXT NOT NULL DEFAULT '',
    "defaultTargetLevel" TEXT NOT NULL DEFAULT 'SDE-2',
    "interviewerModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "evaluatorModel" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
    "strictness" TEXT NOT NULL DEFAULT 'Standard',
    "resumeText" TEXT NOT NULL DEFAULT ''
);

-- CreateIndex
CREATE INDEX "TranscriptEntry_sessionId_idx" ON "TranscriptEntry"("sessionId");

-- CreateIndex
CREATE INDEX "Snapshot_sessionId_idx" ON "Snapshot"("sessionId");
