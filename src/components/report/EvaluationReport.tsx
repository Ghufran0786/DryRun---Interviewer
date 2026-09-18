"use client";

import { Button } from "@/components/ui/Button";
import { RUBRIC_DIMENSIONS } from "@/lib/evaluation/rubric";
import type { EvaluationPayload } from "@/lib/evaluation/schema";
import type { InterviewStats } from "@/lib/evaluation/assemble";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";

export type StoredEvaluation = EvaluationPayload & {
  weightedScore: number;
  stats: InterviewStats;
  evaluatedAt: string;
  evaluatorModel: string;
  rubricVersion: string;
  error?: string;
  rawText?: string;
};

type EvaluationReportProps = {
  sessionId: string;
  sessionStatus: string;
  evaluation: StoredEvaluation | null;
  promptTokens: number;
  completionTokens: number;
};

function scoreBar(score: number) {
  const segments = Array.from({ length: 4 }, (_, index) => index + 1 <= score);
  return (
    <div className="flex gap-1" aria-label={`Score ${score} of 4`}>
      {segments.map((filled, index) => (
        <span
          key={index}
          className={`h-2 w-8 rounded-[2px] ${
            filled ? "bg-[#0A0A0A]" : "border border-[#0A0A0A] bg-white"
          }`}
        />
      ))}
    </div>
  );
}

export function EvaluationReport({
  sessionId,
  sessionStatus,
  evaluation,
  promptTokens,
  completionTokens,
}: EvaluationReportProps) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  async function runEvaluation() {
    setRunning(true);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${sessionId}/evaluate`, {
        method: "POST",
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as Record<string, unknown>).error === "string"
            ? String((payload as Record<string, unknown>).error)
            : "Evaluation failed — retry";
        throw new Error(message);
      }
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Evaluation failed — retry",
      );
    } finally {
      setRunning(false);
    }
  }

  const canEvaluate = sessionStatus === "completed";
  const buttonLabel = evaluation?.evaluatedAt
    ? "Re-run evaluation"
    : "Run evaluation";

  return (
    <section className="mt-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
          Evaluation
        </p>
        {canEvaluate ? (
          <Button type="button" onClick={() => void runEvaluation()} disabled={running}>
            {running ? "Evaluating…" : buttonLabel}
          </Button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0A0A0A]">
          {error}
        </p>
      ) : null}

      {!evaluation ? (
        <div className="rounded-[6px] border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-6 py-12 text-center text-sm text-[#6B6B6B]">
          {canEvaluate
            ? "No evaluation yet. Run evaluation to generate a rubric report."
            : "Complete the interview to unlock evaluation."}
        </div>
      ) : evaluation.error ? (
        <div className="rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0A0A0A]">
          {evaluation.error}
        </div>
      ) : (
        <>
          <header className="rounded-[6px] border border-[#E5E5E5] bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Verdict
                </p>
                <p className="mt-2 text-2xl font-semibold text-[#0A0A0A]">
                  {evaluation.verdict}
                </p>
                <p className="mt-2 text-sm text-[#6B6B6B]">
                  {evaluation.verdictRationale}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                  Weighted score
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums text-[#0A0A0A]">
                  {evaluation.weightedScore.toFixed(2)} / 4
                </p>
                <p className="mt-2 text-sm text-[#6B6B6B]">
                  Level estimate: {evaluation.levelEstimate}
                </p>
                <p className="mt-1 text-sm text-[#0A0A0A]">
                  {evaluation.wouldPass}
                </p>
              </div>
            </div>
          </header>

          <div className="overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Dimension</th>
                  <th className="px-4 py-3 font-semibold">Weight</th>
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Improvement</th>
                </tr>
              </thead>
              <tbody>
                {RUBRIC_DIMENSIONS.map((dimension) => {
                  const scoreRow = evaluation.scores.find(
                    (score) => score.dimension === dimension.key,
                  );
                  const score = scoreRow?.score ?? 0;
                  const isOpen = expanded[dimension.key] ?? false;
                  return (
                    <Fragment key={dimension.key}>
                      <tr className="border-b border-[#E5E5E5]">
                        <td className="px-4 py-3 text-[#0A0A0A]">
                          {dimension.label}
                        </td>
                        <td className="px-4 py-3 tabular-nums text-[#6B6B6B]">
                          {dimension.weight}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {scoreBar(score)}
                            <span className="tabular-nums text-[#0A0A0A]">
                              {score}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6B6B6B]">
                          {scoreRow?.improvement ?? "—"}
                        </td>
                      </tr>
                      <tr className="border-b border-[#E5E5E5] bg-[#FAFAFA]">
                        <td colSpan={4} className="px-4 py-3">
                          <button
                            type="button"
                            className="text-xs font-medium uppercase tracking-wide text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
                            onClick={() =>
                              setExpanded((previous) => ({
                                ...previous,
                                [dimension.key]: !isOpen,
                              }))
                            }
                          >
                            {isOpen ? "Hide evidence" : "Show evidence"}
                          </button>
                          {isOpen ? (
                            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#0A0A0A]">
                              {(scoreRow?.evidence ?? []).map((item) => (
                                <li key={item}>{item}</li>
                              ))}
                            </ul>
                          ) : null}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[6px] border border-[#E5E5E5] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Strengths
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#0A0A0A]">
                {evaluation.strengths.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-[6px] border border-[#E5E5E5] bg-white p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
                Gaps
              </p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[#0A0A0A]">
                {evaluation.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-[6px] border border-[#E5E5E5] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Action items
            </p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#0A0A0A]">
              {evaluation.actionItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          </div>

          <div className="overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-white">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E5E5E5] text-[11px] uppercase tracking-wider text-[#6B6B6B]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Phase</th>
                  <th className="px-4 py-3 font-semibold">Minutes</th>
                  <th className="px-4 py-3 font-semibold">Assessment</th>
                </tr>
              </thead>
              <tbody>
                {evaluation.phaseAnalysis.map((phase) => (
                  <tr key={`${phase.phase}-${phase.minutes}`} className="border-b border-[#E5E5E5]">
                    <td className="px-4 py-3 text-[#0A0A0A]">{phase.phase}</td>
                    <td className="px-4 py-3 tabular-nums text-[#6B6B6B]">
                      {phase.minutes}
                    </td>
                    <td className="px-4 py-3 text-[#6B6B6B]">
                      {phase.assessment}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-sm text-[#6B6B6B]">
            Duration {evaluation.stats.durationMin} min ·{" "}
            {evaluation.stats.candidateWords.toLocaleString()} candidate words ·{" "}
            {evaluation.stats.interviewerTurns} interviewer turns ·{" "}
            {evaluation.stats.nudgeCount} nudges ·{" "}
            {evaluation.stats.reconnectCount} audio reconnect
            {evaluation.stats.reconnectCount === 1 ? "" : "s"} ·{" "}
            {promptTokens.toLocaleString()} prompt /{" "}
            {completionTokens.toLocaleString()} completion tokens
          </p>

          <p className="text-xs text-[#6B6B6B]">
            Evaluated with {evaluation.evaluatorModel} ·{" "}
            {new Date(evaluation.evaluatedAt).toLocaleString()} · rubric{" "}
            {evaluation.rubricVersion}
          </p>
        </>
      )}
    </section>
  );
}
