-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "bucketKey" TEXT NOT NULL PRIMARY KEY,
    "windowStart" DATETIME NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);
