import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export async function loadCompletedSessionReportContext(sessionId: string) {
  if (!sessionId || sessionId.length > 64) {
    return {
      error: NextResponse.json({ error: "Invalid session id" }, { status: 400 }),
    };
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return {
      error: NextResponse.json({ error: "Session not found" }, { status: 404 }),
    };
  }
  if (session.status !== "completed") {
    return {
      error: NextResponse.json(
        { error: "Report export is only available for completed sessions" },
        { status: 409 },
      ),
    };
  }

  const [settings, entries, snapshots] = await Promise.all([
    getSettings(),
    prisma.transcriptEntry.findMany({
      where: { sessionId },
      orderBy: [{ tsMs: "asc" }, { createdAt: "asc" }],
    }),
    prisma.snapshot.findMany({
      where: { sessionId },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  return { session, settings, entries, snapshots };
}
