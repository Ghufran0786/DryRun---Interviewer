import { deleteSessionById, isDeletableSessionId } from "@/lib/deleteSession";
import { prisma } from "@/lib/db";
import { isInterviewPhase } from "@/lib/interviewPhases";
import { isSessionStatus } from "@/lib/validation";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return NextResponse.json(session);
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const existing = await prisma.session.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
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
  const data: {
    status?: string;
    startedAt?: Date;
    endedAt?: Date;
    verdict?: string;
    currentPhase?: string;
    reconnectCount?: number;
    closeCodesJson?: string | null;
  } = {};

  if (typeof record.status === "string") {
    if (!isSessionStatus(record.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    data.status = record.status;
    if (record.status === "completed") {
      data.endedAt = new Date();
    }
    if (record.status === "active" && !existing.startedAt) {
      data.startedAt = new Date();
    }
  }

  if (typeof record.verdict === "string") {
    data.verdict = record.verdict.slice(0, 500);
  }

  if (record.reconnectCount !== undefined) {
    if (
      typeof record.reconnectCount !== "number" ||
      !Number.isInteger(record.reconnectCount) ||
      record.reconnectCount < 0 ||
      record.reconnectCount > 1000
    ) {
      return NextResponse.json(
        { error: "Invalid reconnectCount" },
        { status: 400 },
      );
    }
    data.reconnectCount = record.reconnectCount;
  }

  if (record.closeCodesJson !== undefined) {
    if (record.closeCodesJson === null) {
      data.closeCodesJson = null;
    } else if (Array.isArray(record.closeCodesJson)) {
      const codes = record.closeCodesJson.filter(
        (code): code is number =>
          typeof code === "number" && Number.isInteger(code),
      );
      if (codes.length > 50) {
        return NextResponse.json(
          { error: "Invalid closeCodesJson" },
          { status: 400 },
        );
      }
      data.closeCodesJson = JSON.stringify(codes);
    } else {
      return NextResponse.json(
        { error: "Invalid closeCodesJson" },
        { status: 400 },
      );
    }
  }

  if (record.currentPhase !== undefined) {
    if (!isInterviewPhase(record.currentPhase)) {
      return NextResponse.json(
        { error: "Invalid currentPhase" },
        { status: 400 },
      );
    }
    if (
      existing.currentPhase === "wrapup" &&
      record.currentPhase !== "wrapup"
    ) {
      return NextResponse.json(
        { error: "Wrap-up phase is terminal" },
        { status: 409 },
      );
    }
    data.currentPhase = record.currentPhase;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const session = await prisma.$transaction(async (tx) => {
    const updated = await tx.session.update({
      where: { id },
      data,
    });
    if (
      data.currentPhase &&
      data.currentPhase !== existing.currentPhase
    ) {
      const tsMs = updated.startedAt
        ? Math.max(0, Date.now() - updated.startedAt.getTime())
        : 0;
      await tx.transcriptEntry.create({
        data: {
          sessionId: id,
          role: "system",
          kind: "phase_advance",
          text: `Phase manually changed from ${existing.currentPhase} to ${data.currentPhase}.`,
          tsMs,
          suppressed: false,
        },
      });
    }
    return updated;
  });

  return NextResponse.json(session);
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!isDeletableSessionId(id)) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const deleted = await deleteSessionById(id);
  if (!deleted) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
