import { requireUser } from "@/lib/auth/requireUser";
import { getChromeAuth } from "@/lib/auth/ownerSession";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireUser();
  if (auth instanceof NextResponse) {
    return auth;
  }

  const chromeAuth = await getChromeAuth();
  return NextResponse.json(chromeAuth, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
