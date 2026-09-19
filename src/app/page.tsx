import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { NewSessionForm } from "@/components/dashboard/NewSessionForm";
import { SessionList } from "@/components/dashboard/SessionList";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isTargetLevel } from "@/lib/validation";

export default async function DashboardPage() {
  const [sessions, settings] = await Promise.all([
    prisma.session.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { snapshots: true } } },
    }),
    getSettings(),
  ]);

  const defaultTargetLevel = isTargetLevel(settings.defaultTargetLevel)
    ? settings.defaultTargetLevel
    : "SDE-2";

  const activeSession = sessions.find((s) => s.status === "active");
  const latestReport = sessions.find((s) => s.status === "completed");

  return (
    <SiteChrome
      interviewHref={
        activeSession ? `/interview/${activeSession.id}` : undefined
      }
      reportHref={
        latestReport ? `/report/${latestReport.id}` : undefined
      }
    >
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-1 text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-foreground" />
              Dashboard / Sessions runtime
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Interview sessions
            </h1>
          </div>
          <NewSessionForm defaultTargetLevel={defaultTargetLevel} />
        </div>

        <DashboardStats sessions={sessions} settings={settings} />

        <section>
          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Start a new interview to practice system design with an AI interviewer. Your sessions and reports will appear here."
            />
          ) : (
            <SessionList sessions={sessions} />
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
