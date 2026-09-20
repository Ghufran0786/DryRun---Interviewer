import { getOwnerIdFromSession } from "@/lib/auth/ownerSession";
import { assertSameOrigin } from "@/lib/auth/sameOrigin";
import { isHostedMode } from "@/lib/appMode";
import { NextResponse } from "next/server";
import "server-only";

export type UserContext = {
  userId: string;
};

/** Hosted: valid Supabase session for the configured owner. Local: synthetic `local` id. */
export async function requireUser(
  request?: Request,
): Promise<UserContext | NextResponse> {
  if (!isHostedMode()) {
    return { userId: "local" };
  }

  if (request) {
    const originDenied = assertSameOrigin(request);
    if (originDenied) {
      return originDenied;
    }
  }

  const userId = await getOwnerIdFromSession();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return { userId };
}
