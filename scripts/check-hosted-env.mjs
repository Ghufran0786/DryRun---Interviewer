import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lines = readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/);
const env = new Map();
for (const line of lines) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 1) continue;
  env.set(line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, ""));
}

const required = [
  "APP_MODE",
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SNAPSHOT_BUCKET",
  "DRYRUN_OWNER_USER_ID",
  "OWNER_EMAIL",
  "DEEPGRAM_API_KEY",
  "OPENROUTER_API_KEY",
];

const checks = {};
for (const key of required) {
  const v = env.get(key) ?? "";
  checks[key] = v.length > 0;
}
checks.postgresUrl = (env.get("DATABASE_URL") ?? "").startsWith("postgres");
checks.appModeHosted = env.get("APP_MODE") === "hosted";

const ok = required.every((k) => checks[k]) && checks.postgresUrl && checks.appModeHosted;
console.log(JSON.stringify({ ok, checks }));
process.exit(ok ? 0 : 1);
