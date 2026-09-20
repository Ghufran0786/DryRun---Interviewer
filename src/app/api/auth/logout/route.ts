import { assertSameOrigin } from "@/lib/auth/sameOrigin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isHostedMode } from "@/lib/appMode";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isHostedMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originDenied = assertSameOrigin(request);
  if (originDenied) {
    return originDenied;
  }

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
