import { AppHeader } from "@/components/layout/AppHeader";
import { ReportTranscript } from "@/components/report/ReportTranscript";
import { ReportWhiteboard } from "@/components/report/ReportWhiteboard";
import { SnapshotGallery } from "@/components/report/SnapshotGallery";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime, formatDurationMs, sessionDurationMs } from "@/lib/format";
import { prisma } from "@/lib/db";
import { parseSceneJson } from "@/lib/scenePayload";
import { digestFromElementsJson } from "@/lib/sceneDigest";
import { isTargetLevel } from "@/lib/validation";
import Link from "next/link";
import { notFound } from "next/navigation";

type PageProps = { params: Promise<{ id: string }> };

export default async function ReportPage({ params }: PageProps) {
  const { id } = await params;
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) {
    notFound();
  }

  const [snapshots, transcript] = await Promise.all([
    prisma.snapshot.findMany({
      where: { sessionId: id },
      orderBy: { capturedAt: "asc" },
    }),
    prisma.transcriptEntry.findMany({
      where: { sessionId: id },
      orderBy: [{ tsMs: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const durationMs = sessionDurationMs(session.startedAt, session.endedAt);
  const level = isTargetLevel(session.targetLevel)
    ? session.targetLevel
    : session.targetLevel;

  const galleryItems = snapshots.map((snap) => ({
    id: snap.id,
    capturedAt: snap.capturedAt,
    trigger: snap.trigger,
    digest: digestFromElementsJson(snap.elementsJson),
  }));

  return (
    <>
      <AppHeader
        trailing={
          <Link
            href="/"
            className="text-sm text-[#6B6B6B] hover:text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
          >
            Dashboard
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl flex-1 px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
          Report
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0A0A0A]">
          {session.title}
        </h1>

        <dl className="mt-8 grid gap-4 rounded-[6px] border border-[#E5E5E5] bg-white p-6 text-sm">
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-[#6B6B6B]">Problem</dt>
            <dd className="text-[#0A0A0A] max-w-md text-right">{session.problem}</dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between items-center">
            <dt className="text-[#6B6B6B]">Level</dt>
            <dd><Badge>{level}</Badge></dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-[#6B6B6B]">Status</dt>
            <dd className="text-[#0A0A0A] uppercase text-xs tracking-wide">
              {session.status}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-[#6B6B6B]">Duration</dt>
            <dd className="tabular-nums text-[#0A0A0A]">
              {durationMs !== null ? formatDurationMs(durationMs) : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-[#6B6B6B]">Started</dt>
            <dd className="text-[#0A0A0A]">
              {session.startedAt ? formatDateTime(session.startedAt) : "—"}
            </dd>
          </div>
          <div className="flex flex-wrap gap-2 justify-between">
            <dt className="text-[#6B6B6B]">Ended</dt>
            <dd className="text-[#0A0A0A]">
              {session.endedAt ? formatDateTime(session.endedAt) : "—"}
            </dd>
          </div>
        </dl>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Final whiteboard
          </p>
          <ReportWhiteboard
            sessionId={session.id}
            initialScene={parseSceneJson(session.sceneJson)}
          />
        </section>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Snapshot gallery
          </p>
          <SnapshotGallery snapshots={galleryItems} />
        </section>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
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

        <div
          className="mt-10 rounded-[6px] border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-6 py-16 text-center"
        >
          <p className="text-sm text-[#6B6B6B]">
            Evaluation report — arrives in Phase 7
          </p>
        </div>
        <footer className="mt-8 border-t border-[#E5E5E5] pt-4 text-xs text-[#6B6B6B]">
          OpenRouter usage:{" "}
          <span className="tabular-nums text-[#0A0A0A]">
            {session.promptTokens.toLocaleString()} prompt
          </span>{" "}
          /{" "}
          <span className="tabular-nums text-[#0A0A0A]">
            {session.completionTokens.toLocaleString()} completion tokens
          </span>
        </footer>
      </main>
    </>
  );
}
