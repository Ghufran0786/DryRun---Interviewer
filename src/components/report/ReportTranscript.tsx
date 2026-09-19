import { formatDurationMs } from "@/lib/format";

export type ReportTranscriptEntry = {
  id: string;
  role: string;
  text: string;
  tsMs: number;
  suppressed: boolean;
};

type ReportTranscriptProps = {
  entries: ReportTranscriptEntry[];
};

export function ReportTranscript({ entries }: ReportTranscriptProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted">
        No transcript was recorded for this session.
      </p>
    );
  }

  return (
    <ol className="space-y-2 rounded-[6px] border border-border bg-white p-6">
      {entries.map((entry) => (
        <li key={entry.id} className="text-sm leading-relaxed text-foreground">
          <span className="mr-2 tabular-nums text-xs text-muted">
            [{formatDurationMs(entry.tsMs)}]
          </span>
          <span className="mr-2 text-xs uppercase tracking-wide text-muted">
            {entry.role}
            {entry.suppressed ? " · suppressed" : ""}
          </span>
          {entry.text}
        </li>
      ))}
    </ol>
  );
}
