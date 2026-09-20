import { isHostedMode } from "@/lib/appMode";
import { resolveVerifiedOwnerUserId } from "@/lib/auth/verifiedOwner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ChromeAuth } from "@/lib/auth/types";
import "server-only";

/** Hosted: JWT verified via getClaims(); local: synthetic `local` id. */
export async function getOwnerIdFromSession(): Promise<string | null> {
  if (!isHostedMode()) {
    return "local";
  }

  const supabase = await createSupabaseServerClient();
  const verified = await resolveVerifiedOwnerUserId(supabase);
  if (!verified.ok) {
    return null;
  }
  return verified.userId;
}

export async function getChromeAuth(): Promise<ChromeAuth> {
  if (!isHostedMode()) {
    return { mode: "local", signedIn: true };
  }

  const ownerId = await getOwnerIdFromSession();
  return {
    mode: "hosted",
    signedIn: ownerId !== null,
  };
}
