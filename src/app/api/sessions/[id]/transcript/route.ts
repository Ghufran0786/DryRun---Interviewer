import { prisma } from "@/lib/db";
import { TRANSCRIPT_ROLES } from "@/lib/types";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

function validId(id: string): boolean {
  return id.length > 0 && id.length <= 64 && /^[a-z0-9]+$/i.test(id);
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const entries = await prisma.transcriptEntry.findMany({
    where: { sessionId: id },
    orderBy: [{ tsMs: "asc" }, { createdAt: "asc" }],
  });
  return NextResponse.json(entries);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!validId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "completed") {
    return NextResponse.json(
      { error: "Cannot append to a completed session" },
      { status: 409 },
    );
  }

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
  const role = typeof record.role === "string" ? record.role : "";
  const text = typeof record.text === "string" ? record.text.trim() : "";
  const tsMs = record.tsMs;
  const suppressed = record.suppressed;

  if (!(TRANSCRIPT_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (text.length === 0 || text.length > 10_000) {
    return NextResponse.json({ error: "Invalid text" }, { status: 400 });
  }
  if (
    typeof tsMs !== "number" ||
    !Number.isSafeInteger(tsMs) ||
    tsMs < 0 ||
    tsMs > 86_400_000
  ) {
    return NextResponse.json({ error: "Invalid tsMs" }, { status: 400 });
  }
  if (typeof suppressed !== "boolean") {
    return NextResponse.json({ error: "Invalid suppressed" }, { status: 400 });
  }

  const entry = await prisma.transcriptEntry.create({
    data: {
      sessionId: id,
      role,
      text,
      tsMs,
      suppressed,
    },
  });
  return NextResponse.json(entry, { status: 201 });
}
