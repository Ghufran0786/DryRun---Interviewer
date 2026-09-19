"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDateTime } from "@/lib/format";
import type { Session } from "@prisma/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SessionListProps = {
  sessions: Session[];
};

function statusDot(filled: boolean) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${
        filled ? "bg-[#0A0A0A]" : "border border-[#0A0A0A] bg-transparent"
      }`}
      aria-hidden
    />
  );
}

export function SessionList({ sessions }: SessionListProps) {
  const router = useRouter();
  const [pendingDelete, setPendingDelete] = useState<Session | null>(null);
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
            ? `Delete “${pendingDelete.title}”?`
            : "Delete interview?"
        }
        description="This permanently removes the interview, transcript, snapshots, and evaluation from your machine. This cannot be undone."
        confirmLabel="Delete interview"
        confirming={pendingDelete !== null && deletingId === pendingDelete.id}
        onConfirm={() => void confirmDelete()}
        onCancel={() => {
          if (!deletingId) {
            setPendingDelete(null);
          }
        }}
      />
      {error ? (
        <p className="rounded-[6px] border border-[#E5E5E5] bg-white px-4 py-3 text-sm text-[#0A0A0A]">
          {error}
        </p>
      ) : null}
      <ul className="divide-y divide-[#E5E5E5] rounded-[6px] border border-[#E5E5E5] bg-white">
        {sessions.map((session) => {
          const href =
            session.status === "completed"
              ? `/report/${session.id}`
              : `/interview/${session.id}`;
          const isDeleting = deletingId === session.id;
          return (
            <li key={session.id} className="flex items-stretch gap-2">
              <Link
                href={href}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-3 px-4 py-4 transition-colors hover:bg-[#F2F2F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0A0A0A]"
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {statusDot(session.status === "completed")}
                  <span className="truncate font-medium text-[#0A0A0A]">
                    {session.title}
                  </span>
                </span>
                <span className="max-w-[200px] truncate text-sm text-[#6B6B6B]">
                  {session.problem}
                </span>
                <Badge>{session.targetLevel}</Badge>
                <span className="text-xs uppercase tracking-wide text-[#6B6B6B]">
                  {session.status}
                </span>
                <span className="tabular-nums text-sm text-[#6B6B6B]">
                  {formatDateTime(session.createdAt)}
                </span>
                {session.verdict ? (
                  <span className="text-sm font-medium text-[#0A0A0A]">
                    {session.verdict}
                  </span>
                ) : null}
              </Link>
              <div className="flex shrink-0 items-center pr-3">
                <Button
                  type="button"
                  variant="secondary"
                  className="text-xs"
                  disabled={isDeleting}
                  onClick={() => setPendingDelete(session)}
                  aria-label={`Delete ${session.title}`}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
