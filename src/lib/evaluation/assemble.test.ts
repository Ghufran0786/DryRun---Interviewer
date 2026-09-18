import assert from "node:assert/strict";
import test from "node:test";
import { computeStats, selectSnapshots } from "./assemble";

const session = {
  problem: "Design LeetCode",
  targetLevel: "SDE-2",
  startedAt: new Date("2026-01-01T00:00:00.000Z"),
  endedAt: new Date("2026-01-01T00:12:00.000Z"),
  reconnectCount: 2,
  closeCodesJson: "[1000,1006]",
  phaseNotesJson: JSON.stringify(["requirements complete"]),
};

test("computeStats aggregates interview metrics", () => {
  const stats = computeStats(
    [
      {
        id: "1",
        role: "candidate",
        kind: null,
        text: "We need low latency and high availability",
        tsMs: 30_000,
        suppressed: false,
      },
      {
        id: "2",
        role: "interviewer",
        kind: "nudge",
        text: "What about scale?",
        tsMs: 90_000,
        suppressed: false,
      },
      {
        id: "3",
        role: "candidate",
        kind: null,
        text: "ignored",
        tsMs: 120_000,
        suppressed: true,
      },
      {
        id: "4",
        role: "system",
        kind: "phase_advance",
        text: "Phase advanced from requirements to hld.",
        tsMs: 300_000,
        suppressed: false,
      },
    ],
    session,
  );
  assert.equal(stats.candidateWords, 7);
  assert.equal(stats.interviewerTurns, 1);
  assert.equal(stats.nudgeCount, 1);
  assert.equal(stats.suppressedCount, 1);
  assert.equal(stats.reconnectCount, 2);
  assert.deepEqual(stats.closeCodes, [1000, 1006]);
  assert.ok(stats.phaseTimeline.length >= 1);
});

test("selectSnapshots picks final and phase-boundary neighbors", () => {
  const snapshots = selectSnapshots(
    [
      {
        id: "snap-a",
        capturedAt: new Date("2026-01-01T00:02:00.000Z"),
        pngPath: "data/snapshots/s1/a.png",
        elementsJson: "[]",
        trigger: "auto",
      },
      {
        id: "snap-b",
        capturedAt: new Date("2026-01-01T00:05:00.000Z"),
        pngPath: "data/snapshots/s1/b.png",
        elementsJson: "[]",
        trigger: "manual",
      },
      {
        id: "snap-final",
        capturedAt: new Date("2026-01-01T00:11:00.000Z"),
        pngPath: "data/snapshots/s1/final.png",
        elementsJson: "[]",
        trigger: "final",
      },
    ],
    [
      {
        id: "adv-hld",
        role: "system",
        kind: "phase_advance",
        text: "Phase advanced from api to hld.",
        tsMs: 300_000,
        suppressed: false,
      },
      {
        id: "adv-deep",
        role: "system",
        kind: "phase_advance",
        text: "Phase manually changed from hld to deepdive.",
        tsMs: 600_000,
        suppressed: false,
      },
    ],
    new Date("2026-01-01T00:00:00.000Z"),
  );
  assert.equal(snapshots[0]?.id, "snap-final");
  assert.ok(snapshots.some((snapshot) => snapshot.id === "snap-b"));
  assert.ok(snapshots.length <= 3);
});
