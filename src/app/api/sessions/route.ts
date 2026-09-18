import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isTargetLevel, parseNonEmptyString } from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET() {
  const sessions = await prisma.session.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(sessions);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const title = parseNonEmptyString(record.title, "title", 200);
  const problem =
    typeof record.problem === "string" && record.problem.trim().length > 0
      ? record.problem.trim().slice(0, 20_000)
      : "Design LeetCode";

  let targetLevel: string;
  if (typeof record.targetLevel === "string" && isTargetLevel(record.targetLevel)) {
    targetLevel = record.targetLevel;
  } else {
    const settings = await getSettings();
    targetLevel = isTargetLevel(settings.defaultTargetLevel)
      ? settings.defaultTargetLevel
      : "SDE-2";
  }

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  const now = new Date();
  const session = await prisma.session.create({
    data: {
      title,
      problem,
      targetLevel,
      status: "active",
      startedAt: now,
    },
  });

  return NextResponse.json(session, { status: 201 });
}
