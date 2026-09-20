import { assertSameOrigin } from "@/lib/auth/sameOrigin";
import {
  clientIpFromRequest,
  enforceRateLimit,
} from "@/lib/rateLimit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isHostedMode } from "@/lib/appMode";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  if (!isHostedMode()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originDenied = assertSameOrigin(request);
  if (originDenied) {
    return originDenied;
  }

  const ip = clientIpFromRequest(request);
  const limited = await enforceRateLimit(
    `login:${ip}`,
    LOGIN_LIMIT,
    LOGIN_WINDOW_MS,
  );
  if (limited) {
    return limited;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const record = body as Record<string, unknown>;
  const email =
    typeof record.email === "string" ? record.email.trim().slice(0, 320) : "";
  const password =
    typeof record.password === "string" ? record.password.slice(0, 256) : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
