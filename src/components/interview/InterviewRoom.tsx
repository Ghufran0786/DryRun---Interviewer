"use client";

import { ElapsedTimer } from "@/components/interview/ElapsedTimer";
import { InterviewerPanel } from "@/components/interview/InterviewerPanel";
import { InterviewControlDock } from "@/components/interview/InterviewControlDock";
import { PhaseStepper } from "@/components/interview/PhaseStepper";
import { TranscriptPanel } from "@/components/interview/TranscriptPanel";
import {
  useTranscriptStore,
  type TranscriptFinal,
} from "@/components/transcript/TranscriptStore";
import { SiteChrome } from "@/components/layout/SiteChrome";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { useDeepgramLive } from "@/hooks/useDeepgramLive";
import type { UtteranceTiming } from "@/hooks/useDeepgramLive";
import { useInterviewerLoop } from "@/hooks/useInterviewerLoop";
import { useInterviewerVoice } from "@/hooks/useInterviewerVoice";
import { useSnapshotCapture } from "@/hooks/useSnapshotCapture";
import { useTranscriptPersistence } from "@/hooks/useTranscriptPersistence";
import type { InterviewPhase } from "@/lib/interviewPhases";
import type { ScenePayload } from "@/lib/scenePayload";
import { digestElements } from "@/lib/sceneDigest";
import type { TargetLevel } from "@/lib/types";
import type { TranscriptKind } from "@/lib/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";

const WhiteboardPanel = dynamic(
  () => import("@/components/interview/WhiteboardPanel"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-muted">
        Loading whiteboard…
      </div>
    ),
  },
);

export type InterviewRoomProps = {
  sessionId: string;
  title: string;
  targetLevel: TargetLevel;
  interviewerModel: string;
  keyterms: string;
  interviewDurationMin: number;
  ttsEnabled: boolean;
  usingHeadphones: boolean;
  currentPhase: InterviewPhase;
  status: string;
  startedAtMs: number;
  initialScene: ScenePayload | null;
};

/** Imperative Excalidraw API — Phase 4/5 attach vision and interviewer logic here. */
export type InterviewRoomExcalidrawRef = RefObject<ExcalidrawImperativeAPI | null>;

type PersistedTranscriptEntry = {
  id: string;
  role: "candidate" | "interviewer" | "system";
  kind: TranscriptKind | null;
  trigger?: string | null;
  text: string;
  tsMs: number;
  suppressed: boolean;
};

export function InterviewRoom({
  sessionId,
  title,
  targetLevel,
  interviewerModel,
  keyterms,
  interviewDurationMin,
  ttsEnabled: initialTtsEnabled,
  usingHeadphones,
  currentPhase: initialCurrentPhase,
  status,
  startedAtMs,
  initialScene,
}: InterviewRoomProps) {
  const router = useRouter();
  const [tab, setTab] = useState("transcript");
  const [ending, setEnding] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [micBusy, setMicBusy] = useState(false);
  const [snapshotCount, setSnapshotCount] = useState(0);
  const [lastUtteranceAt, setLastUtteranceAt] = useState<number | null>(null);
  const [ttsEnabled, setTtsEnabled] = useState(initialTtsEnabled);
  const [voicePreferenceError, setVoicePreferenceError] =
    useState<string | null>(null);

  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  const {
    finals,
    interim,
    interviewerSpeaking,
    dispatch,
    setInterviewerSpeaking,
  } =
    useTranscriptStore();
  const interviewerSpeakingRef = useRef(interviewerSpeaking);
  const submitRealUtteranceRef = useRef<
    (text: string, tsMs: number, timing: UtteranceTiming) => void
  >(() => {});
  const candidatePersistedRef = useRef<(entry: TranscriptFinal) => void>(
    () => {},
  );
  useEffect(() => {
    interviewerSpeakingRef.current = interviewerSpeaking;
  }, [interviewerSpeaking]);
  const handleSpeakingChange = useCallback(
    (speaking: boolean) => {
      interviewerSpeakingRef.current = speaking;
      setInterviewerSpeaking(speaking);
    },
    [setInterviewerSpeaking],
  );

  const interviewerVoice = useInterviewerVoice({
    enabled: ttsEnabled,
    usingHeadphones,
    onSpeakingChange: handleSpeakingChange,
  });
  const observeVoiceInterim = interviewerVoice.observeInterim;
  const enqueueVoice = interviewerVoice.enqueue;

  const handlePersistedEntry = useCallback((entry: TranscriptFinal) => {
    candidatePersistedRef.current(entry);
  }, []);
  const { enqueue, flush } = useTranscriptPersistence(
    sessionId,
    handlePersistedEntry,
  );

  const onSnapshotRecorded = useCallback(
    (meta: { capturedAt: Date; count: number }) => {
      setSnapshotCount(meta.count);
    },
    [],
  );

  const {
    handleElementsChange,
    manualCapture,
    finalCaptureIfNeeded,
    captureForVision,
  } =
    useSnapshotCapture({
      sessionId,
      apiRef: excalidrawApiRef,
      readOnly: false,
      onSnapshotRecorded,
    });

  const handleInterim = useCallback(
    (text: string) => {
      observeVoiceInterim(text);
      if (!interviewerSpeakingRef.current) {
        dispatch({ type: "set-interim", text });
      }
    },
    [dispatch, observeVoiceInterim],
  );

  const handleFinal = useCallback(
    (text: string, tsMs: number) => {
      const entry: TranscriptFinal = {
        id: crypto.randomUUID(),
        role: "candidate",
        kind: null,
        text,
        tsMs,
        suppressed: interviewerSpeakingRef.current,
        source: "deepgram",
      };
      dispatch({ type: "append-final", entry });
      enqueue(entry);
    },
    [dispatch, enqueue],
  );

  const handleUtteranceEnd = useCallback(
    (text: string, tsMs: number, timing: UtteranceTiming) => {
      setLastUtteranceAt(Date.now());
      if (!interviewerSpeakingRef.current) {
        submitRealUtteranceRef.current(text, tsMs, timing);
      }
    },
    [],
  );

  const {
    state: micState,
    error: micError,
    diagnostics: sttDiagnostics,
    connectionSummary,
    start: startMic,
    stop: stopMic,
  } = useDeepgramLive({
    startedAtMs,
    keyterms,
    shouldSuppressTranscript: () => interviewerSpeakingRef.current,
    onInterim: handleInterim,
    onFinal: handleFinal,
    onUtteranceEnd: handleUtteranceEnd,
  });

  const getSceneDigest = useCallback(() => {
    const api = excalidrawApiRef.current;
    return api ? digestElements(api.getSceneElements()) : "";
  }, []);

  const persistInjectedCandidate = useCallback(
    (text: string, tsMs: number) => {
      const entry: TranscriptFinal = {
        id: crypto.randomUUID(),
        role: "candidate",
        kind: null,
        text,
        tsMs,
        suppressed: false,
        source: "deepgram",
      };
      dispatch({ type: "append-final", entry });
      enqueue(entry);
    },
    [dispatch, enqueue],
  );

  const appendInterviewerEntry = useCallback(
    (entry: TranscriptFinal) => {
      dispatch({ type: "append-final", entry });
      if (entry.role === "interviewer") {
        enqueueVoice(entry.id, entry.text);
      }
    },
    [dispatch, enqueueVoice],
  );

  const interviewerLoop = useInterviewerLoop({
    sessionId,
    startedAtMs,
    status,
    initialCurrentPhase,
    interviewDurationMin,
    micState,
    interviewerSpeaking,
    finals,
    getSceneDigest,
    prepareVisionTurn: captureForVision,
    persistInjectedCandidate,
    appendEntry: appendInterviewerEntry,
  });
  const submitInterviewerUtterance = interviewerLoop.submitUtterance;

  useEffect(() => {
    submitRealUtteranceRef.current = (text, tsMs, timing) => {
      submitInterviewerUtterance(text, tsMs, false, timing);
    };
  }, [submitInterviewerUtterance]);

  useEffect(() => {
    candidatePersistedRef.current = interviewerLoop.notifyCandidatePersisted;
  }, [interviewerLoop.notifyCandidatePersisted]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/transcript`);
      if (!res.ok || cancelled) {
        return;
      }
      const entries = (await res.json()) as PersistedTranscriptEntry[];
      dispatch({
        type: "hydrate",
        entries: entries.map((entry) => ({
          ...entry,
          source: "database",
        })),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [dispatch, sessionId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/sessions/${sessionId}/snapshots`);
      if (!res.ok || cancelled) {
        return;
      }
      const list = (await res.json()) as { capturedAt: string }[];
      setSnapshotCount(list.length);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const onApiReady = useCallback((api: ExcalidrawImperativeAPI) => {
    excalidrawApiRef.current = api;
  }, []);

  const onElementsChange = useCallback(
    (elements: readonly ExcalidrawElement[]) => {
      handleElementsChange(elements);
    },
    [handleElementsChange],
  );

  async function handleManualCapture() {
    setCapturing(true);
    try {
      await manualCapture();
    } finally {
      setCapturing(false);
    }
  }

  async function handleStartMic() {
    setMicBusy(true);
    try {
      await startMic();
    } finally {
      setMicBusy(false);
    }
  }

  async function handleStopMic() {
    setMicBusy(true);
    try {
      await stopMic();
      dispatch({ type: "set-interim", text: "" });
      await flush();
    } finally {
      setMicBusy(false);
    }
  }

  async function toggleVoice() {
    const next = !ttsEnabled;
    setVoicePreferenceError(null);
    setTtsEnabled(next);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ttsEnabled: next }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json();
        const message =
          payload &&
          typeof payload === "object" &&
          typeof (payload as Record<string, unknown>).error === "string"
            ? String((payload as Record<string, unknown>).error)
            : "Could not save voice preference";
        throw new Error(message);
      }
    } catch (error) {
      setTtsEnabled(!next);
      setVoicePreferenceError(
        error instanceof Error
          ? error.message
          : "Could not save voice preference",
      );
    }
  }

  async function endInterview() {
    setEnding(true);
    try {
      // Strict order: stop mic → flush transcript → final snapshot → mark completed.
      await stopMic();
      dispatch({ type: "set-interim", text: "" });
      await flush();
      console.table([
        {
          sessionId,
          attempts: connectionSummary.attempts,
          reconnectCount: connectionSummary.reconnectCount,
          closeCodes: connectionSummary.closeCodes,
        },
      ]);
      await finalCaptureIfNeeded();
      const closeCodes =
        connectionSummary.closeCodes === "none"
          ? []
          : connectionSummary.closeCodes
              .split(",")
              .map((code) => Number.parseInt(code.trim(), 10))
              .filter((code) => !Number.isNaN(code));
      const res = await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reconnectCount: connectionSummary.reconnectCount,
          closeCodesJson: closeCodes,
          status: "completed",
        }),
      });
      if (!res.ok) {
        setEnding(false);
        return;
      }
      router.push(`/report/${sessionId}`);
    } catch {
      setEnding(false);
    }
  }

  const tabs = [
    {
      id: "transcript",
      label: "Transcript",
      content: (
        <TranscriptPanel
          finals={finals}
          interim={interim}
          lastUtteranceAt={lastUtteranceAt}
        />
      ),
    },
    {
      id: "interviewer",
      label: "Interviewer",
      content: (
        <InterviewerPanel
          entries={finals}
          thinking={interviewerLoop.thinking}
          error={interviewerLoop.error}
          onRetry={interviewerLoop.retry}
          onBegin={interviewerLoop.beginInterview}
          onAsk={interviewerLoop.askInterviewer}
          onSimulate={interviewerLoop.simulateUtterance}
          voiceEnabled={ttsEnabled}
          voiceStatuses={interviewerVoice.statuses}
          onReplay={interviewerVoice.replay}
          onStopVoice={() => interviewerVoice.stop("manual")}
          diagnostics={[
              ...sttDiagnostics.map((event) => ({
                at: event.at,
                event: `stt:${event.event}`,
                details: event.details,
              })),
              ...interviewerLoop.diagnostics,
              ...interviewerVoice.diagnostics.map((event) => ({
                ...event,
                event: `tts:${event.event}`,
              })),
              {
                at: new Date().toISOString(),
                event: "name-trace-guide",
                details: {
                  upstreamPresentDbMissing:
                    "whitespace-skip > suppressed stamping > flush path > buffer concatenation",
                  upstreamMissing: "keyterms > audio",
                },
              },
              {
                at: new Date().toISOString(),
                event: "stt:connection-events",
                details: { ...connectionSummary },
              },
            ].sort((left, right) => left.at.localeCompare(right.at))}
        />
      ),
    },
  ];

  const runtimeStatus = interviewerSpeaking
    ? "INTERVIEWER SPEAKING"
    : micState === "listening"
      ? "LISTENING"
      : "IDLE · MIC OFF";

  return (
    <SiteChrome
      immersive
      runtimeStatus={runtimeStatus}
      interviewHref={`/interview/${sessionId}`}
    >
    <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <header className="relative z-20 flex shrink-0 flex-wrap items-center gap-2 border-b border-border/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur-sm sm:gap-3 sm:px-4">
        <h1 className="text-sm font-semibold text-foreground">{title}</h1>
        <Badge filled>{targetLevel}</Badge>
        <PhaseStepper
          currentPhase={interviewerLoop.currentPhase}
          onChange={(phase) => void interviewerLoop.overridePhase(phase)}
          disabled={interviewerLoop.thinking}
        />
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={handleManualCapture}
            disabled={capturing || ending}
          >
            {capturing ? "Capturing…" : "Capture"}
          </Button>
          <ElapsedTimer startedAtMs={startedAtMs} />
          <Button
            type="button"
            variant="secondary"
            onClick={endInterview}
            disabled={ending}
          >
            {ending ? "Ending…" : "End interview"}
          </Button>
        </div>
      </header>

      <div className="relative z-10 flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col p-2 sm:p-3">
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[6px] border border-border bg-white"
          >
            <WhiteboardPanel
              sessionId={sessionId}
              readOnly={false}
              initialScene={initialScene}
              onApiReady={onApiReady}
              onElementsChange={onElementsChange}
            />
          </div>
        </main>

        <aside
          className="relative z-10 hidden min-h-0 w-[320px] shrink-0 border-l border-border bg-white/95 backdrop-blur-sm md:flex md:flex-col lg:w-[360px]"
        >
          <Tabs tabs={tabs} activeId={tab} onChange={setTab} />
        </aside>
      </div>

      <InterviewControlDock
        micState={micState}
        micError={micError}
        micBusy={micBusy || ending}
        interviewerSpeaking={interviewerSpeaking}
        ttsEnabled={ttsEnabled}
        interviewerModel={interviewerModel}
        snapshotCount={snapshotCount}
        onStartMic={handleStartMic}
        onStopMic={handleStopMic}
        onToggleVoice={() => void toggleVoice()}
        voicePreferenceError={voicePreferenceError}
      />
    </div>
    </SiteChrome>
  );
}
