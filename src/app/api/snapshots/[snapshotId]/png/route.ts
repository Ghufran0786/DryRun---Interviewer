import { requireUser } from "@/lib/auth/requireUser";
import { findSnapshotForUser } from "@/lib/sessionScope";
import { readSnapshotPng } from "@/lib/snapshotStorage";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ snapshotId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const auth = await requireUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { snapshotId } = await context.params;
  if (!snapshotId || snapshotId.length > 64) {
    return NextResponse.json({ error: "Invalid snapshot id" }, { status: 400 });
  }

  const snapshot = await findSnapshotForUser(snapshotId, auth.userId);
  if (!snapshot) {
    return NextResponse.json({ error: "Snapshot not found" }, { status: 404 });
  }

  let file: Buffer;
  try {
    file = await readSnapshotPng(snapshot.pngPath);
  } catch {
    return NextResponse.json({ error: "PNG file missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
