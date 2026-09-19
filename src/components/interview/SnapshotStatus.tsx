"use client";

import { formatDurationMs } from "@/lib/format";
import { useEffect, useState } from "react";

type SnapshotStatusProps = {
  count: number;
  lastCaptureAt: Date | null;
};

export function SnapshotStatus({ count, lastCaptureAt }: SnapshotStatusProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const agoMs = lastCaptureAt ? nowMs - lastCaptureAt.getTime() : null;

  return (
    <span className="inline-flex items-center gap-3 tabular-nums">
      <span>
        Snapshots: <span className="font-medium text-foreground">{count}</span>
      </span>
      {lastCaptureAt ? (
        <span>
          Last capture{" "}
          <span className="font-medium text-foreground">
            {agoMs !== null ? formatDurationMs(agoMs) : "—"}
          </span>{" "}
          ago
        </span>
      ) : (
        <span>No captures yet</span>
      )}
    </span>
  );
}
