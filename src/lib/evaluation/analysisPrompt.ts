import { computeStats, type SnapshotLike } from "@/lib/evaluation/assemble";
import {
  rubricDimensionsSummary,
  rubricLevelCalibrationText,
} from "@/lib/evaluation/rubric";
import { digestFromElementsJson } from "@/lib/sceneDigest";
import { formatTranscriptLine } from "@/lib/report/transcriptFormat";
import { formatTsMs, formatTsMsCompact } from "@/lib/report/transcriptFormat";
import type { Session, Settings, TranscriptEntry } from "@prisma/client";

type SessionContext = Pick<
  Session,
  | "problem"
  | "targetLevel"
  | "startedAt"
  | "endedAt"
  | "reconnectCount"
  | "closeCodesJson"
  | "phaseNotesJson"
  | "evaluationJson"
>;

function snapshotElapsedMs(
  snapshot: SnapshotLike,
  startedAt: Date | null,
): number {
  if (!startedAt) {
    return snapshot.capturedAt.getTime();
  }
  return Math.max(0, snapshot.capturedAt.getTime() - startedAt.getTime());
}

function evaluationComparisonBlock(evaluationJson: string | null): string {
  if (!evaluationJson) {
    return "(not yet evaluated locally — score from scratch)";
  }
  try {
    const parsed: unknown = JSON.parse(evaluationJson);
    if (!parsed || typeof parsed !== "object") {
      return "(not yet evaluated locally — score from scratch)";
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.error === "string") {
      return "(not yet evaluated locally — score from scratch)";
    }
    if (typeof record.verdict !== "string" || typeof record.weightedScore !== "number") {
      return "(not yet evaluated locally — score from scratch)";
    }
    const scores = Array.isArray(record.scores) ? record.scores : [];
    const lines = scores
      .map((score) => {
        if (!score || typeof score !== "object") {
          return null;
        }
        const row = score as Record<string, unknown>;
        if (typeof row.dimension !== "string" || typeof row.score !== "number") {
          return null;
        }
        const improvement =
          typeof row.improvement === "string" ? row.improvement : "";
        return `- ${row.dimension}: ${row.score}/4 — ${improvement}`;
      })
      .filter((line): line is string => line !== null);
    return [
      `Verdict: ${record.verdict}`,
      `Weighted score: ${record.weightedScore}/4`,
      ...lines,
    ].join("\n");
  } catch {
    return "(not yet evaluated locally — score from scratch)";
  }
}

export function buildAnalysisPrompt(
  session: SessionContext,
  settings: Pick<Settings, "resumeText">,
  entries: TranscriptEntry[],
  snapshots: SnapshotLike[],
  evaluationJson?: string | null,
  options?: { omitTranscriptAndDigests?: boolean },
): string {
  const stats = computeStats(entries, session);
  const resumeText = settings.resumeText.trim();
  const transcriptLines = entries
    .filter((entry) => !entry.suppressed)
    .sort((left, right) => left.tsMs - right.tsMs)
    .map((entry) => formatTranscriptLine(entry));

  const digestBlocks = snapshots.map((snapshot, index) => {
    const tsMs = snapshotElapsedMs(snapshot, session.startedAt);
    const digest = digestFromElementsJson(snapshot.elementsJson);
    const ordinal = String(index + 1).padStart(3, "0");
    return `[snapshot:${ordinal} @ ${formatTsMs(tsMs)}, ${snapshot.trigger}]\n${digest || "(empty board)"}`;
  });

  const statsBlock = [
    `durationMin: ${stats.durationMin}`,
    `candidateWords: ${stats.candidateWords}`,
    `interviewerTurns: ${stats.interviewerTurns}`,
    `nudgeCount: ${stats.nudgeCount}`,
    `suppressedCount: ${stats.suppressedCount}`,
    `reconnectCount: ${stats.reconnectCount}`,
    `closeCodes: ${stats.closeCodes.length > 0 ? stats.closeCodes.join(", ") : "none"}`,
    "phaseTimeline:",
    ...stats.phaseTimeline.map(
      (phase) => `- ${phase.phase}: ${phase.minutes} min`,
    ),
  ].join("\n");

  const dimensionsBlock = `${rubricDimensionsSummary()}\n${rubricLevelCalibrationText()}`;
  const evaluationSource = evaluationJson ?? session.evaluationJson;

  return `# Mock Interview Analysis Request

You are a bar-raiser-calibre system design interview evaluator at a top
product company. Below is the complete record of a mock system design
interview from the DryRun practice platform: an AI interviewer, a human
candidate speaking aloud (speech-to-text transcript) and drawing on a
whiteboard. Whiteboard PNG snapshots are attached separately — ask for them
if missing before scoring the whiteboard dimension.

## Candidate & role context
Problem: ${session.problem} · Target level: ${session.targetLevel} · Duration: ${stats.durationMin} min
Resume (for role fit): ${resumeText.length > 0 ? resumeText : "(not provided — judge level fit only)"}

## Interview statistics
${statsBlock}

## Whiteboard evolution (digests)
${
    options?.omitTranscriptAndDigests
      ? "(see appendix above)"
      : digestBlocks.length > 0
        ? digestBlocks.join("\n\n")
        : "(no snapshots captured)"
  }

## Full transcript
${
    options?.omitTranscriptAndDigests
      ? "(see appendix above)"
      : transcriptLines.join("\n") || "(empty)"
  }

## DryRun's own evaluation (comparison only — do NOT anchor on it)
${evaluationComparisonBlock(evaluationSource)}

## Your task — produce these sections in this exact order

1. VERDICT BLOCK: verdict · weighted score · the level this performance
   actually supports · and a plain answer: would this candidate receive an
   offer for a ${session.targetLevel} role at a top product company, given this
   interview AND the resume above? Name the deciding factors.
2. SCORE TABLE: for each of the 8 dimensions below, score 0-4 with a one-line
   justification citing [mm:ss] or [snapshot:NNN]. Apply the level
   calibration strictly; bonus items never cause deductions:
   ${dimensionsBlock}
   Verdict bands on the weighted average: >=3.4 Strong Hire · 2.6-3.39 Hire ·
   2.0-2.59 Lean Hire · <2.0 No Hire (you may move ONE step with explicit
   rationale).
3. DISAGREEMENTS with DryRun's included evaluation, if present, and why.
   Score independently first; do not anchor on it.
4. THE THREE WORST MOMENTS: the three most costly timestamps. For each, quote
   what happened, then script the ~30-second answer a strong candidate at
   this level would have given instead.
5. THE MODEL INTERVIEW: how this exact problem should be handled at
   ${session.targetLevel}, phase by phase with minute budgets (Requirements →
   Estimation → API/Data → HLD → Deep Dive → Wrap-up), 2-3 sentences of
   ideal content per phase.
6. THE MODEL WHITEBOARD: the ideal end-state board as a Mermaid flowchart
   with every component labeled, plus one line per component explaining its
   job and the key choice behind it. Then describe the BOARD EVOLUTION: what
   should be visible at minute 5, 15, 25, and 40.
7. DRILL PLAN: the 3 highest-leverage improvements, each with a concrete
   one-week practice routine and a measurable exit criterion.

Rules: this transcript is speech-to-text — judge ideas, never grammar or
garbled proper nouns; an isolated obviously-off-topic segment is a
transcription artifact, ignore it. Hints include interviewer answers given
because the candidate explicitly asked for help; 0-1 hints normal, 2-3 caps
Communication at 3, 4+ caps it at 2.
`;
}

export function buildAnalysisPromptForPdfExternalPage(
  session: SessionContext,
  settings: Pick<Settings, "resumeText">,
  entries: TranscriptEntry[],
  snapshots: SnapshotLike[],
  evaluationJson?: string | null,
): string {
  return buildAnalysisPrompt(
    session,
    settings,
    entries,
    snapshots,
    evaluationJson,
    { omitTranscriptAndDigests: true },
  );
}

export function snapshotZipFilename(
  index: number,
  trigger: string,
  tsMs: number,
): string {
  const ordinal = String(index + 1).padStart(3, "0");
  return `${ordinal}-${trigger}-${formatTsMsCompact(tsMs)}.png`;
}
