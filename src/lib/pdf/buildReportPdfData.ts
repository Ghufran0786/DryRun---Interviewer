import { buildAnalysisPromptForPdfExternalPage } from "@/lib/evaluation/analysisPrompt";
import { computeStats } from "@/lib/evaluation/assemble";
import { parseStoredEvaluation } from "@/lib/evaluation/parseStored";
import type { ReportPdfData } from "@/lib/pdf/reportPdfTypes";
import { selectPdfDiagramSnapshots } from "@/lib/report/pdfDiagramSnapshots";
import { readSnapshotPngForPdf } from "@/lib/report/snapshotPngResize";
import { visibleTranscriptLines } from "@/lib/report/transcriptFormat";
import { formatDateTime, formatDurationMs, sessionDurationMs } from "@/lib/format";
import { digestFromElementsJson } from "@/lib/sceneDigest";
import type { Session, Settings, Snapshot, TranscriptEntry } from "@prisma/client";

function parsePhaseNotes(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((note): note is string => typeof note === "string")
      : [];
  } catch {
    return [];
  }
}

export async function buildReportPdfData(input: {
  session: Session;
  settings: Settings;
  entries: TranscriptEntry[];
  snapshots: Snapshot[];
}): Promise<ReportPdfData> {
  const stats = computeStats(input.entries, input.session);
  const stored = parseStoredEvaluation(input.session.evaluationJson);
  const evaluated =
    stored !== null &&
    typeof stored.weightedScore === "number" &&
    Array.isArray(stored.scores) &&
    stored.scores.length > 0 &&
    !stored.error;

  const snapshotById = new Map(
    input.snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const diagramMeta = selectPdfDiagramSnapshots(
    input.snapshots,
    input.session.startedAt,
    evaluated ? 4 : 6,
  );
  const diagrams = await Promise.all(
    diagramMeta.map(async (diagram) => {
      const snapshot = snapshotById.get(diagram.id);
      return {
        ...diagram,
        digest: digestFromElementsJson(snapshot?.elementsJson ?? "[]"),
        imageDataUri: `data:image/png;base64,${(
          await readSnapshotPngForPdf(diagram.pngPath)
        ).toString("base64")}`,
      };
    }),
  );

  const durationMs = sessionDurationMs(
    input.session.startedAt,
    input.session.endedAt,
  );

  return {
    title: input.session.title,
    problem: input.session.problem,
    candidateName: input.settings.candidateName.trim() || "Candidate",
    targetLevel: input.session.targetLevel,
    phaseNotes: parsePhaseNotes(input.session.phaseNotesJson),
    sessionDate: input.session.endedAt
      ? formatDateTime(input.session.endedAt)
      : formatDateTime(input.session.createdAt),
    durationLabel:
      durationMs !== null ? formatDurationMs(durationMs) : "—",
    evaluated,
    evaluation: evaluated && stored ? stored : null,
    stats,
    promptTokens: input.session.promptTokens,
    completionTokens: input.session.completionTokens,
    transcriptLines: visibleTranscriptLines(input.entries),
    diagrams,
    generatedAt: formatDateTime(new Date()),
    externalEvalInstructions: buildAnalysisPromptForPdfExternalPage(
      input.session,
      input.settings,
      input.entries,
      input.snapshots,
      input.session.evaluationJson,
    ),
  };
}
