-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "targetLevel" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'created',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "verdict" TEXT,
    "evaluationJson" TEXT,
    "sceneJson" TEXT,
    "currentPhase" TEXT NOT NULL DEFAULT 'requirements',
    "phaseNotesJson" TEXT,
    "promptTokens" INTEGER NOT NULL DEFAULT 0,
    "completionTokens" INTEGER NOT NULL DEFAULT 0,
    "ttsChars" INTEGER NOT NULL DEFAULT 0,
    "reconnectCount" INTEGER NOT NULL DEFAULT 0,
    "closeCodesJson" TEXT,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TranscriptEntry" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "kind" TEXT,
    "trigger" TEXT,
    "text" TEXT NOT NULL,
    "tsMs" INTEGER NOT NULL,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Snapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pngPath" TEXT NOT NULL,
    "elementsJson" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,

    CONSTRAINT "Snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "candidateName" TEXT NOT NULL DEFAULT '',
    "defaultTargetLevel" TEXT NOT NULL DEFAULT 'SDE-2',
    "classifierModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "interviewerModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "interviewerVisionWarning" TEXT NOT NULL DEFAULT '',
    "evaluatorModel" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
    "ttsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ttsProvider" TEXT NOT NULL DEFAULT 'browser',
    "browserVoiceName" TEXT,
    "browserVoiceRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "ttsModel" TEXT NOT NULL DEFAULT 'mistralai/voxtral-mini-tts-2603',
    "ttsVoice" TEXT NOT NULL DEFAULT 'en_paul_neutral',
    "usingHeadphones" BOOLEAN NOT NULL DEFAULT true,
    "interviewDurationMin" INTEGER NOT NULL DEFAULT 45,
    "keyterms" TEXT NOT NULL DEFAULT 'Ghufran Ahmad Khan
Ghufran
Ahmad
Khan
LeetCode
Cassandra
DynamoDB
PostgreSQL
Redis
Kafka
Kubernetes
gRPC
CDN
QPS
DAU
sharding
consistent hashing
idempotent
rate limiting
load balancer
websocket
CRDT
operational transformation
leaderboard
write-ahead log
message queue
microservices',
    "strictness" TEXT NOT NULL DEFAULT 'Standard',
    "resumeText" TEXT NOT NULL DEFAULT '',
    "localEvaluationEnabled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptEntry_sessionId_idx" ON "TranscriptEntry"("sessionId");

-- CreateIndex
CREATE INDEX "Snapshot_sessionId_idx" ON "Snapshot"("sessionId");

-- AddForeignKey
ALTER TABLE "TranscriptEntry" ADD CONSTRAINT "TranscriptEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Snapshot" ADD CONSTRAINT "Snapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

