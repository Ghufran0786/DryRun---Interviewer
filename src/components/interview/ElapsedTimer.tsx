"use client";

import { formatDurationMs } from "@/lib/format";
import { useEffect, useState } from "react";

type ElapsedTimerProps = {
  startedAtMs: number;
};

export function ElapsedTimer({ startedAtMs }: ElapsedTimerProps) {
  // Start at a deterministic value for SSR hydration; the effect immediately
  // replaces it with the canonical startedAt-based duration in the browser.
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const tick = () => {
      setElapsedMs(Math.max(0, Date.now() - startedAtMs));
    };
    const initialTick = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(initialTick);
      window.clearInterval(id);
    };
  }, [startedAtMs]);

  return (
    <span
      className="inline-block min-w-[4.5rem] text-right font-mono text-sm tabular-nums text-foreground"
    >
      {formatDurationMs(elapsedMs)}
    </span>
  );
}
