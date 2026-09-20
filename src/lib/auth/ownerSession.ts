import { isHostedMode } from "@/lib/appMode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDryRunOwnerUserId } from "@/lib/supabase/env";
import type { ChromeAuth } from "@/lib/auth/types";
import "server-only";

/** Cookie session only — no Auth server round-trip (use after proxy refresh on navigations). */
export async function getOwnerIdFromSession(): Promise<string | null> {
  if (!isHostedMode()) {
    return "local";
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;
  if (!user) {
    return null;
  }

  try {
    if (user.id !== getDryRunOwnerUserId()) {
      return null;
    }
    return user.id;
  } catch {
    return null;
  }
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
