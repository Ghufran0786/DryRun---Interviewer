import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSec: number };

type MemoryBucket = {
  windowStartMs: number;
  count: number;
};

const memoryBuckets = new Map<string, MemoryBucket>();
const lastDbPersistMs = new Map<string, number>();
const DB_PERSIST_MIN_INTERVAL_MS = 60_000;

function memoryConsume(
  bucketKey: string,
  limit: number,
  windowMs: number,
  now: number,
): RateLimitResult {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const windowEndMs = windowStart + windowMs;
  const row = memoryBuckets.get(bucketKey);

  if (!row || row.windowStartMs !== windowStart) {
    memoryBuckets.set(bucketKey, { windowStartMs: windowStart, count: 1 });
    return { allowed: true };
  }

  if (row.count >= limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((windowEndMs - now) / 1000),
    );
    return { allowed: false, retryAfterSec };
  }

  row.count += 1;
  return { allowed: true };
}

async function persistBucketToDb(
  bucketKey: string,
  limit: number,
  windowMs: number,
  now: number,
): Promise<void> {
  const last = lastDbPersistMs.get(bucketKey) ?? 0;
  if (now - last < DB_PERSIST_MIN_INTERVAL_MS) {
    return;
  }
  lastDbPersistMs.set(bucketKey, now);

  const memory = memoryBuckets.get(bucketKey);
  if (!memory) {
    return;
  }

  const windowStart = new Date(memory.windowStartMs);
  try {
    await prisma.rateLimitBucket.upsert({
      where: { bucketKey },
      create: {
        bucketKey,
        windowStart,
        count: memory.count,
      },
      update: {
        windowStart,
        count: memory.count,
      },
    });
  } catch {
    // Best-effort daily accounting; hot path stays in-memory.
  }
}

export async function consumeRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const result = memoryConsume(bucketKey, limit, windowMs, now);
  if (result.allowed) {
    void persistBucketToDb(bucketKey, limit, windowMs, now);
  }
  return result;
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    },
  );
}

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) {
      return first.slice(0, 120);
    }
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp.trim().slice(0, 120);
  }
  return "unknown";
}

export async function enforceRateLimit(
  bucketKey: string,
  limit: number,
  windowMs: number,
): Promise<NextResponse | null> {
  const result = await consumeRateLimit(bucketKey, limit, windowMs);
  if (!result.allowed) {
    return rateLimitResponse(result.retryAfterSec);
  }
  return null;
}
