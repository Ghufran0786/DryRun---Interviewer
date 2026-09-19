import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema =
  process.env.PRISMA_SCHEMA?.trim() || "prisma/schema.prisma";

const subcommand = process.argv[2] ?? "generate";
const prismaArgs = [subcommand, "--schema", schema, ...process.argv.slice(3)];

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  cwd: root,
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
