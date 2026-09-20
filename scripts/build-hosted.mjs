import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command, args, extraEnv = {}, useShell = true) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: useShell,
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    console.error(`${label} failed with exit code ${result.status ?? 1}`);
    process.exit(result.status ?? 1);
  }
}

process.env.PRISMA_SCHEMA = "prisma/postgres/schema.prisma";

run("prisma:generate", "npm", ["run", "prisma:generate"]);
run("db:migrate:hosted", "npm", ["run", "db:migrate:hosted"]);
run(
  "backfill-session-owner",
  process.execPath,
  [path.join(root, "scripts", "backfill-session-owner.mjs")],
  {},
  false,
);
run("next build", "npx", ["next", "build"]);
