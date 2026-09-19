import { prisma } from "@/lib/db";
import { assertValidSessionId, snapshotAbsolutePath } from "@/lib/snapshotStorage";
import fs from "node:fs/promises";
import path from "node:path";

export function isDeletableSessionId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && /^[a-z0-9]+$/i.test(id);
}

export async function deleteSessionById(sessionId: string): Promise<boolean> {
  if (!isDeletableSessionId(sessionId)) {
    return false;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { snapshots: { select: { pngPath: true } } },
  });
  if (!session) {
    return false;
  }

  for (const snapshot of session.snapshots) {
    try {
      await fs.unlink(snapshotAbsolutePath(snapshot.pngPath));
    } catch {
      // PNG may already be missing on disk.
    }
  }

  try {
    assertValidSessionId(sessionId);
    const snapshotDir = path.join(
      process.cwd(),
      "data",
      "snapshots",
      sessionId,
    );
    await fs.rm(snapshotDir, { recursive: true, force: true });
  } catch {
    // Best-effort directory cleanup.
  }

  await prisma.session.delete({ where: { id: sessionId } });
  return true;
}
