import type { SnapshotLike } from "@/lib/evaluation/assemble";
import { formatTsMs } from "@/lib/report/transcriptFormat";

export type PdfDiagramSnapshot = {
  id: string;
  pngPath: string;
  trigger: string;
  tsMs: number;
  caption: string;
};

function snapshotElapsedMs(
  snapshot: SnapshotLike,
  startedAt: Date | null,
): number {
  if (!startedAt) {
    return snapshot.capturedAt.getTime();
  }
  return Math.max(0, snapshot.capturedAt.getTime() - startedAt.getTime());
}

export function selectPdfDiagramSnapshots(
  snapshots: SnapshotLike[],
  startedAt: Date | null,
  maxAdditional = 4,
): PdfDiagramSnapshot[] {
  const ordered = [...snapshots].sort(
    (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime(),
  );
  if (ordered.length === 0) {
    return [];
  }

  const final =
    ordered.find((snapshot) => snapshot.trigger === "final") ??
    ordered[ordered.length - 1];

  const toDiagram = (snapshot: SnapshotLike): PdfDiagramSnapshot => {
    const tsMs = snapshotElapsedMs(snapshot, startedAt);
    return {
      id: snapshot.id,
      pngPath: snapshot.pngPath,
      trigger: snapshot.trigger,
      tsMs,
      caption: `[${formatTsMs(tsMs)}] · ${snapshot.trigger}`,
    };
  };

  const selected: PdfDiagramSnapshot[] = [toDiagram(final)];
  for (const snapshot of ordered) {
    if (snapshot.id === final.id) {
      continue;
    }
    if (selected.length >= 1 + maxAdditional) {
      break;
    }
    selected.push(toDiagram(snapshot));
  }
  return selected;
}
