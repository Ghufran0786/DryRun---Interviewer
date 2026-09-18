import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import type { Session } from "@prisma/client";
import Link from "next/link";

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
  return (
    <ul className="divide-y divide-[#E5E5E5] rounded-[6px] border border-[#E5E5E5] bg-white">
      {sessions.map((session) => {
        const href =
          session.status === "completed"
            ? `/report/${session.id}`
            : `/interview/${session.id}`;
        return (
          <li key={session.id}>
            <Link
              href={href}
              className="flex flex-wrap items-center gap-3 px-4 py-4 transition-colors hover:bg-[#F2F2F2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#0A0A0A]"
            >
              <span className="flex items-center gap-2 min-w-0 flex-1">
                {statusDot(session.status === "completed")}
                <span className="truncate font-medium text-[#0A0A0A]">
                  {session.title}
                </span>
              </span>
              <span className="text-sm text-[#6B6B6B] truncate max-w-[200px]">
                {session.problem}
              </span>
              <Badge>{session.targetLevel}</Badge>
              <span className="text-xs uppercase tracking-wide text-[#6B6B6B]">
                {session.status}
              </span>
              <span className="text-sm text-[#6B6B6B] tabular-nums">
                {formatDateTime(session.createdAt)}
              </span>
              {session.verdict ? (
                <span className="text-sm font-medium text-[#0A0A0A]">
                  {session.verdict}
                </span>
              ) : null}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
