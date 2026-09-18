-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "candidateName" TEXT NOT NULL DEFAULT '',
    "defaultTargetLevel" TEXT NOT NULL DEFAULT 'SDE-2',
    "classifierModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "interviewerModel" TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
    "evaluatorModel" TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4.5',
    "interviewDurationMin" INTEGER NOT NULL DEFAULT 45,
    "keyterms" TEXT NOT NULL DEFAULT 'LeetCode
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
    "resumeText" TEXT NOT NULL DEFAULT ''
);
INSERT INTO "new_Settings" ("candidateName", "classifierModel", "defaultTargetLevel", "evaluatorModel", "id", "interviewDurationMin", "interviewerModel", "resumeText", "strictness") SELECT "candidateName", "classifierModel", "defaultTargetLevel", "evaluatorModel", "id", "interviewDurationMin", "interviewerModel", "resumeText", "strictness" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
