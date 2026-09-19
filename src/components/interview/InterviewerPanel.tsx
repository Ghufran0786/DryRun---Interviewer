"use client";

import type { TranscriptFinal } from "@/components/transcript/TranscriptStore";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatDurationMs } from "@/lib/format";
import { useEffect, useRef, useState } from "react";
import type { InterviewerLoopDebugEvent } from "@/hooks/useInterviewerLoop";
import type { VoiceStatus } from "@/hooks/useInterviewerVoice";

type InterviewerPanelProps = {
  entries: TranscriptFinal[];
  thinking: boolean;
  error: string | null;
  onRetry: () => void;
  onBegin: () => void;
  onAsk: () => void;
  onSimulate: (text: string) => void;
  diagnostics: InterviewerLoopDebugEvent[];
  voiceEnabled: boolean;
  voiceStatuses: Record<string, VoiceStatus>;
  onReplay: (messageId: string, text: string) => void;
  onStopVoice: () => void;
};

export function InterviewerPanel({
  entries,
  thinking,
  error,
  onRetry,
  onBegin,
  onAsk,
  onSimulate,
  diagnostics,
  voiceEnabled,
  voiceStatuses,
  onReplay,
  onStopVoice,
}: InterviewerPanelProps) {
  const [simulation, setSimulation] = useState("");
  const [copiedDiagnostics, setCopiedDiagnostics] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const visible = entries.filter((entry) => !entry.suppressed);
  const hasInterviewer = entries.some((entry) => entry.role === "interviewer");

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries, thinking]);

  async function copyDiagnostics() {
    const text = diagnostics
      .map(
        (event) =>
          `${event.at} ${event.event} ${JSON.stringify(event.details)}`,
      )
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopiedDiagnostics(true);
    window.setTimeout(() => setCopiedDiagnostics(false), 1500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Conversation
        </span>
        <Button type="button" variant="secondary" onClick={onAsk} disabled={thinking}>
          Ask interviewer
        </Button>
      </div>

      {error ? (
        <div className="shrink-0 rounded-[6px] border border-foreground bg-background p-3 text-sm text-foreground">
          <p>{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            Retry
          </button>
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto">
        {!hasInterviewer ? (
          <div className="rounded-[6px] border border-dashed border-border bg-background p-4">
            <p className="text-sm text-muted">
              Start with the interviewer&apos;s opening prompt.
            </p>
            <Button
              type="button"
              className="mt-3"
              onClick={onBegin}
              disabled={thinking}
            >
              Begin interview
            </Button>
          </div>
        ) : null}

        {visible.map((entry) => (
          <article
            key={entry.id}
            className={`rounded-[6px] border p-3 ${
              entry.role === "interviewer"
                ? "border-foreground bg-white"
                : "border-border bg-background"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                {entry.role}
              </span>
              {entry.kind ? <Badge>{entry.kind.replace("_", " ")}</Badge> : null}
              <span className="ml-auto tabular-nums text-[11px] text-muted">
                {formatDurationMs(entry.tsMs)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground">{entry.text}</p>
            {entry.role === "interviewer" ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                {voiceStatuses[entry.id]?.state === "loading" ? (
                  <span>voice loading…</span>
                ) : null}
                {voiceStatuses[entry.id]?.state === "playing" ? (
                  <button
                    type="button"
                    onClick={onStopVoice}
                    className="font-semibold text-foreground underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    Stop
                  </button>
                ) : null}
                {voiceStatuses[entry.id]?.state === "failed" ? (
                  <>
                    <span>
                      voice failed ({voiceStatuses[entry.id]?.error})
                    </span>
                    <button
                      type="button"
                      onClick={() => onReplay(entry.id, entry.text)}
                      disabled={!voiceEnabled}
                      className="font-semibold text-foreground underline underline-offset-4 disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                    >
                      Retry
                    </button>
                  </>
                ) : null}
                {!voiceStatuses[entry.id] ||
                voiceStatuses[entry.id]?.state === "idle" ? (
                  <button
                    type="button"
                    onClick={() => onReplay(entry.id, entry.text)}
                    disabled={!voiceEnabled}
                    className="font-semibold text-foreground underline underline-offset-4 disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    Replay
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        ))}

        {thinking ? (
          <p className="text-sm italic text-muted">thinking…</p>
        ) : null}
      </div>

      <form
        className="shrink-0 border-t border-border pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          const text = simulation.trim();
          if (!text) return;
          onSimulate(text);
          setSimulation("");
        }}
      >
        <label
          htmlFor="simulate-utterance"
          className="text-[11px] font-semibold uppercase tracking-wider text-muted"
        >
          Simulate utterance
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="simulate-utterance"
            value={simulation}
            onChange={(event) => setSimulation(event.target.value)}
            placeholder="Type a candidate utterance"
            className="min-w-0 flex-1 rounded-[6px] border border-border bg-white px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-foreground"
          />
          <Button type="submit" variant="secondary">
            Inject
          </Button>
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Permanent development aid. Uses the real persistence and turn path.
        </p>
      </form>
      <details className="shrink-0 border-t border-border pt-2 text-[11px] text-muted">
        <summary className="cursor-pointer font-semibold uppercase tracking-wider text-foreground">
          Debug log ({diagnostics.length})
        </summary>
        <button
          type="button"
          onClick={() => void copyDiagnostics()}
          className="mt-2 rounded-[6px] border border-border bg-white px-2 py-1 font-semibold text-foreground hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
        >
          {copiedDiagnostics ? "Copied" : "Copy full trace"}
        </button>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto font-mono">
          {diagnostics.slice(-30).map((event, index) => (
            <p key={`${event.at}-${event.event}-${index}`}>
              {event.at} {event.event} {JSON.stringify(event.details)}
            </p>
          ))}
        </div>
      </details>
    </div>
  );
}
