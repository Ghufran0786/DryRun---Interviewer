import { DeepgramDoctor } from "@/components/debug/DeepgramDoctor";
import { SiteChrome } from "@/components/layout/SiteChrome";

export default function DeepgramDebugPage() {
  return (
    <SiteChrome runtimeStatus="DEBUG">
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
