import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextBin = require.resolve("next/dist/bin/next");
const proxyScript = path.join(root, "scripts", "deepgram-proxy.mjs");
const mode = process.argv[2] === "start" ? "start" : "dev";

const children = [
  spawn(process.execPath, [nextBin, mode], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  }),
  spawn(process.execPath, [proxyScript], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  }),
];

let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exitCode = exitCode;
}

for (const child of children) {
  child.on("error", (error) => {
    console.error("Local service failed to start:", error.message);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    if (!shuttingDown) {
      console.error(
        `Local service exited unexpectedly (code=${code}, signal=${signal}).`,
      );
      shutdown(code ?? 1);
    }
  });
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
