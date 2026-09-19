import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(label, command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: true,
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
run("next build", "npx", ["next", "build"]);
