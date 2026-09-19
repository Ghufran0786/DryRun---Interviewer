import { SiteChrome } from "@/components/layout/SiteChrome";
import { ReportTranscript } from "@/components/report/ReportTranscript";
import { ReportWhiteboard } from "@/components/report/ReportWhiteboard";
import { EvaluationReport } from "@/components/report/EvaluationReport";
import { ReportDownloads } from "@/components/report/ReportDownloads";
import { SnapshotGallery } from "@/components/report/SnapshotGallery";
import { parseStoredEvaluation } from "@/lib/evaluation/parseStored";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDurationMs, sessionDurationMs } from "@/lib/format";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseSceneJson } from "@/lib/scenePayload";
import { digestFromElementsJson } from "@/lib/sceneDigest";
import { isTargetLevel } from "@/lib/validation";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    notFound();
  }

  const [snapshots, transcript, settings, activeSession] = await Promise.all([
    prisma.snapshot.findMany({
      where: { sessionId: id },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.transcriptEntry.findMany({
      where: { sessionId: id },
      orderBy: [{ tsMs: "asc" }, { createdAt: "asc" }],
    }),
    getSettings(),
    prisma.session.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const durationMs = sessionDurationMs(session.startedAt, session.endedAt);
  const level = isTargetLevel(session.targetLevel)
    ? session.targetLevel
    : session.targetLevel;

  const evaluation = parseStoredEvaluation(session.evaluationJson);

  const galleryItems = snapshots.map((snap) => ({
    id: snap.id,
    capturedAt: snap.capturedAt,
    trigger: snap.trigger,
    digest: digestFromElementsJson(snap.elementsJson),
  }));

  return (
    <SiteChrome
      runtimeStatus="REPORT"
      interviewHref={
        activeSession ? `/interview/${activeSession.id}` : undefined
      }
      reportHref={`/report/${session.id}`}
    >
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">
        <p className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
          Interview report & scoring
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          {session.title}
        </h1>

        <dl className="mt-8 grid gap-4 rounded-xl border border-border bg-white p-6 text-sm shadow-sm">
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-muted">Problem</dt>
            <dd className="text-foreground max-w-md text-right">{session.problem}</dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <dt className="text-muted">Level</dt>
            <dd><Badge>{level}</Badge></dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-muted">Status</dt>
            <dd className="text-foreground uppercase text-xs tracking-wide">
              {session.status}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-muted">Duration</dt>
            <dd className="tabular-nums text-foreground">
              {durationMs !== null ? formatDurationMs(durationMs) : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-muted">Started</dt>
            <dd className="text-foreground">
              {session.startedAt ? formatDateTime(session.startedAt) : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-muted">Ended</dt>
            <dd className="text-foreground">
              {session.endedAt ? formatDateTime(session.endedAt) : "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-8 space-y-6">
          <ReportDownloads
            sessionId={session.id}
            sessionStatus={session.status}
          />
          <EvaluationReport
            sessionId={session.id}
            sessionStatus={session.status}
            localEvaluationEnabled={settings.localEvaluationEnabled}
            evaluation={evaluation}
            promptTokens={session.promptTokens}
            completionTokens={session.completionTokens}
          />
        </div>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Final whiteboard
          </p>
          <ReportWhiteboard
            sessionId={session.id}
            initialScene={parseSceneJson(session.sceneJson)}
          />
        </section>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Snapshot gallery
          </p>
          <SnapshotGallery snapshots={galleryItems} />
        </section>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Transcript
          </p>
          <ReportTranscript
            entries={transcript.map((entry) => ({
              id: entry.id,
              role: entry.role,
              text: entry.text,
              tsMs: entry.tsMs,
              suppressed: entry.suppressed,
            }))}
          />
        </section>

        {session.verdict ? (
          <p className="mt-8 text-sm text-muted">
            Dashboard verdict:{" "}
            <span className="font-medium text-foreground">{session.verdict}</span>
          </p>
        ) : null}
      </main>
    </SiteChrome>
  );
}
