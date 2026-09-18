import { prisma } from "@/lib/db";
import { serializeScenePayload, validateSceneBody } from "@/lib/scenePayload";
import { NextResponse } from "next/server";

type RouteContext = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: RouteContext) {
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
      { error: "Cannot modify scene of completed session" },
      { status: 409 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = validateSceneBody(body);
  if (!payload) {
    return NextResponse.json({ error: "Invalid scene payload" }, { status: 400 });
  }

  const sceneJson = serializeScenePayload(payload);
  if (sceneJson.length > 5_000_000) {
    return NextResponse.json({ error: "Scene too large" }, { status: 413 });
  }

  const updated = await prisma.session.update({
    where: { id },
    data: { sceneJson },
  });

  return NextResponse.json({ ok: true, updatedAt: updated.createdAt });
}
