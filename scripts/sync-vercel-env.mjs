/**
 * Pushes required production env vars from .env to Vercel (values never logged).
 * Usage: node scripts/sync-vercel-env.mjs
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keys = [
  "APP_MODE",
  "DATABASE_URL",
  "DIRECT_URL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SNAPSHOT_BUCKET",
  "DEEPGRAM_API_KEY",
  "OPENROUTER_API_KEY",
  "DEEPGRAM_TRANSPORT",
];

const lines = readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/);
const env = new Map();
for (const line of lines) {
  if (!line || line.startsWith("#")) continue;
  const i = line.indexOf("=");
  if (i < 1) continue;
  env.set(line.slice(0, i), line.slice(i + 1).trim().replace(/^["']|["']$/g, ""));
}

let failed = false;
for (const key of keys) {
  const value = env.get(key);
  if (!value) {
    console.error(`Missing ${key} in .env`);
    failed = true;
    continue;
  }
  if (/YOUR_|YOUR-|xxxx|\[YOUR/i.test(value)) {
    console.error(`${key} still contains a placeholder; fix .env first.`);
    failed = true;
    continue;
  }
  const result = spawnSync("npx", ["vercel", "env", "add", key, "production", "--force"], {
    cwd: root,
    input: value,
    encoding: "utf8",
    shell: true,
    stdio: ["pipe", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    console.error(`Failed to set ${key} on Vercel (exit ${result.status ?? 1}).`);
    failed = true;
  } else {
    console.log(`Set ${key} on Vercel (production).`);
  }
}

process.exit(failed ? 1 : 0);
