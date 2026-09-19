"use client";

import type { DryRunExcalidrawElement } from "@/lib/excalidrawElement";
import {
  isMaterialChange,
  sceneSignature,
  signatureFromElementsJson,
  type SceneSignature,
} from "@/lib/snapshotGate";
import { captureSnapshotFromApi } from "@/lib/snapshotCaptureClient";
import type { SnapshotTrigger } from "@/lib/snapshotStorage";
import { exportBoardForVision } from "@/lib/visionCaptureClient";
import type { PreparedVisionTurn } from "@/lib/visionTurn";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { RefObject } from "react";
import { useCallback, useEffect, useRef } from "react";

const SNAPSHOT_DEBOUNCE_MS = 4000;
const VISION_CAPTURE_BUDGET_MS = 400;

type SnapshotListItem = {
  id: string;
  capturedAt: string;
  trigger: string;
  elementsJson: string;
};

type UseSnapshotCaptureOptions = {
  sessionId: string;
  apiRef: RefObject<ExcalidrawImperativeAPI | null>;
  readOnly: boolean;
  onSnapshotRecorded: (meta: { capturedAt: Date; count: number }) => void;
};

export function useSnapshotCapture({
  sessionId,
  apiRef,
  readOnly,
  onSnapshotRecorded,
}: UseSnapshotCaptureOptions) {
  const lastSnapshotSignatureRef = useRef<SceneSignature | null>(null);
  const lastVisionSignatureRef = useRef<SceneSignature | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapshotCountRef = useRef(0);
  const lastBoardChangeAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (readOnly) {
      return;
    }
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/snapshots`);
      if (!res.ok || cancelled) {
        return;
      }
      const list = (await res.json()) as SnapshotListItem[];
      snapshotCountRef.current = list.length;
      const latest = list[list.length - 1];
      if (latest?.elementsJson) {
        lastSnapshotSignatureRef.current = signatureFromElementsJson(
          latest.elementsJson,
        );
      } else {
        lastSnapshotSignatureRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, readOnly]);

  const runCapture = useCallback(
    async (trigger: SnapshotTrigger): Promise<boolean> => {
      const api = apiRef.current;
      if (!api || readOnly) {
        return false;
      }
      const result = await captureSnapshotFromApi(api, sessionId, trigger);
      if (!result) {
        return false;
      }
      const elements = api.getSceneElements() as readonly DryRunExcalidrawElement[];
      lastSnapshotSignatureRef.current = sceneSignature(elements);
      snapshotCountRef.current += 1;
      const capturedAt = new Date(result.capturedAt);
      lastBoardChangeAtRef.current = capturedAt.getTime();
      onSnapshotRecorded({
        capturedAt,
        count: snapshotCountRef.current,
      });
      return true;
    },
    [apiRef, onSnapshotRecorded, readOnly, sessionId],
  );

  const scheduleAutoCapture = useCallback(
    (elements: readonly DryRunExcalidrawElement[]) => {
      if (readOnly) {
        return;
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        const next = sceneSignature(elements);
        if (!isMaterialChange(lastSnapshotSignatureRef.current, next)) {
          return;
        }
        lastBoardChangeAtRef.current = Date.now();
        void runCapture("auto");
      }, SNAPSHOT_DEBOUNCE_MS);
    },
    [readOnly, runCapture],
  );

  const manualCapture = useCallback(async () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    return runCapture("manual");
  }, [runCapture]);

  const needsFinalCapture = useCallback((): boolean => {
    const api = apiRef.current;
    if (!api) {
      return false;
    }
    const elements = api.getSceneElements() as readonly DryRunExcalidrawElement[];
    const sig = sceneSignature(elements);
    if (sig.count === 0) {
      return false;
    }
    if (snapshotCountRef.current === 0) {
      return true;
    }
    return isMaterialChange(lastSnapshotSignatureRef.current, sig);
  }, [apiRef]);

  const finalCaptureIfNeeded = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (!needsFinalCapture()) {
      return;
    }
    await runCapture("final");
  }, [needsFinalCapture, runCapture]);

  const captureForVision =
    useCallback(async (): Promise<PreparedVisionTurn> => {
      const api = apiRef.current;
      const noCommit = () => {};
      if (!api || readOnly) {
        return {
          payload: { boardChanged: false },
          captureMs: 0,
          imageBytes: 0,
          outcome: "empty",
          commitImageTurn: noCommit,
        };
      }

      const elements =
        api.getSceneElements() as readonly DryRunExcalidrawElement[];
      const nextSignature = sceneSignature(elements);
      if (nextSignature.count === 0) {
        return {
          payload: { boardChanged: false },
          captureMs: 0,
          imageBytes: 0,
          outcome: "empty",
          commitImageTurn: noCommit,
        };
      }
      if (
        !isMaterialChange(lastVisionSignatureRef.current, nextSignature)
      ) {
        return {
          payload: { boardChanged: false },
          captureMs: 0,
          imageBytes: 0,
          outcome: "unchanged",
          commitImageTurn: noCommit,
        };
      }

      const startedAt = performance.now();
      let timeoutId: number | null = null;
      try {
        const result = await Promise.race([
          exportBoardForVision(api).then((image) => ({
            kind: "image" as const,
            image,
          })),
          new Promise<{ kind: "timeout" }>((resolve) => {
            timeoutId = window.setTimeout(
              () => resolve({ kind: "timeout" }),
              VISION_CAPTURE_BUDGET_MS,
            );
          }),
        ]);
        const captureMs = Math.round(performance.now() - startedAt);
        if (result.kind === "timeout") {
          console.debug("[DryRun vision]", {
            event: "capture-skipped",
            reason: "over_400ms",
            captureMs,
          });
          return {
            payload: { boardChanged: true },
            captureMs,
            imageBytes: 0,
            outcome: "timeout",
            commitImageTurn: noCommit,
          };
        }
        return {
          payload: {
            boardChanged: true,
            boardImageBase64: result.image.imageDataUrl,
          },
          captureMs,
          imageBytes: result.image.imageBytes,
          outcome: "image",
          commitImageTurn: () => {
            lastVisionSignatureRef.current = nextSignature;
          },
        };
      } catch (error) {
        const captureMs = Math.round(performance.now() - startedAt);
        console.debug("[DryRun vision]", {
          event: "capture-skipped",
          reason: error instanceof Error ? error.message : "capture_failed",
          captureMs,
        });
        return {
          payload: { boardChanged: true },
          captureMs,
          imageBytes: 0,
          outcome: "error",
          commitImageTurn: noCommit,
        };
      } finally {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      }
    }, [apiRef, readOnly]);

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const getLastBoardChangeAt = useCallback((): number | null => {
    return lastBoardChangeAtRef.current;
  }, []);

  return {
    handleElementsChange: scheduleAutoCapture,
    manualCapture,
    finalCaptureIfNeeded,
    captureForVision,
    getLastBoardChangeAt,
  };
}
