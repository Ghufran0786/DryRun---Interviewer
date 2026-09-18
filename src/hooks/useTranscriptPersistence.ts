"use client";

import type { TranscriptFinal } from "@/components/transcript/TranscriptStore";
import { useCallback, useEffect, useRef } from "react";

const RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 5;

type QueueItem = {
  entry: TranscriptFinal;
  attempts: number;
};

type PersistOutcome = {
  outcome: "persisted" | "dropped" | "retry";
  entry?: TranscriptFinal;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export type TranscriptPersistence = {
  enqueue: (entry: TranscriptFinal) => void;
  flush: () => Promise<void>;
  droppedCount: () => number;
};

export function useTranscriptPersistence(
  sessionId: string,
  onPersisted?: (entry: TranscriptFinal) => void,
): TranscriptPersistence {
  const queueRef = useRef<QueueItem[]>([]);
  const runningRef = useRef<Promise<void> | null>(null);
  const droppedRef = useRef(0);
  const unmountedRef = useRef(false);
  const onPersistedRef = useRef(onPersisted);

  useEffect(() => {
    onPersistedRef.current = onPersisted;
  }, [onPersisted]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const postEntry = useCallback(
    async (
      entry: TranscriptFinal,
    ): Promise<PersistOutcome> => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/transcript`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: entry.role,
            text: entry.text,
            tsMs: entry.tsMs,
            suppressed: entry.suppressed,
          }),
        });
        // 4xx means the payload will never be accepted; retrying cannot help.
        if (response.status >= 400 && response.status < 500) {
          droppedRef.current += 1;
          return { outcome: "dropped" };
        }
        if (!response.ok) return { outcome: "retry" };
        const persisted: unknown = await response.json();
        if (!persisted || typeof persisted !== "object") {
          return { outcome: "retry" };
        }
        const row = persisted as Record<string, unknown>;
        if (
          typeof row.id !== "string" ||
          (row.role !== "candidate" &&
            row.role !== "interviewer" &&
            row.role !== "system") ||
          typeof row.text !== "string" ||
          typeof row.tsMs !== "number" ||
          typeof row.suppressed !== "boolean"
        ) {
          return { outcome: "retry" };
        }
        return {
          outcome: "persisted",
          entry: {
            id: row.id,
            role: row.role,
            kind: null,
            text: row.text,
            tsMs: row.tsMs,
            suppressed: row.suppressed,
            source: "database",
          },
        };
      } catch {
        return { outcome: "retry" };
      }
    },
    [sessionId],
  );

  const drain = useCallback(async (): Promise<void> => {
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      const result = await postEntry(item.entry);
      if (result.outcome !== "retry") {
        queueRef.current.shift();
        if (result.outcome === "persisted" && result.entry) {
          onPersistedRef.current?.(result.entry);
        }
        continue;
      }
      item.attempts += 1;
      if (item.attempts >= MAX_ATTEMPTS) {
        droppedRef.current += 1;
        queueRef.current.shift();
        continue;
      }
      if (unmountedRef.current) {
        return;
      }
      await delay(RETRY_DELAY_MS);
    }
  }, [postEntry]);

  const flush = useCallback((): Promise<void> => {
    if (!runningRef.current) {
      runningRef.current = drain().finally(() => {
        runningRef.current = null;
      });
    }
    return runningRef.current;
  }, [drain]);

  const enqueue = useCallback(
    (entry: TranscriptFinal) => {
      queueRef.current.push({ entry, attempts: 0 });
      void flush();
    },
    [flush],
  );

  const droppedCount = useCallback(() => droppedRef.current, []);

  return { enqueue, flush, droppedCount };
}
