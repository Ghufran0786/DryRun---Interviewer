import { isHostedMode } from "@/lib/appMode";
import { prisma } from "@/lib/db";
import type { Prisma, Session } from "@prisma/client";
import "server-only";

const LOCAL_USER_ID = "local";

export function effectiveUserId(hostedUserId: string): string {
  return isHostedMode() ? hostedUserId : LOCAL_USER_ID;
}

export async function findSessionForUser(
  sessionId: string,
  userId: string,
): Promise<Session | null> {
  const scopedUserId = effectiveUserId(userId);
  if (!isHostedMode()) {
    return prisma.session.findUnique({ where: { id: sessionId } });
  }
  return prisma.session.findFirst({
    where: { id: sessionId, userId: scopedUserId },
  });
}

export function sessionsForUserWhere(
  userId: string,
): Prisma.SessionWhereInput | undefined {
  if (!isHostedMode()) {
    return undefined;
  }
  return { userId: effectiveUserId(userId) };
}

export async function findSnapshotForUser(
  snapshotId: string,
  userId: string,
) {
  const scopedUserId = effectiveUserId(userId);
  if (!isHostedMode()) {
    return prisma.snapshot.findUnique({ where: { id: snapshotId } });
  }
  return prisma.snapshot.findFirst({
    where: {
      id: snapshotId,
      session: { userId: scopedUserId },
    },
  });
}
