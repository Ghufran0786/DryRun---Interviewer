import { getDryRunOwnerUserId } from "@/lib/supabase/env";
import type { SupabaseClient } from "@supabase/supabase-js";
import "server-only";

export type VerifiedOwnerResult =
  | { ok: true; userId: string }
  | { ok: false; reason: "unauthenticated" | "forbidden" };

/**
 * Verifies the access JWT via getClaims() (JWKS, cached). Refreshes the session
 * only when claims are missing or expired, then re-verifies.
 */
export async function resolveVerifiedOwnerUserId(
  supabase: SupabaseClient,
): Promise<VerifiedOwnerResult> {
  const ownerId = getDryRunOwnerUserId();

  const first = await supabase.auth.getClaims();
  let claims = first.data?.claims;

  if (first.error || !claims?.sub) {
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      return { ok: false, reason: "unauthenticated" };
    }

    const afterRefresh = await supabase.auth.getClaims(
      sessionData.session.access_token,
    );
    if (afterRefresh.error || !afterRefresh.data?.claims?.sub) {
      return { ok: false, reason: "unauthenticated" };
    }
    claims = afterRefresh.data.claims;
  }

  const sub = claims.sub;
  if (typeof sub !== "string" || sub.length === 0) {
    return { ok: false, reason: "unauthenticated" };
  }
  if (sub !== ownerId) {
    return { ok: false, reason: "forbidden" };
  }

  return { ok: true, userId: sub };
}
