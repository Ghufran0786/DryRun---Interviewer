-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TranscriptEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "tsMs" INTEGER NOT NULL,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TranscriptEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TranscriptEntry" ("createdAt", "id", "role", "sessionId", "text", "tsMs") SELECT "createdAt", "id", "role", "sessionId", "text", "tsMs" FROM "TranscriptEntry";
DROP TABLE "TranscriptEntry";
ALTER TABLE "new_TranscriptEntry" RENAME TO "TranscriptEntry";
CREATE INDEX "TranscriptEntry_sessionId_idx" ON "TranscriptEntry"("sessionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
