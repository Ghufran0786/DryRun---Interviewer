export function formatTsMs(tsMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(tsMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatTsMsCompact(tsMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(tsMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}${String(seconds).padStart(2, "0")}`;
}

type TranscriptEntryRow = {
  role: string;
  kind: string | null;
  text: string;
  tsMs: number;
  suppressed: boolean;
};

export function formatTranscriptLine(entry: TranscriptEntryRow): string {
  const kindSuffix = entry.kind ? `(${entry.kind})` : "";
  return `[${formatTsMs(entry.tsMs)}] ${entry.role}${kindSuffix}: ${entry.text}`;
}

export function visibleTranscriptLines(entries: TranscriptEntryRow[]): string[] {
  return entries
    .filter((entry) => !entry.suppressed)
    .sort((left, right) => left.tsMs - right.tsMs)
    .map((entry) => formatTranscriptLine(entry));
}
