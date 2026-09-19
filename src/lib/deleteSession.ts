import { prisma } from "@/lib/db";
import {
  assertValidSessionId,
  deleteSessionSnapshots,
} from "@/lib/snapshotStorage";

export function isDeletableSessionId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && /^[a-z0-9]+$/i.test(id);
}

export async function deleteSessionById(sessionId: string): Promise<boolean> {
  if (!isDeletableSessionId(sessionId)) {
    return false;
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) {
    return false;
  }

  try {
    assertValidSessionId(sessionId);
    await deleteSessionSnapshots(sessionId);
  } catch {
    // Best-effort snapshot cleanup.
  }

  await prisma.session.delete({ where: { id: sessionId } });
  return true;
}
