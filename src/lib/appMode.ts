export type AppMode = "local" | "hosted";

export function getAppMode(): AppMode {
  const raw = process.env.APP_MODE;
  if (raw === undefined || raw === "" || raw === "local") {
    return "local";
  }
  if (raw === "hosted") {
    return "hosted";
  }
  throw new Error(`Invalid APP_MODE "${raw}" (expected "local" or "hosted")`);
}

export function isHostedMode(): boolean {
  return getAppMode() === "hosted";
}
