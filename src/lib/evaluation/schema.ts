import {
  RUBRIC_DIMENSIONS,
  type RubricDimensionKey,
} from "@/lib/evaluation/rubric";

export const EVALUATION_VERDICTS = [
  "Strong Hire",
  "Hire",
  "Lean Hire",
  "No Hire",
] as const;

export type EvaluationVerdict = (typeof EVALUATION_VERDICTS)[number];

export const LEVEL_ESTIMATES = ["SDE-1", "SDE-2", "Senior"] as const;

export type LevelEstimate = (typeof LEVEL_ESTIMATES)[number];

export type EvaluationScore = {
  dimension: RubricDimensionKey;
  score: number;
  evidence: string[];
  improvement: string;
};

export type EvaluationPayload = {
  rubricVersion: string;
  scores: EvaluationScore[];
  verdict: EvaluationVerdict;
  verdictRationale: string;
  levelEstimate: LevelEstimate;
  wouldPass: string;
  strengths: string[];
  gaps: string[];
  actionItems: string[];
  phaseAnalysis: Array<{ phase: string; minutes: number; assessment: string }>;
};

const DIMENSION_KEYS = new Set<RubricDimensionKey>(
  RUBRIC_DIMENSIONS.map((dimension) => dimension.key),
);

const EVIDENCE_PREFIX = /^\[(\d{2}:\d{2}|snapshot:[^\]]+)\]/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

export function validate(
  value: unknown,
): { ok: true; value: EvaluationPayload } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["root must be an object"] };
  }

  if (typeof value.rubricVersion !== "string" || value.rubricVersion.length === 0) {
    errors.push("rubricVersion must be a non-empty string");
  }

  if (!Array.isArray(value.scores) || value.scores.length !== RUBRIC_DIMENSIONS.length) {
    errors.push(`scores must contain exactly ${RUBRIC_DIMENSIONS.length} items`);
  } else {
    const seen = new Set<string>();
    for (const [index, score] of value.scores.entries()) {
      if (!isRecord(score)) {
        errors.push(`scores[${index}] must be an object`);
        continue;
      }
      if (
        typeof score.dimension !== "string" ||
        !DIMENSION_KEYS.has(score.dimension as RubricDimensionKey)
      ) {
        errors.push(`scores[${index}].dimension is invalid`);
      } else {
        seen.add(score.dimension);
      }
      if (
        typeof score.score !== "number" ||
        !Number.isInteger(score.score) ||
        score.score < 0 ||
        score.score > 4
      ) {
        errors.push(`scores[${index}].score must be an integer 0-4`);
      }
      if (!isStringArray(score.evidence) || score.evidence.length < 1) {
        errors.push(`scores[${index}].evidence must contain at least one item`);
      } else {
        for (const [evidenceIndex, evidence] of score.evidence.entries()) {
          if (!EVIDENCE_PREFIX.test(evidence)) {
            errors.push(
              `scores[${index}].evidence[${evidenceIndex}] must start with [mm:ss] or [snapshot:`,
            );
          }
        }
      }
      if (typeof score.improvement !== "string" || score.improvement.trim().length === 0) {
        errors.push(`scores[${index}].improvement must be a non-empty string`);
      }
    }
    for (const dimension of RUBRIC_DIMENSIONS) {
      if (!seen.has(dimension.key)) {
        errors.push(`missing score for dimension ${dimension.key}`);
      }
    }
  }

  if (
    typeof value.verdict !== "string" ||
    !(EVALUATION_VERDICTS as readonly string[]).includes(value.verdict)
  ) {
    errors.push("verdict must be Strong Hire, Hire, Lean Hire, or No Hire");
  }
  if (typeof value.verdictRationale !== "string" || value.verdictRationale.trim().length === 0) {
    errors.push("verdictRationale must be a non-empty string");
  }
  if (
    typeof value.levelEstimate !== "string" ||
    !(LEVEL_ESTIMATES as readonly string[]).includes(value.levelEstimate)
  ) {
    errors.push("levelEstimate must be SDE-1, SDE-2, or Senior");
  }
  if (typeof value.wouldPass !== "string" || value.wouldPass.trim().length === 0) {
    errors.push("wouldPass must be a non-empty string");
  }
  if (!isStringArray(value.strengths) || value.strengths.length < 3 || value.strengths.length > 5) {
    errors.push("strengths must contain 3-5 items");
  }
  if (!isStringArray(value.gaps) || value.gaps.length < 3 || value.gaps.length > 5) {
    errors.push("gaps must contain 3-5 items");
  }
  if (!isStringArray(value.actionItems) || value.actionItems.length !== 3) {
    errors.push("actionItems must contain exactly 3 items");
  }
  if (!Array.isArray(value.phaseAnalysis)) {
    errors.push("phaseAnalysis must be an array");
  } else {
    for (const [index, phase] of value.phaseAnalysis.entries()) {
      if (!isRecord(phase)) {
        errors.push(`phaseAnalysis[${index}] must be an object`);
        continue;
      }
      if (typeof phase.phase !== "string" || phase.phase.trim().length === 0) {
        errors.push(`phaseAnalysis[${index}].phase must be a non-empty string`);
      }
      if (typeof phase.minutes !== "number" || phase.minutes < 0) {
        errors.push(`phaseAnalysis[${index}].minutes must be a non-negative number`);
      }
      if (typeof phase.assessment !== "string" || phase.assessment.trim().length === 0) {
        errors.push(`phaseAnalysis[${index}].assessment must be a non-empty string`);
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value: value as EvaluationPayload };
}

export function computeWeightedScore(scores: EvaluationScore[]): number {
  const byDimension = new Map(scores.map((score) => [score.dimension, score.score]));
  let weightedSum = 0;
  let totalWeight = 0;
  for (const dimension of RUBRIC_DIMENSIONS) {
    const score = byDimension.get(dimension.key);
    if (score === undefined) {
      continue;
    }
    weightedSum += score * dimension.weight;
    totalWeight += dimension.weight;
  }
  if (totalWeight === 0) {
    return 0;
  }
  return Math.round((weightedSum / totalWeight) * 100) / 100;
}
