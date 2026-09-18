/**
 * Canonical session clock. `startedAtMs` comes from Session.startedAt (server).
 * Phase 3 transcript `tsMs` = elapsedMsSinceSessionStart(startedAtMs).
 */
export function elapsedMsSinceSessionStart(
  startedAtMs: number,
  nowMs: number = Date.now(),
): number {
  return Math.max(0, nowMs - startedAtMs);
}
