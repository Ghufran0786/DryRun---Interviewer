import "server-only";

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL is not configured.");
  }
  return url;
}

export function getSupabaseAnonKey(): string {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error("SUPABASE_ANON_KEY is not configured.");
  }
  return key;
}

export function getDryRunOwnerUserId(): string {
  const id = process.env.DRYRUN_OWNER_USER_ID;
  if (!id) {
    throw new Error("DRYRUN_OWNER_USER_ID is not configured.");
  }
  return id;
}

export function getDryRunOwnerEmail(): string {
  const email = process.env.OWNER_EMAIL?.trim().toLowerCase();
  if (!email) {
    throw new Error("OWNER_EMAIL is not configured.");
  }
  return email;
}
