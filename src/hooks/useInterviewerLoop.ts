"use client";

import type { DeepgramState } from "@/hooks/useDeepgramLive";
import type { InterviewPhase } from "@/lib/interviewPhases";
import { isInterviewPhase } from "@/lib/interviewPhases";
import type { TranscriptFinal } from "@/components/transcript/TranscriptStore";
import type { UtteranceTiming } from "@/hooks/useDeepgramLive";
import { elapsedMsSinceSessionStart } from "@/lib/sessionTime";
import type { PreparedVisionTurn } from "@/lib/visionTurn";
import { useCallback, useEffect, useRef, useState } from "react";

type TurnTrigger = "utterance" | "opening" | "stall" | "wrapup" | "manual";

type PendingTurn = {
  trigger: TurnTrigger;
  utteranceText?: string;
  tsMs: number;
  utteranceTiming?: UtteranceTiming;
};

type TurnResponse = {
  entry: Omit<TranscriptFinal, "source">;
  currentPhase: InterviewPhase;
  phaseAdvanced: boolean;
  persistedCandidateThroughTsMs: number;
  timing: TurnTiming;
};

export type TurnTiming = {
  utteranceEndToTimerFireMs: number;
  classifierMs: number;
  generatorMs: number;
  totalUtteranceToReplyMs: number;
  shortcircuit: "question" | null;
  image: boolean;
  imageBytes: number;
};

export type InterviewerLoopDebugEvent = {
  at: string;
  event: string;
  details: Record<string, string | number | boolean | null>;
};

type UseInterviewerLoopOptions = {
  sessionId: string;
  startedAtMs: number;
  status: string;
  initialCurrentPhase: InterviewPhase;
  interviewDurationMin: number;
  micState: DeepgramState;
  interviewerSpeaking: boolean;
  finals: TranscriptFinal[];
  getSceneDigest: () => string;
  prepareVisionTurn: () => Promise<PreparedVisionTurn>;
  persistInjectedCandidate: (text: string, tsMs: number) => void;
  appendEntry: (entry: TranscriptFinal) => void;
};

const STALL_SILENCE_MS = 50_000;
const STALL_COOLDOWN_MS = 120_000;

export function useInterviewerLoop({
  sessionId,
  startedAtMs,
  status,
  initialCurrentPhase,
  interviewDurationMin,
  micState,
  interviewerSpeaking,
  finals,
  getSceneDigest,
  prepareVisionTurn,
  persistInjectedCandidate,
  appendEntry,
}: UseInterviewerLoopOptions) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState(initialCurrentPhase);
  const [diagnostics, setDiagnostics] = useState<InterviewerLoopDebugEvent[]>([]);
  const inFlightRef = useRef(false);
  const bufferedUtterancesRef = useRef<
    { text: string; tsMs: number; utteranceTiming?: UtteranceTiming }[]
  >([]);
  const lastFailedRef = useRef<PendingTurn | null>(null);
  const watchdogResetAtRef = useRef(0);
  const watchdogPausedAtRef = useRef(0);
  const lastStallRef = useRef(0);
  const turnSequenceRef = useRef(0);
  const wrapupRequestedRef = useRef(
    finals.some((entry) => entry.kind === "wrapup"),
  );
  const sendRef = useRef<(turn: PendingTurn) => Promise<void>>(async () => {});

  const recordDiagnostic = useCallback(
    (
      event: string,
      details: InterviewerLoopDebugEvent["details"] = {},
    ) => {
      const entry = { at: new Date().toISOString(), event, details };
      setDiagnostics((previous) => [...previous, entry].slice(-100));
      console.debug("[DryRun interviewer]", entry);
    },
    [],
  );

  const resetWatchdog = useCallback(
    (reason: "persisted_candidate_final" | "interviewer_turn") => {
      // These are the only legal watchdog reset triggers. Interims, raw audio,
      // suppressed entries, mic state changes, and attempted requests do not reset it.
      watchdogResetAtRef.current = Date.now();
      recordDiagnostic("stall-timer-reset", { reason });
    },
    [recordDiagnostic],
  );

  const sendTurn = useCallback(
    async (turn: PendingTurn): Promise<void> => {
      const turnId = ++turnSequenceRef.current;
      if (interviewerSpeaking) {
        recordDiagnostic("mutex-skip", {
          turnId,
          trigger: turn.trigger,
          reason: "interviewer_speaking",
        });
        return;
      }
      if (inFlightRef.current) {
        if (turn.trigger === "utterance" && turn.utteranceText) {
          bufferedUtterancesRef.current.push({
            text: turn.utteranceText,
            tsMs: turn.tsMs,
            utteranceTiming: turn.utteranceTiming,
          });
        }
        recordDiagnostic("mutex-skip", {
          turnId,
          trigger: turn.trigger,
          reason:
            turn.trigger === "utterance"
              ? "in_flight_buffered"
              : "in_flight_trigger_skipped",
        });
        return;
      }

      inFlightRef.current = true;
      let persistedTurn:
        | { interviewerTsMs: number; candidateThroughTsMs: number }
        | null = null;
      recordDiagnostic("mutex-acquire", { turnId, trigger: turn.trigger });
      setThinking(true);
      setError(null);
      try {
        const vision = await prepareVisionTurn();
        recordDiagnostic("vision-capture", {
          outcome: vision.outcome,
          captureMs: vision.captureMs,
          imageBytes: vision.imageBytes,
          boardChanged: vision.payload.boardChanged,
        });
        recordDiagnostic("turn-post", { turnId, trigger: turn.trigger });
        const response = await fetch("/api/interviewer/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            trigger: turn.trigger,
            utteranceText: turn.utteranceText,
            tsMs: turn.tsMs,
            sceneDigest: getSceneDigest(),
            ...vision.payload,
            utteranceEndedAtEpochMs:
              turn.utteranceTiming?.utteranceEndedAtEpochMs,
            timerFiredAtEpochMs:
              turn.utteranceTiming?.timerFiredAtEpochMs,
          }),
        });
        recordDiagnostic("turn-response", {
          turnId,
          trigger: turn.trigger,
          status: response.status,
        });
        if (response.status === 204) {
          lastFailedRef.current = null;
          return;
        }
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            payload &&
            typeof payload === "object" &&
            typeof (payload as Record<string, unknown>).error === "string"
              ? String((payload as Record<string, unknown>).error)
              : "Interviewer request failed — retry";
          throw new Error(message);
        }
        const result = payload as TurnResponse;
        if (
          result.entry &&
          typeof result.entry.id === "string" &&
          isInterviewPhase(result.currentPhase)
        ) {
          appendEntry({ ...result.entry, source: "database" });
          recordDiagnostic("transcript-row-persisted", {
            id: result.entry.id,
            role: result.entry.role,
            tsMs: result.entry.tsMs,
            suppressed: result.entry.suppressed,
            text: result.entry.text,
          });
          setCurrentPhase(result.currentPhase);
          persistedTurn = {
            interviewerTsMs: result.entry.tsMs,
            candidateThroughTsMs: result.persistedCandidateThroughTsMs,
          };
          resetWatchdog("interviewer_turn");
          if (result.timing.image) {
            vision.commitImageTurn();
          }
          recordDiagnostic("turn-timing", {
            trigger: turn.trigger,
            utteranceEndToTimerFireMs:
              result.timing.utteranceEndToTimerFireMs,
            classifierMs: result.timing.classifierMs,
            generatorMs: result.timing.generatorMs,
            totalUtteranceToReplyMs:
              result.timing.totalUtteranceToReplyMs,
            shortcircuit: result.timing.shortcircuit,
            image: result.timing.image,
            imageBytes: result.timing.imageBytes,
          });
          console.table([
            {
              trigger: turn.trigger,
              utteranceEndToTimerFireMs:
                result.timing.utteranceEndToTimerFireMs,
              classifierMs: result.timing.classifierMs,
              generatorMs: result.timing.generatorMs,
              totalUtteranceToReplyMs:
                result.timing.totalUtteranceToReplyMs,
              shortcircuit: result.timing.shortcircuit ?? "none",
              image: result.timing.image,
              imageBytes: result.timing.imageBytes,
            },
          ]);
        }
        lastFailedRef.current = null;
      } catch (cause) {
        lastFailedRef.current = turn;
        setError(
          cause instanceof Error
            ? cause.message
            : "Interviewer request failed — retry",
        );
      } finally {
        inFlightRef.current = false;
        recordDiagnostic("mutex-release", {
          turnId,
          trigger: turn.trigger,
          reason: "finally",
        });
        setThinking(false);
        const pending = bufferedUtterancesRef.current.splice(0);
        const completedTurn = persistedTurn;
        const buffered = completedTurn
          ? pending.filter((item) => {
              const wasPersistedBeforeTurn =
                item.tsMs <= completedTurn.candidateThroughTsMs &&
                item.tsMs <= completedTurn.interviewerTsMs;
              return !wasPersistedBeforeTurn;
            })
          : pending;
        if (completedTurn && buffered.length !== pending.length) {
          recordDiagnostic("buffer-discard", {
            reason: "persisted_before_interviewer_turn",
            discardedCount: pending.length - buffered.length,
            candidateThroughTsMs: completedTurn.candidateThroughTsMs,
            interviewerTsMs: completedTurn.interviewerTsMs,
          });
        }
        if (buffered.length > 0) {
          const combined = buffered.map((item) => item.text).join(" ");
          const tsMs = buffered[buffered.length - 1].tsMs;
          const utteranceTiming =
            buffered[buffered.length - 1].utteranceTiming;
          queueMicrotask(() => {
            void sendRef.current({
              trigger: "utterance",
              utteranceText: combined,
              tsMs,
              utteranceTiming,
            });
          });
        }
      }
    },
    [
      appendEntry,
      getSceneDigest,
      interviewerSpeaking,
      prepareVisionTurn,
      recordDiagnostic,
      resetWatchdog,
      sessionId,
    ],
  );

  useEffect(() => {
    sendRef.current = sendTurn;
  }, [sendTurn]);

  const submitUtterance = useCallback(
    (
      text: string,
      tsMs: number,
      persistCandidate: boolean,
      utteranceTiming?: UtteranceTiming,
    ) => {
      const trimmed = text.trim();
      if (!trimmed || interviewerSpeaking) {
        recordDiagnostic("utterance-end-skip", {
          reason: !trimmed ? "empty" : "interviewer_speaking",
        });
        return;
      }
      recordDiagnostic("utterance-end", {
        textLength: trimmed.length,
        source: utteranceTiming?.boundarySource ?? "injection",
        timerDelayMs: utteranceTiming?.utteranceEndToTimerFireMs ?? 0,
      });
      if (persistCandidate) {
        persistInjectedCandidate(trimmed, tsMs);
      }
      void sendRef.current({
        trigger: "utterance",
        utteranceText: trimmed,
        tsMs,
        utteranceTiming:
          utteranceTiming ?? {
            boundarySource: "injection",
            utteranceEndedAtEpochMs: Date.now(),
            timerFiredAtEpochMs: Date.now(),
            utteranceEndToTimerFireMs: 0,
          },
      });
    },
    [interviewerSpeaking, persistInjectedCandidate, recordDiagnostic],
  );

  const notifyCandidatePersisted = useCallback(
    (entry: TranscriptFinal) => {
      recordDiagnostic("transcript-row-persisted", {
        id: entry.id,
        role: entry.role,
        tsMs: entry.tsMs,
        suppressed: entry.suppressed,
        text: entry.text,
      });
      if (entry.role === "candidate" && !entry.suppressed) {
        resetWatchdog("persisted_candidate_final");
      }
    },
    [recordDiagnostic, resetWatchdog],
  );

  const simulateUtterance = useCallback(
    (text: string) => {
      submitUtterance(
        text,
        elapsedMsSinceSessionStart(startedAtMs),
        true,
      );
    },
    [startedAtMs, submitUtterance],
  );

  const beginInterview = useCallback(() => {
    void sendRef.current({
      trigger: "opening",
      tsMs: elapsedMsSinceSessionStart(startedAtMs),
    });
  }, [startedAtMs]);

  const askInterviewer = useCallback(() => {
    void sendRef.current({
      trigger: "manual",
      tsMs: elapsedMsSinceSessionStart(startedAtMs),
    });
  }, [startedAtMs]);

  const retry = useCallback(() => {
    const failed = lastFailedRef.current;
    if (failed) {
      void sendRef.current(failed);
    }
  }, []);

  const overridePhase = useCallback(
    async (phase: InterviewPhase) => {
      if (phase === currentPhase || inFlightRef.current) {
        return;
      }
      setError(null);
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPhase: phase }),
        });
        if (!response.ok) {
          const payload = (await response.json()) as { error?: string };
          throw new Error(payload.error ?? "Failed to change phase");
        }
        const previous = currentPhase;
        const tsMs = elapsedMsSinceSessionStart(startedAtMs);
        setCurrentPhase(phase);
        appendEntry({
          id: crypto.randomUUID(),
          role: "system",
          kind: "phase_advance",
          text: `Phase manually changed from ${previous} to ${phase}.`,
          tsMs,
          suppressed: false,
          source: "database",
        });
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Failed to change phase",
        );
      }
    },
    [appendEntry, currentPhase, sessionId, startedAtMs],
  );

  useEffect(() => {
    if (status === "active" && watchdogResetAtRef.current === 0) {
      watchdogResetAtRef.current = Date.now();
      recordDiagnostic("stall-timer-arm", {
        reason: "active_session_initialized",
        silenceMs: STALL_SILENCE_MS,
      });
    }
  }, [recordDiagnostic, status]);

  useEffect(() => {
    if (status !== "active") return;
    if (interviewerSpeaking) {
      if (watchdogPausedAtRef.current === 0) {
        watchdogPausedAtRef.current = Date.now();
        recordDiagnostic("stall-timer-pause", {
          reason: "interviewer_speaking",
        });
      }
      return;
    }
    if (watchdogPausedAtRef.current > 0) {
      const pausedMs = Date.now() - watchdogPausedAtRef.current;
      watchdogPausedAtRef.current = 0;
      if (watchdogResetAtRef.current > 0) {
        watchdogResetAtRef.current += pausedMs;
      }
      if (lastStallRef.current > 0) {
        lastStallRef.current += pausedMs;
      }
      recordDiagnostic("stall-timer-resume", { pausedMs });
    }
  }, [interviewerSpeaking, recordDiagnostic, status]);

  useEffect(() => {
    if (
      status !== "active" ||
      micState !== "listening" ||
      interviewerSpeaking
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (
        now - watchdogResetAtRef.current >= STALL_SILENCE_MS &&
        now - lastStallRef.current >= STALL_COOLDOWN_MS
      ) {
        lastStallRef.current = now;
        recordDiagnostic("stall-timer-fire", {
          silentMs: now - watchdogResetAtRef.current,
        });
        void sendRef.current({
          trigger: "stall",
          tsMs: elapsedMsSinceSessionStart(startedAtMs),
        });
      }
    }, 5_000);
    return () => window.clearInterval(timer);
  }, [
    interviewerSpeaking,
    micState,
    recordDiagnostic,
    startedAtMs,
    status,
  ]);

  useEffect(() => {
    if (
      status !== "active" ||
      wrapupRequestedRef.current ||
      finals.some((entry) => entry.kind === "wrapup")
    ) {
      return;
    }
    const thresholdMs = Math.max(0, interviewDurationMin - 5) * 60_000;
    const delayMs = Math.max(
      0,
      thresholdMs - elapsedMsSinceSessionStart(startedAtMs),
    );
    const timer = window.setTimeout(() => {
      wrapupRequestedRef.current = true;
      void sendRef.current({
        trigger: "wrapup",
        tsMs: elapsedMsSinceSessionStart(startedAtMs),
      });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [finals, interviewDurationMin, startedAtMs, status]);

  return {
    thinking,
    error,
    currentPhase,
    submitUtterance,
    simulateUtterance,
    beginInterview,
    askInterviewer,
    retry,
    overridePhase,
    notifyCandidatePersisted,
    diagnostics,
  };
}
