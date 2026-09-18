export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDurationMs(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function sessionDurationMs(
  startedAt: Date | null,
  endedAt: Date | null,
): number | null {
  if (!startedAt) {
    return null;
  }
  const end = endedAt ?? new Date();
  return end.getTime() - startedAt.getTime();
}
