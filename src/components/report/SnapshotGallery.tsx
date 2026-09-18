"use client";

import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { useState } from "react";

export type SnapshotGalleryItem = {
  id: string;
  capturedAt: Date;
  trigger: string;
  digest: string;
};

type SnapshotGalleryProps = {
  snapshots: SnapshotGalleryItem[];
};

export function SnapshotGallery({ snapshots }: SnapshotGalleryProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (snapshots.length === 0) {
    return (
      <p className="text-sm text-[#6B6B6B]">No whiteboard snapshots for this session.</p>
    );
  }

  return (
    <ul className="grid gap-6 sm:grid-cols-2">
      {snapshots.map((snap) => {
        const open = expandedId === snap.id;
        return (
          <li
            key={snap.id}
            className="rounded-[6px] border border-[#E5E5E5] bg-white overflow-hidden"
          >
            <a href={`/api/snapshots/${snap.id}/png`} target="_blank" rel="noreferrer">
              <img
                src={`/api/snapshots/${snap.id}/png`}
                alt={`Snapshot ${formatDateTime(snap.capturedAt)}`}
                className="w-full border-b border-[#E5E5E5] bg-[#FAFAFA] object-contain max-h-48"
              />
            </a>
            <div className="p-4 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B6B6B]">
                <span className="tabular-nums">{formatDateTime(snap.capturedAt)}</span>
                <Badge filled={snap.trigger === "final"}>{snap.trigger}</Badge>
              </div>
              <button
                type="button"
                className="text-xs font-medium uppercase tracking-wider text-[#0A0A0A] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0A0A0A]"
                onClick={() => setExpandedId(open ? null : snap.id)}
              >
                {open ? "Hide digest" : "Show digest"}
              </button>
              {open ? (
                <pre
                  className="whitespace-pre-wrap rounded-[6px] border border-[#E5E5E5] bg-[#FAFAFA] p-3 text-xs text-[#0A0A0A] font-mono"
                >
                  {snap.digest || "(empty digest)"}
                </pre>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
