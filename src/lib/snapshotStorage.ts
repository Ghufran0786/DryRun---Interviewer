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

export async function writeSnapshotPng(
  sessionId: string,
  pngBuffer: Buffer,
  capturedAt: Date,
): Promise<string> {
  assertValidSessionId(sessionId);
  const fileName = `${colonSafeIso(capturedAt)}.png`;
  const relativePath = snapshotRelativePath(sessionId, fileName);
  const absolutePath = snapshotAbsolutePath(relativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, pngBuffer);
  return relativePath;
}

export const SNAPSHOT_TRIGGERS = ["auto", "manual", "final"] as const;
export type SnapshotTrigger = (typeof SNAPSHOT_TRIGGERS)[number];

export function isSnapshotTrigger(value: string): value is SnapshotTrigger {
  return (SNAPSHOT_TRIGGERS as readonly string[]).includes(value);
}
