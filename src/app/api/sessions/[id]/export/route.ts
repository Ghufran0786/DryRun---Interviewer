import { buildAnalysisPrompt, snapshotZipFilename } from "@/lib/evaluation/analysisPrompt";
import { loadCompletedSessionReportContext } from "@/lib/report/loadCompletedSession";
import { zipDownloadFilename } from "@/lib/report/filename";
import { readSnapshotPngOriginal } from "@/lib/report/snapshotPngResize";
import { visibleTranscriptLines } from "@/lib/report/transcriptFormat";
import JSZip from "jszip";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function snapshotElapsedMs(
  capturedAt: Date,
  startedAt: Date | null,
): number {
  if (!startedAt) {
    return capturedAt.getTime();
  }
  return Math.max(0, capturedAt.getTime() - startedAt.getTime());
}

function hasEvaluationJson(evaluationJson: string | null): boolean {
  if (!evaluationJson) {
    return false;
  }
  try {
    const parsed: unknown = JSON.parse(evaluationJson);
    if (!parsed || typeof parsed !== "object") {
      return false;
    }
    const record = parsed as Record<string, unknown>;
    return typeof record.error !== "string" && typeof record.verdict === "string";
  } catch {
    return false;
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const loaded = await loadCompletedSessionReportContext(id);
  if ("error" in loaded) {
    return loaded.error;
  }

  const { session, settings, entries, snapshots } = loaded;
  const zip = new JSZip();
  const transcriptLines = visibleTranscriptLines(entries);
  zip.file("transcript.md", `${transcriptLines.join("\n")}\n`);

  if (hasEvaluationJson(session.evaluationJson)) {
    zip.file("evaluation.json", session.evaluationJson ?? "");
  }

  const analysisPrompt = buildAnalysisPrompt(
    session,
    settings,
    entries,
    snapshots,
    session.evaluationJson,
  );
  zip.file("ANALYSIS_PROMPT.md", analysisPrompt);

  const snapshotFolder = zip.folder("snapshots");
  const snapshotEntries: { path: string; bytes: number }[] = [];
  if (snapshotFolder) {
    for (const [index, snapshot] of snapshots.entries()) {
      const tsMs = snapshotElapsedMs(snapshot.capturedAt, session.startedAt);
      const name = snapshotZipFilename(index, snapshot.trigger, tsMs);
      const bytes = await readSnapshotPngOriginal(snapshot.pngPath);
      snapshotFolder.file(name, bytes);
      snapshotEntries.push({
        path: `snapshots/${name}`,
        bytes: bytes.length,
      });
    }
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = zipDownloadFilename(
    session.title,
    session.endedAt ?? session.createdAt,
  );

  const transcriptBytes = Buffer.byteLength(
    `${transcriptLines.join("\n")}\n`,
    "utf8",
  );
  const analysisBytes = Buffer.byteLength(analysisPrompt, "utf8");
  const evaluationBytes =
    hasEvaluationJson(session.evaluationJson) && session.evaluationJson
      ? Buffer.byteLength(session.evaluationJson, "utf8")
      : 0;
  const zipEntryLog = [
    { path: "transcript.md", bytes: transcriptBytes },
    ...(evaluationBytes > 0
      ? [{ path: "evaluation.json", bytes: evaluationBytes }]
      : []),
    { path: "ANALYSIS_PROMPT.md", bytes: analysisBytes },
    ...snapshotEntries,
  ];
  console.log("Export bundle generated:", {
    sessionId: id,
    bytes: zipBuffer.length,
    entries: zipEntryLog,
  });

  return new NextResponse(new Uint8Array(zipBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(zipBuffer.length),
    },
  });
}
