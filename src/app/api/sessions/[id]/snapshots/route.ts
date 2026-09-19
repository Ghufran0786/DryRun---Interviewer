import { prisma } from "@/lib/db";
import { parseElementsJson } from "@/lib/excalidrawElement";
import {
  isSnapshotTrigger,
  putSnapshotPng,
} from "@/lib/snapshotStorage";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const MAX_PNG_BYTES = 20 * 1024 * 1024;

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const snapshots = await prisma.snapshot.findMany({
    where: { sessionId: id },
    orderBy: { capturedAt: "asc" },
    select: {
      id: true,
      capturedAt: true,
      trigger: true,
      pngPath: true,
      elementsJson: true,
    },
  });

  return NextResponse.json(snapshots);
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status === "completed") {
    return NextResponse.json(
      { error: "Cannot snapshot completed session" },
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
  const trigger = typeof record.trigger === "string" ? record.trigger : "";
  if (!isSnapshotTrigger(trigger)) {
    return NextResponse.json({ error: "Invalid trigger" }, { status: 400 });
  }

  if (typeof record.pngBase64 !== "string" || record.pngBase64.length === 0) {
    return NextResponse.json({ error: "pngBase64 required" }, { status: 400 });
  }

  if (typeof record.elementsJson !== "string" || record.elementsJson.length === 0) {
    return NextResponse.json({ error: "elementsJson required" }, { status: 400 });
  }

  let elementsParsed: unknown;
  try {
    elementsParsed = JSON.parse(record.elementsJson);
  } catch {
    return NextResponse.json({ error: "Invalid elementsJson" }, { status: 400 });
  }
  if (!Array.isArray(elementsParsed)) {
    return NextResponse.json({ error: "elementsJson must be an array" }, { status: 400 });
  }

  let pngBuffer: Buffer;
  try {
    pngBuffer = Buffer.from(record.pngBase64, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid pngBase64" }, { status: 400 });
  }

  if (pngBuffer.length === 0 || pngBuffer.length > MAX_PNG_BYTES) {
    return NextResponse.json({ error: "PNG out of size bounds" }, { status: 413 });
  }

  const capturedAt = new Date();
  const snapshotId = randomUUID();
  let pngPath: string;
  try {
    const stored = await putSnapshotPng(id, snapshotId, pngBuffer);
    pngPath = stored.key;
  } catch {
    return NextResponse.json({ error: "Failed to store PNG" }, { status: 500 });
  }

  const snapshot = await prisma.snapshot.create({
    data: {
      id: snapshotId,
      sessionId: id,
      capturedAt,
      pngPath,
      elementsJson: record.elementsJson,
      trigger,
    },
  });

  const elementCount = parseElementsJson(record.elementsJson).length;

  return NextResponse.json(
    {
      id: snapshot.id,
      capturedAt: snapshot.capturedAt.toISOString(),
      trigger: snapshot.trigger,
      elementCount,
    },
    { status: 201 },
  );
}
