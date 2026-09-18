import type { StoredEvaluation } from "@/components/report/EvaluationReport";

export function parseStoredEvaluation(
  evaluationJson: string | null,
): StoredEvaluation | null {
  if (!evaluationJson) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(evaluationJson);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.error === "string") {
      return {
        error: record.error,
        rawText:
          typeof record.rawText === "string" ? record.rawText : undefined,
      } as StoredEvaluation;
    }
    if (
      typeof record.verdict !== "string" ||
      typeof record.weightedScore !== "number" ||
      typeof record.evaluatedAt !== "string"
    ) {
      return null;
    }
    return record as StoredEvaluation;
  } catch {
    return null;
  }
}
