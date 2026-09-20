/**
 * After hosted migration: assign existing Session rows to DRYRUN_OWNER_USER_ID.
 * Never logs secrets.
 */
import { PrismaClient } from "@prisma/client";

const ownerId = process.env.DRYRUN_OWNER_USER_ID?.trim();
if (!ownerId) {
  console.log("backfill-session-user-id: skip (DRYRUN_OWNER_USER_ID unset)");
  process.exit(0);
}

const prisma = new PrismaClient();
try {
  const result = await prisma.session.updateMany({
    where: { userId: "pending" },
    data: { userId: ownerId },
  });
  console.log(
    `backfill-session-user-id: updated ${result.count} session row(s)`,
  );
} finally {
  await prisma.$disconnect();
}
