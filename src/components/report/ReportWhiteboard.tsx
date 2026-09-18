"use client";

import type { ScenePayload } from "@/lib/scenePayload";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import dynamic from "next/dynamic";
import { useRef } from "react";

const WhiteboardPanel = dynamic(
  () => import("@/components/interview/WhiteboardPanel"),
  { ssr: false },
);

type ReportWhiteboardProps = {
  sessionId: string;
  initialScene: ScenePayload | null;
};

export function ReportWhiteboard({ sessionId, initialScene }: ReportWhiteboardProps) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  return (
    <div className="h-[420px] overflow-hidden rounded-[6px] border border-[#E5E5E5] bg-white">
      <WhiteboardPanel
        sessionId={sessionId}
        readOnly={true}
        initialScene={initialScene}
        onApiReady={(api) => {
          apiRef.current = api;
        }}
        onElementsChange={() => {
          /* read-only — no persistence or snapshots */
        }}
      />
    </div>
  );
}
