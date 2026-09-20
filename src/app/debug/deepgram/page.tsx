import { DeepgramDoctor } from "@/components/debug/DeepgramDoctor";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { getChromeAuth } from "@/lib/auth/ownerSession";
import { isHostedMode } from "@/lib/appMode";
import { getDryRunOwnerEmail } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DeepgramDebugPage() {
  if (isHostedMode()) {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const ownerEmail = getDryRunOwnerEmail();
    if (!user?.email || user.email.trim().toLowerCase() !== ownerEmail) {
      notFound();
    }
  }

  const chromeAuth = await getChromeAuth();
  return (
    <SiteChrome initialChromeAuth={chromeAuth} runtimeStatus="DEBUG">
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          Development aid
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          Deepgram connection doctor
        </h1>
        <p className="mt-2 text-sm text-muted">
          Isolate token, WebSocket, microphone capture, and full-pipeline
          failures without changing the production audio path.
        </p>
        <div className="mt-8">
          <DeepgramDoctor />
        </div>
      </main>
    </SiteChrome>
  );
}
