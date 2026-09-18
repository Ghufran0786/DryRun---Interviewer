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
        Snapshots: <span className="font-medium text-[#0A0A0A]">{count}</span>
      </span>
      {lastCaptureAt ? (
        <span>
          Last capture{" "}
          <span className="font-medium text-[#0A0A0A]">
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
