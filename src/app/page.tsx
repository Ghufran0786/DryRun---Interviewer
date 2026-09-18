import { NewSessionForm } from "@/components/dashboard/NewSessionForm";
import { SessionList } from "@/components/dashboard/SessionList";
import { AppHeader } from "@/components/layout/AppHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { isTargetLevel } from "@/lib/validation";
import Link from "next/link";

export default async function DashboardPage() {
  const [sessions, settings] = await Promise.all([
    prisma.session.findMany({ orderBy: { createdAt: "desc" } }),
    getSettings(),
  ]);

  const defaultTargetLevel = isTargetLevel(settings.defaultTargetLevel)
    ? settings.defaultTargetLevel
    : "SDE-2";

  return (
    <>
      <AppHeader
        trailing={
          <Link
            href="/settings"
            className="text-sm text-[#6B6B6B] hover:text-[#0A0A0A] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
          >
            Settings
          </Link>
        }
      />
      <main className="mx-auto max-w-6xl flex-1 px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
              Dashboard
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#0A0A0A]">
              Interview sessions
            </h1>
          </div>
          <NewSessionForm defaultTargetLevel={defaultTargetLevel} />
        </div>

        <section className="mt-10">
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
            Past sessions
          </p>
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
    </>
  );
}
