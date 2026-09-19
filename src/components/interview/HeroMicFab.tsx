"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import type { DeepgramState } from "@/hooks/useDeepgramLive";

type HeroMicFabProps = {
  state: DeepgramState;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
};

function isMicLive(state: DeepgramState): boolean {
  return (
    state === "listening" ||
    state === "connecting" ||
    state === "reconnecting" ||
    state === "requesting-mic"
  );
}

const STATUS_LABEL: Record<DeepgramState, string> = {
  idle: "Mic off",
  "requesting-mic": "Requesting mic",
  connecting: "Connecting",
  listening: "Live · Listening",
  reconnecting: "Reconnecting",
  stopped: "Mic off",
  error: "Mic error",
};

function EqBars() {
  return (
    <div
      className="flex h-5 w-4 shrink-0 items-end justify-center gap-0.5"
      aria-hidden
    >
      <span className="voice-eq-bar h-2.5 w-0.5 rounded-full bg-foreground" />
      <span className="voice-eq-bar h-4 w-0.5 rounded-full bg-foreground" />
      <span className="voice-eq-bar h-2 w-0.5 rounded-full bg-foreground" />
      <span className="voice-eq-bar h-3 w-0.5 rounded-full bg-foreground" />
    </div>
  );
}

export function HeroMicFab({ state, busy, onStart, onStop }: HeroMicFabProps) {
  const live = isMicLive(state);
  const listening = state === "listening";

  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-1.5">
        {listening ? <EqBars /> : <span className="w-4 shrink-0" aria-hidden />}
        <div
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden sm:h-16 sm:w-16"
        >
          {listening ? (
            <>
              <span
                className="pointer-events-none absolute inset-0 m-auto h-14 w-14 rounded-full border border-foreground/10 mic-listen-pulse sm:h-[60px] sm:w-[60px]"
                aria-hidden
              />
              <span
                className="pointer-events-none absolute inset-0 m-auto h-[52px] w-[52px] rounded-full bg-foreground/[0.06] sm:h-[56px] sm:w-[56px]"
                aria-hidden
              />
            </>
          ) : null}
          <button
            type="button"
            aria-label={live ? "Stop microphone" : "Start microphone"}
            disabled={busy}
            onClick={live ? onStop : onStart}
            className={`relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-foreground text-white shadow-md transition-transform hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50 sm:h-[60px] sm:w-[60px] ${
              listening ? "ring-4 ring-foreground/20" : ""
            }`}
          >
            <MaterialIcon
              name={live ? "mic" : "mic_off"}
              className="text-[26px] sm:text-[28px]"
            />
          </button>
        </div>
        {listening ? <EqBars /> : <span className="w-4 shrink-0" aria-hidden />}
      </div>
      <span
        className={`mt-0.5 text-center text-[0.625rem] font-medium uppercase tracking-widest sm:text-[0.6875rem] ${
          listening ? "font-bold text-foreground" : "text-muted"
        }`}
      >
        {STATUS_LABEL[state]}
      </span>
    </div>
  );
}
