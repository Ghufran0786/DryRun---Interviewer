import { PrismaClient } from "@prisma/client";
import { getAppMode } from "./appMode";

function assertDatabaseUrlForAppMode(): void {
  const url = process.env.DATABASE_URL ?? "";
  const mode = getAppMode();
  if (mode === "hosted" && !url.startsWith("postgres")) {
    throw new Error(
      'APP_MODE=hosted requires DATABASE_URL to use a PostgreSQL connection (url must start with "postgres").',
    );
  }
  if (mode === "local" && !url.startsWith("file:")) {
    throw new Error(
      'APP_MODE=local requires DATABASE_URL to use SQLite (url must start with "file:").',
    );
  }
}

assertDatabaseUrlForAppMode();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
