/**
 * Scans .next/static for secret prefixes (6 chars). Never prints secrets.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadPrefix(name) {
  try {
    const text = readFileSync(path.join(root, ".env"), "utf8");
    const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
    if (!line) return "";
    const value = line
      .slice(name.length + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    return value.length >= 6 ? value.slice(0, 6) : "";
  } catch {
    return "";
  }
}

const needles = ["sk-or-v1", loadPrefix("DEEPGRAM_API_KEY")].filter(
  (n) => n.length >= 6,
);

const staticDir = path.join(root, ".next", "static");
const hits = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
      continue;
    }
    if (!/\.(js|css|json|txt|map)$/i.test(name)) continue;
    const text = readFileSync(full, "utf8");
    for (const needle of needles) {
      if (text.includes(needle)) {
        hits.push({ file: path.relative(root, full), needleLength: needle.length });
      }
    }
  }
}

try {
  walk(staticDir);
} catch {
  console.log(JSON.stringify({ ok: false, error: "missing .next/static — run build first" }));
  process.exit(1);
}

const serviceRoleHits = [];
function walkServiceRole(dir) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walkServiceRole(full);
      continue;
    }
    if (!/\.(js|css|json|txt|map)$/i.test(name)) continue;
    const text = readFileSync(full, "utf8");
    if (text.includes("service_role")) {
      serviceRoleHits.push(path.relative(root, full));
    }
  }
}
walkServiceRole(staticDir);

const ok = hits.length === 0 && serviceRoleHits.length === 0;
console.log(
  JSON.stringify({
    ok,
    prefixHitCount: hits.length,
    serviceRoleHitCount: serviceRoleHits.length,
  }),
);
process.exit(ok ? 0 : 1);
