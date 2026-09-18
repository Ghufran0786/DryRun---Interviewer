"use client";

import { Button } from "@/components/ui/Button";
import type { DeepgramState } from "@/hooks/useDeepgramLive";

type MicControlsProps = {
  state: DeepgramState;
  error: string | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
};

const LABELS: Record<DeepgramState, string> = {
  idle: "Mic off",
  "requesting-mic": "Requesting mic",
  connecting: "Connecting",
  listening: "Listening",
  reconnecting: "Reconnecting",
  stopped: "Mic off",
  error: "Error",
};

/** Monochrome status dot: outline = idle, half = connecting/reconnecting, filled = listening. */
function StatusDot({ state }: { state: DeepgramState }) {
  if (state === "listening") {
    return (
      <span className="h-2 w-2 rounded-full bg-[#0A0A0A]" aria-hidden />
    );
  }
  if (
    state === "connecting" ||
    state === "reconnecting" ||
    state === "requesting-mic"
  ) {
    return (
      <span
        className="h-2 w-2 overflow-hidden rounded-full border border-[#0A0A0A]"
        aria-hidden
      >
        <span className="block h-full w-1/2 bg-[#0A0A0A]" />
      </span>
    );
  }
  return (
    <span
      className="h-2 w-2 rounded-full border border-[#0A0A0A] bg-transparent"
      aria-hidden
    />
  );
}

export function MicControls({
  state,
  error,
  busy,
  onStart,
  onStop,
}: MicControlsProps) {
  const active =
    state === "listening" ||
    state === "connecting" ||
    state === "reconnecting" ||
    state === "requesting-mic";

  return (
    <span className="inline-flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="secondary"
        onClick={active ? onStop : onStart}
        disabled={busy}
      >
        {active ? "Stop mic" : "Start mic"}
      </Button>
      <span className="inline-flex items-center gap-2">
        <StatusDot state={state} />
        {LABELS[state]}
      </span>
      {error ? (
        <span className="max-w-xs truncate text-[#0A0A0A]" title={error}>
          {error}
        </span>
      ) : null}
    </span>
  );
}
