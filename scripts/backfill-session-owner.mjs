/**
 * Assigns hosted Session rows with no owner to DRYRUN_OWNER_USER_ID.
 * Run after migrate deploy (build:hosted does this when env is present).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadDotEnv() {
  const envPath = path.join(root, ".env");
  try {
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      if (!line || line.startsWith("#")) continue;
      const i = line.indexOf("=");
      if (i < 1) continue;
      const key = line.slice(0, i);
      if (
        process.env[key] !== undefined &&
        key !== "DATABASE_URL" &&
        key !== "DRYRUN_OWNER_USER_ID"
      ) {
        continue;
      }
      const value = line
        .slice(i + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  } catch {
    // Vercel build injects env directly.
  }
}

loadDotEnv();

const ownerId = process.env.DRYRUN_OWNER_USER_ID?.trim();
if (!ownerId) {
  console.error("backfill-session-owner: DRYRUN_OWNER_USER_ID is required");
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL ?? "";
if (!dbUrl.startsWith("postgres")) {
  console.error(
    "backfill-session-owner: DATABASE_URL must be a Postgres URL for hosted backfill",
  );
  process.exit(1);
}

const prisma = new PrismaClient();
try {
  const result = await prisma.session.updateMany({
    where: {
      OR: [{ userId: null }, { userId: "pending" }],
    },
    data: { userId: ownerId },
  });
  console.log(`backfill-session-owner: updated ${result.count} session row(s)`);
} finally {
  await prisma.$disconnect();
}
