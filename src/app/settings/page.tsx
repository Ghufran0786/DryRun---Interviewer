import { SiteChrome } from "@/components/layout/SiteChrome";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import Link from "next/link";

export default async function SettingsPage() {
  const settings = await getSettings();
  const [activeSession, latestReport] = await Promise.all([
    prisma.session.findFirst({
      where: { status: "active" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.session.findFirst({
      where: { status: "completed" },
      orderBy: { endedAt: "desc" },
    }),
  ]);

  return (
    <SiteChrome
      interviewHref={
        activeSession ? `/interview/${activeSession.id}` : undefined
      }
      reportHref={latestReport ? `/report/${latestReport.id}` : undefined}
    >
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          Configuration / Engine
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
          Settings & engine configuration
        </h1>
        <p className="mt-2 text-sm text-muted">
          Preferences are stored locally in SQLite and persist across restarts.
        </p>
        <Link
          href="/debug/deepgram"
          className="mt-4 inline-block text-sm font-medium text-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          Deepgram connection doctor
        </Link>
        <div className="mt-8 rounded-xl border border-border bg-white p-6 shadow-sm">
          <SettingsForm initial={settings} />
        </div>
      </main>
    </SiteChrome>
  );
}
