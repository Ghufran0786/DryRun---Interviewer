import { isHostedMode } from "@/lib/appMode";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "node:fs/promises";
import path from "node:path";

const SESSION_ID_PATTERN = /^[a-z][a-z0-9]{15,35}$/i;

export function assertValidSessionId(sessionId: string): void {
  if (!SESSION_ID_PATTERN.test(sessionId)) {
    throw new Error("Invalid session id");
  }
}

export function colonSafeIso(date: Date): string {
  return date.toISOString().replace(/:/g, "-");
}

export function snapshotRelativePath(sessionId: string, fileName: string): string {
  return path.join("data", "snapshots", sessionId, fileName).replace(/\\/g, "/");
}

/** @deprecated Use readSnapshotPng; kept for path validation on legacy keys. */
export function snapshotAbsolutePath(relativePngPath: string): string {
  const normalized = relativePngPath.replace(/\\/g, "/");
  if (
    normalized.includes("..") ||
    !normalized.startsWith("data/snapshots/")
  ) {
    throw new Error("Invalid snapshot path");
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), normalized);
}

function hostedObjectKey(sessionId: string, snapshotId: string): string {
  return `${sessionId}/${snapshotId}.png`;
}

let supabaseAdmin: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_SNAPSHOT_BUCKET;
  if (!url || !serviceKey || !bucket) {
    throw new Error(
      "Hosted snapshot storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and SUPABASE_SNAPSHOT_BUCKET.",
    );
  }
  supabaseAdmin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return supabaseAdmin;
}

function snapshotBucket(): string {
  const bucket = process.env.SUPABASE_SNAPSHOT_BUCKET;
  if (!bucket) {
    throw new Error("SUPABASE_SNAPSHOT_BUCKET is not configured.");
  }
  return bucket;
}

export async function putSnapshotPng(
  sessionId: string,
  snapshotId: string,
  buffer: Buffer,
): Promise<{ key: string }> {
  assertValidSessionId(sessionId);
  if (!snapshotId || snapshotId.length > 64) {
    throw new Error("Invalid snapshot id");
  }

  if (isHostedMode()) {
    const key = hostedObjectKey(sessionId, snapshotId);
    const client = getSupabaseAdmin();
    const { error } = await client.storage
      .from(snapshotBucket())
      .upload(key, buffer, {
        contentType: "image/png",
        upsert: true,
      });
    if (error) {
      throw new Error(error.message);
    }
    return { key };
  }

  const fileName = `${colonSafeIso(new Date())}.png`;
  const key = snapshotRelativePath(sessionId, fileName);
  const absolutePath = snapshotAbsolutePath(key);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, buffer);
  return { key };
}

export async function readSnapshotPng(key: string): Promise<Buffer> {
  if (isHostedMode()) {
    const client = getSupabaseAdmin();
    const { data, error } = await client.storage
      .from(snapshotBucket())
      .download(key);
    if (error || !data) {
      throw new Error(error?.message ?? "Snapshot object missing");
    }
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  const absolutePath = snapshotAbsolutePath(key);
  return fs.readFile(absolutePath);
}

export async function deleteSessionSnapshots(sessionId: string): Promise<void> {
  assertValidSessionId(sessionId);

  if (isHostedMode()) {
    const client = getSupabaseAdmin();
    const bucket = snapshotBucket();
    const prefix = `${sessionId}/`;
    const { data: listed, error: listError } = await client.storage
      .from(bucket)
      .list(sessionId, { limit: 1000 });
    if (listError) {
      throw new Error(listError.message);
    }
    if (!listed || listed.length === 0) {
      return;
    }
    const paths = listed
      .filter((item) => item.name.endsWith(".png"))
      .map((item) => `${prefix}${item.name}`);
    if (paths.length === 0) {
      return;
    }
    const { error: removeError } = await client.storage.from(bucket).remove(paths);
    if (removeError) {
      throw new Error(removeError.message);
    }
    return;
  }

  const snapshotDir = path.join(process.cwd(), "data", "snapshots", sessionId);
  await fs.rm(snapshotDir, { recursive: true, force: true });
}

export const SNAPSHOT_TRIGGERS = ["auto", "manual", "final"] as const;
export type SnapshotTrigger = (typeof SNAPSHOT_TRIGGERS)[number];

export function isSnapshotTrigger(value: string): value is SnapshotTrigger {
  return (SNAPSHOT_TRIGGERS as readonly string[]).includes(value);
}
