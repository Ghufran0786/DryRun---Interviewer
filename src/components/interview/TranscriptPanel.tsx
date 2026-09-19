"use client";

import type { TranscriptFinal } from "@/components/transcript/TranscriptStore";
import { formatDurationMs } from "@/lib/format";
import { useEffect, useRef, useState } from "react";

type TranscriptPanelProps = {
  finals: TranscriptFinal[];
  interim: string;
  lastUtteranceAt: number | null;
};

const PIN_THRESHOLD_PX = 32;
const FLASH_MS = 2000;

export function TranscriptPanel({
  finals,
  interim,
  lastUtteranceAt,
}: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);
  const [showSuppressed, setShowSuppressed] = useState(false);
  const [flashVisible, setFlashVisible] = useState(false);

  useEffect(() => {
    if (lastUtteranceAt === null) {
      return;
    }
    const show = window.setTimeout(() => setFlashVisible(true), 0);
    const hide = window.setTimeout(() => setFlashVisible(false), FLASH_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(hide);
    };
  }, [lastUtteranceAt]);

  useEffect(() => {
    const node = scrollRef.current;
    if (node && pinnedRef.current) {
      node.scrollTop = node.scrollHeight;
    }
  }, [finals, interim]);

  const suppressedCount = finals.filter((entry) => entry.suppressed).length;
  const visible = showSuppressed
    ? finals
    : finals.filter((entry) => !entry.suppressed);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Transcript
        </span>
        <span className="flex items-center gap-3">
          {flashVisible ? (
            <span className="text-[11px] text-muted">utterance ✓</span>
          ) : null}
          {suppressedCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowSuppressed((prev) => !prev)}
              className="text-[11px] uppercase tracking-wider text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              {showSuppressed ? "Hide" : "Show"} suppressed ({suppressedCount})
            </button>
          ) : null}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const node = event.currentTarget;
          pinnedRef.current =
            node.scrollHeight - node.scrollTop - node.clientHeight <
            PIN_THRESHOLD_PX;
        }}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto"
      >
        {visible.length === 0 && interim.length === 0 ? (
          <p className="text-sm text-muted">
            Start the mic and speak — finalized segments appear here with
            timestamps.
          </p>
        ) : null}

        {visible.map((entry) => (
          <p key={entry.id} className="text-sm leading-relaxed text-foreground">
            <span className="mr-2 tabular-nums text-xs text-muted">
              [{formatDurationMs(entry.tsMs)}]
            </span>
            {entry.suppressed ? (
              <span className="mr-1 text-xs uppercase tracking-wide text-muted">
                suppressed
              </span>
            ) : null}
            {entry.text}
          </p>
        ))}

        {interim.length > 0 ? (
          <p className="text-sm italic leading-relaxed text-muted">
            {interim}
          </p>
        ) : null}
      </div>
    </div>
  );
}
