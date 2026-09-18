import { AppHeader } from "@/components/layout/AppHeader";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { getSettings } from "@/lib/settings";
import Link from "next/link";

export default async function SettingsPage() {
  const settings = await getSettings();

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
      <main className="mx-auto max-w-xl flex-1 px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
          Configuration
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0A0A0A]">Settings</h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Preferences are stored locally in SQLite and persist across restarts.
        </p>
        <Link
          href="/debug/deepgram"
          className="mt-4 inline-block text-sm font-medium text-[#0A0A0A] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
        >
          Deepgram connection doctor
        </Link>
        <div className="mt-8 rounded-[6px] border border-[#E5E5E5] bg-white p-6">
          <SettingsForm initial={settings} />
        </div>
      </main>
    </>
  );
}
