import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseUrl } from "@/lib/supabase/env";
import "server-only";

let authAdmin: SupabaseClient | null = null;

export function getSupabaseAuthAdmin(): SupabaseClient {
  if (authAdmin) {
    return authAdmin;
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured.");
  }
  authAdmin = createClient(getSupabaseUrl(), serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return authAdmin;
}
