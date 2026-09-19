export const INTERVIEW_PHASES = [
  "requirements",
  "estimation",
  "api",
  "hld",
  "deepdive",
  "wrapup",
] as const;

export type InterviewPhase = (typeof INTERVIEW_PHASES)[number];

export const PHASE_LABELS: Record<InterviewPhase, string> = {
  requirements: "Requirements",
  estimation: "Estimation",
  api: "API",
  hld: "High-level design",
  deepdive: "Deep dive",
  wrapup: "Wrap-up",
};

export const BASE_PHASE_BUDGETS: Record<InterviewPhase, number> = {
  requirements: 5,
  estimation: 5,
  api: 5,
  hld: 12,
  deepdive: 12,
  wrapup: 5,
};

export function isInterviewPhase(value: unknown): value is InterviewPhase {
  return (
    typeof value === "string" &&
    (INTERVIEW_PHASES as readonly string[]).includes(value)
  );
}

export function nextInterviewPhase(
  phase: InterviewPhase,
): InterviewPhase | null {
  const index = INTERVIEW_PHASES.indexOf(phase);
  if (index < 0 || index >= INTERVIEW_PHASES.length - 1) {
    return null;
  }
  return INTERVIEW_PHASES[index + 1];
}

export function scaledPhaseBudgets(durationMin: number): string {
  const baseTotal = Object.values(BASE_PHASE_BUDGETS).reduce(
    (sum, minutes) => sum + minutes,
    0,
  );
  const scale = durationMin / baseTotal;
  return INTERVIEW_PHASES.map(
    (phase) =>
      `${PHASE_LABELS[phase]} ${Math.max(1, Math.round(BASE_PHASE_BUDGETS[phase] * scale))}m`,
  ).join(", ");
}
