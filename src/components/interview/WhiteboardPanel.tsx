"use client";

import type { ScenePayload } from "@/lib/scenePayload";
import { serializeScenePayload } from "@/lib/scenePayload";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFiles } from "@excalidraw/excalidraw/types";
import { useCallback, useEffect, useRef } from "react";

const SCENE_AUTOSAVE_MS = 2000;

export type WhiteboardPanelProps = {
  sessionId: string;
  readOnly: boolean;
  initialScene: ScenePayload | null;
  onApiReady: (api: ExcalidrawImperativeAPI) => void;
  onElementsChange: (elements: readonly ExcalidrawElement[]) => void;
};

export default function WhiteboardPanel({
  sessionId,
  readOnly,
  initialScene,
  onApiReady,
  onElementsChange,
}: WhiteboardPanelProps) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestPayloadRef = useRef<ScenePayload | null>(null);

  const persistScene = useCallback(async () => {
    const payload = latestPayloadRef.current;
    if (!payload || readOnly) {
      return;
    }
    await fetch(`/api/sessions/${sessionId}/scene`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: serializeScenePayload(payload),
    });
  }, [readOnly, sessionId]);

  const handleChange = useCallback(
    (
      elements: readonly ExcalidrawElement[],
      _appState: unknown,
      files: BinaryFiles,
    ) => {
      latestPayloadRef.current = {
        elements: [...elements],
        files: { ...files },
      };
      onElementsChange(elements);

      if (readOnly) {
        return;
      }

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        void persistScene();
      }, SCENE_AUTOSAVE_MS);
    },
    [onElementsChange, persistScene, readOnly],
  );

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  const initialData = {
    elements: (initialScene?.elements ?? []) as ExcalidrawElement[],
    files: (initialScene?.files ?? {}) as BinaryFiles,
    appState: {
      viewBackgroundColor: "#ffffff",
    },
  };

  return (
    <div className="h-full min-h-0 w-full flex-1">
      <Excalidraw
        theme="light"
        viewModeEnabled={readOnly}
        initialData={initialData}
        excalidrawAPI={(api) => {
          onApiReady(api);
        }}
        onChange={handleChange}
      />
    </div>
  );
}
