"use client";

import { formatDateTime } from "@/lib/format";
import { useSyncExternalStore } from "react";

/** Avoids SSR/client Intl locale hydration mismatches on session dates. */
export function ClientDateTime({ date }: { date: Date }) {
  const text = useSyncExternalStore(
    () => () => {},
    () => formatDateTime(date),
    () => "",
  );

  return (
    <span suppressHydrationWarning className="tabular-nums">
      {text || "\u00a0"}
    </span>
  );
}
