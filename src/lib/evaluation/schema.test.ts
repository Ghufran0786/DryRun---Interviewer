import assert from "node:assert/strict";
import test from "node:test";
import { validate } from "./schema";

const validFixture = {
  rubricVersion: "v1",
  scores: [
    {
      dimension: "requirements",
      score: 3,
      evidence: ["[01:02] listed core FRs"],
      improvement: "Prioritize NFRs",
    },
    {
      dimension: "estimation",
      score: 2,
      evidence: ["[05:10] gave QPS estimate"],
      improvement: "Use numbers in decisions",
    },
    {
      dimension: "api_data",
      score: 3,
      evidence: ["[08:00] defined entities"],
      improvement: "Defend indexes",
    },
    {
      dimension: "hld",
      score: 3,
      evidence: ["[snapshot:abc123] layered diagram"],
      improvement: "Label arrows",
    },
    {
      dimension: "deepdive",
      score: 2,
      evidence: ["[12:30] discussed cache"],
      improvement: "Go deeper on failures",
    },
    {
      dimension: "tradeoffs",
      score: 3,
      evidence: ["[14:00] compared SQL vs NoSQL"],
      improvement: "Quantify trade-offs",
    },
    {
      dimension: "communication",
      score: 3,
      evidence: ["[02:00] drove requirements"],
      improvement: "Time-box phases",
    },
    {
      dimension: "whiteboard",
      score: 2,
      evidence: ["[snapshot:abc123] partial labels"],
      improvement: "Add component names",
    },
  ],
  verdict: "Hire",
  verdictRationale: "Solid structure with room to deepen.",
  levelEstimate: "SDE-2",
  wouldPass: "Yes at SDE-2 with coaching on depth.",
  strengths: ["Structured", "Clear API", "Good trade-offs"],
  gaps: ["Estimation", "Depth", "Board labels"],
  actionItems: ["Practice sizing", "Deep dive one bottleneck", "Label boards"],
  phaseAnalysis: [
    { phase: "Requirements", minutes: 8, assessment: "Solid start" },
  ],
};

test("validate accepts a complete fixture", () => {
  const result = validate(validFixture);
  assert.equal(result.ok, true);
});

test("validate rejects missing evidence", () => {
  const broken = {
    ...validFixture,
    scores: validFixture.scores.map((score, index) =>
      index === 0 ? { ...score, evidence: [] } : score,
    ),
  };
  const result = validate(broken);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("evidence")));
  }
});

test("validate rejects wrong dimension key", () => {
  const broken = {
    ...validFixture,
    scores: validFixture.scores.map((score, index) =>
      index === 0 ? { ...score, dimension: "not_real" } : score,
    ),
  };
  const result = validate(broken);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.errors.some((error) => error.includes("dimension")));
  }
});
