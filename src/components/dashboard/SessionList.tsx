"use client";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { ClientDateTime } from "@/components/ui/ClientDateTime";
import { formatDurationMs, sessionDurationMs } from "@/lib/format";
import type { Session } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export type SessionWithCounts = Session & {
  _count: { snapshots: number };
};

type SessionListProps = {
  sessions: SessionWithCounts[];
};

function StatusMarker({ status }: { status: Session["status"] }) {
  if (status === "active") {
    return (
      <span className="relative flex h-2.5 w-2.5 shrink-0 items-center justify-center">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full bg-white ring-2 ring-foreground"
          aria-hidden
        />
        <span className="absolute -inset-1 animate-ping rounded-full bg-foreground/20" />
      </span>
    );
  }
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-foreground"
      title={status === "completed" ? "Completed" : "Created"}
      aria-hidden
    />
  );
}

export function SessionList({ sessions }: SessionListProps) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<SessionWithCounts | null>(
    null,
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!pendingDelete) {
      return;
    }
    const session = pendingDelete;
    setDeletingId(session.id);
    setError(null);
    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "DELETE",
      });
      if (!response.ok && response.status !== 204) {
        const payload: unknown = await response.json().catch(() => ({}));
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as Record<string, unknown>).error === "string"
            ? String((payload as Record<string, unknown>).error)
            : `Delete failed (HTTP ${response.status})`;
        throw new Error(message);
      }
      setPendingDelete(null);
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Failed to delete session",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <ConfirmDialog
        open={pendingDelete !== null}
        title={
          pendingDelete
            ? `Delete ‘${pendingDelete.title}’?`
            : "Delete interview?"
        }
        description="Are you sure you want to permanently delete this interview session? This will erase all whiteboard diagrams, time-stamped transcript logs, snapshots, and the post-interview evaluation report. This action cannot be undone."
        confirmLabel="Delete interview"
        confirming={pendingDelete !== null && deletingId === pendingDelete.id}
        meta={
          pendingDelete
            ? {
                sessionId: pendingDelete.id,
                level: pendingDelete.targetLevel,
                durationLabel: formatDurationLabel(pendingDelete),
                snapshotCount: pendingDelete._count.snapshots,
              }
            : undefined
        }
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deletingId) {
            setPendingDelete(null);
          }
        }}
      />
      {error ? (
        <p className="rounded border border-border bg-white px-4 py-3 text-sm text-foreground">
          {error}
        </p>
      ) : null}
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[0.6875rem] font-medium uppercase tracking-widest text-muted">
          Past sessions ({sessions.length})
        </p>
        <p className="font-mono text-[0.8125rem] text-muted">
          LOCAL REPOSITORY · ./data/dryrun.db
        </p>
      </div>
      <div className="overflow-hidden rounded bg-white shadow-sm">
        {sessions.map((session, index) => {
          const href =
            session.status === "completed"
              ? `/report/${session.id}`
              : `/interview/${session.id}`;
          const isDeleting = deletingId === session.id;
          const durationMs = sessionDurationMs(
            session.startedAt,
            session.endedAt,
          );
          const rowBg =
            session.status === "active"
              ? "bg-border"
              : "bg-white hover:bg-hover";

          return (
            <div key={session.id}>
              {index > 0 ? (
                <div className="h-px w-full bg-hover" aria-hidden />
              ) : null}
              <div
                className={`group flex flex-col justify-between gap-4 p-4 transition-colors lg:flex-row lg:items-center ${rowBg}`}
              >
                <div className="flex min-w-0 items-start gap-4">
                  <div className="pt-1">
                    <StatusMarker status={session.status} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-semibold text-foreground">
                        {session.title}
                      </h2>
                      <span className="rounded bg-hover px-1.5 py-0.5 font-mono text-[0.8125rem] uppercase tracking-wider text-foreground">
                        {session.targetLevel}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 font-mono text-[0.8125rem] uppercase tracking-wider ${
                          session.status === "active"
                            ? "bg-foreground text-white"
                            : "bg-hover text-muted"
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>
                    <p className="max-w-2xl truncate text-[0.8125rem] text-muted">
                      {session.problem}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 pt-0.5 font-mono text-[0.8125rem] text-muted">
                      <span className="flex items-center gap-1">
                        <MaterialIcon
                          name="calendar_today"
                          className="text-[14px]"
                        />
                        <ClientDateTime date={session.createdAt} />
                        {durationMs !== null
                          ? ` · ${formatDurationMs(durationMs)}`
                          : null}
                      </span>
                      <span className="hidden items-center gap-1 sm:flex">
                        <MaterialIcon name="draw" className="text-[14px]" />
                        {session._count.snapshots} snapshots
                      </span>
                      <span className="tabular-nums">
                        {session.promptTokens + session.completionTokens} tok
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 self-end lg:self-center">
                  {session.verdict ? (
                    <span className="rounded bg-background px-2 py-1 font-mono text-[0.8125rem] uppercase tracking-wider text-muted">
                      {session.verdict}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="rounded bg-background px-3 py-1.5 text-[0.8125rem] text-foreground transition-colors hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:opacity-50"
                    disabled={isDeleting}
                    onClick={() => setPendingDelete(session)}
                  >
                    {isDeleting ? "Deleting…" : "Delete"}
                  </button>
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 rounded bg-foreground px-3 py-1.5 text-[0.8125rem] font-medium text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
                  >
                    {session.status === "completed" ? (
                      <>
                        <span>View report</span>
                        <MaterialIcon
                          name="arrow_forward"
                          className="text-[16px]"
                        />
                      </>
                    ) : (
                      <>
                        <MaterialIcon
                          name="play_arrow"
                          className="text-[16px]"
                        />
                        <span>Resume interview</span>
                      </>
                    )}
                  </Link>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDurationLabel(session: Session): string | undefined {
  const ms = sessionDurationMs(session.startedAt, session.endedAt);
  if (ms === null && session.status === "active" && session.startedAt) {
    const elapsed = Date.now() - session.startedAt.getTime();
    return `${formatDurationMs(elapsed)} elapsed`;
  }
  return ms !== null ? formatDurationMs(ms) : undefined;
}
