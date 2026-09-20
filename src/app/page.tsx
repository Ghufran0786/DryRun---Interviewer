import { DashboardLiveRefresh } from "@/components/dashboard/DashboardLiveRefresh";
import { DashboardStats } from "@/components/dashboard/DashboardStats";
import { NewSessionForm } from "@/components/dashboard/NewSessionForm";
import { SessionList } from "@/components/dashboard/SessionList";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { EmptyState } from "@/components/ui/EmptyState";
import { getChromeAuth, getOwnerIdFromSession } from "@/lib/auth/ownerSession";
import { prisma } from "@/lib/db";
import { sessionsForUserWhere } from "@/lib/sessionScope";
import { getSettings } from "@/lib/settings";
import { isHostedMode } from "@/lib/appMode";
import { isTargetLevel } from "@/lib/validation";
import { unstable_noStore as noStore } from "next/cache";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function DashboardPage() {
  noStore();
  const ownerId = await getOwnerIdFromSession();
  const sessionWhere = ownerId ? sessionsForUserWhere(ownerId) : { id: "__none__" };
  const unassignedWhere = isHostedMode()
    ? { OR: [{ userId: null }, { userId: "pending" }] }
    : { id: "__none__" };

  const [sessions, settings, chromeAuth, unassignedCount] = await Promise.all([
    prisma.session.findMany({
      where: sessionWhere,
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { snapshots: true } } },
    }),
    getSettings(),
    getChromeAuth(),
    isHostedMode()
      ? prisma.session.count({ where: unassignedWhere })
      : Promise.resolve(0),
  ]);

  const defaultTargetLevel = isTargetLevel(settings.defaultTargetLevel)
    ? settings.defaultTargetLevel
    : "SDE-2";

  const activeSession = sessions.find((s) => s.status === "active");
  const latestReport = sessions.find((s) => s.status === "completed");

  return (
    <SiteChrome
      initialChromeAuth={chromeAuth}
      interviewHref={
        activeSession ? `/interview/${activeSession.id}` : undefined
      }
      reportHref={
        latestReport ? `/report/${latestReport.id}` : undefined
      }
    >
      <DashboardLiveRefresh />
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
            {isHostedMode() ? (
              <p className="max-w-xl text-sm text-muted">
                Sessions are stored in cloud Postgres. Sign in on each browser
                with the same DryRun email; use the same site URL (not localhost).
              </p>
            ) : null}
          </div>
          <NewSessionForm defaultTargetLevel={defaultTargetLevel} />
        </div>

        {unassignedCount > 0 ? (
          <p className="mb-6 text-sm text-foreground">
            {unassignedCount} session{unassignedCount === 1 ? "" : "s"} need
            owner assignment
          </p>
        ) : null}

        <DashboardStats sessions={sessions} settings={settings} />

        <section>
          {sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              description="Start a new interview to practice system design with an AI interviewer. Your sessions and reports will appear here."
            />
          ) : (
            <SessionList
              sessions={sessions}
              repositoryLabel={
                isHostedMode()
                  ? "HOSTED · SUPABASE POSTGRES"
                  : "LOCAL REPOSITORY · ./data/dryrun.db"
              }
            />
          )}
        </section>
      </main>
    </SiteChrome>
  );
}
