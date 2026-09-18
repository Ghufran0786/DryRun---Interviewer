import { DeepgramDoctor } from "@/components/debug/DeepgramDoctor";
import { AppHeader } from "@/components/layout/AppHeader";
import Link from "next/link";

export default function DeepgramDebugPage() {
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
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-[#6B6B6B]">
          Development aid
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#0A0A0A]">
          Deepgram connection doctor
        </h1>
        <p className="mt-2 text-sm text-[#6B6B6B]">
          Isolate token, WebSocket, microphone capture, and full-pipeline
          failures without changing the production audio path.
        </p>
        <div className="mt-8">
          <DeepgramDoctor />
        </div>
      </main>
    </>
  );
}
