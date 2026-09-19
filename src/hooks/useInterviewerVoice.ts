"use client";

import {
  speakBrowserText,
  stopBrowserSpeech,
} from "@/lib/browserSpeech";
import type { TtsProvider } from "@/lib/types";
import { useCallback, useEffect, useRef, useState } from "react";

const TRAILING_ECHO_MS = 800;
const BARGE_IN_GRACE_MS = 1500;
const CONTINUOUS_INTERIM_MS = 600;
const INTERIM_GAP_RESET_MS = 800;

export type VoiceStatus = {
  state: "loading" | "playing" | "failed" | "idle";
  error?: string;
};

export type TtsDiagnosticEvent = {
  at: string;
  event: string;
  details: Record<string, string | number | boolean | null>;
};

type VoiceJob = {
  messageId: string;
  text: string;
  audio?: Promise<{ blob: Blob; contentType: string; latencyMs: number }>;
};

type ActivePlayback = {
  messageId: string;
  provider: TtsProvider;
  audio?: HTMLAudioElement;
  objectUrl?: string;
  resolve: () => void;
  inTrailingWindow: boolean;
};

type UseInterviewerVoiceOptions = {
  enabled: boolean;
  usingHeadphones: boolean;
  ttsProvider: TtsProvider;
  browserVoiceName: string | null;
  browserVoiceRate: number;
  sessionId: string;
  onSpeakingChange: (speaking: boolean) => void;
};

export function useInterviewerVoice({
  enabled,
  usingHeadphones,
  ttsProvider,
  browserVoiceName,
  browserVoiceRate,
  sessionId,
  onSpeakingChange,
}: UseInterviewerVoiceOptions) {
  const [statuses, setStatuses] = useState<Record<string, VoiceStatus>>({});
  const [diagnostics, setDiagnostics] = useState<TtsDiagnosticEvent[]>([]);
  const enabledRef = useRef(enabled);
  const usingHeadphonesRef = useRef(usingHeadphones);
  const ttsProviderRef = useRef(ttsProvider);
  const browserVoiceNameRef = useRef(browserVoiceName);
  const browserVoiceRateRef = useRef(browserVoiceRate);
  const sessionIdRef = useRef(sessionId);
  const speakingRef = useRef(false);
  const playbackStartedAtRef = useRef(0);
  const interimCountRef = useRef(0);
  const interimStartedAtRef = useRef(0);
  const lastInterimAtRef = useRef(0);
  const queueRef = useRef<VoiceJob[]>([]);
  const processingRef = useRef(false);
  const activeRef = useRef<ActivePlayback | null>(null);
  const trailingTimerRef = useRef<number | null>(null);
  const processQueueRef = useRef<() => Promise<void>>(async () => {});

  const recordDiagnostic = useCallback(
    (event: string, details: TtsDiagnosticEvent["details"] = {}) => {
      const entry = { at: new Date().toISOString(), event, details };
      setDiagnostics((previous) => [...previous, entry].slice(-50));
      console.debug("[DryRun TTS]", entry);
    },
    [],
  );

  const setStatus = useCallback((messageId: string, status: VoiceStatus) => {
    setStatuses((previous) => ({ ...previous, [messageId]: status }));
  }, []);

  const setSpeaking = useCallback(
    (speaking: boolean, reason: string) => {
      if (speakingRef.current === speaking) return;
      speakingRef.current = speaking;
      onSpeakingChange(speaking);
      recordDiagnostic("speaking-change", { speaking, reason });
      if (speaking) {
        playbackStartedAtRef.current = Date.now();
      } else {
        interimCountRef.current = 0;
        interimStartedAtRef.current = 0;
        lastInterimAtRef.current = 0;
      }
    },
    [onSpeakingChange, recordDiagnostic],
  );

  const finishActive = useCallback(
    (
      reason: "ended" | "manual" | "escape" | "barge_in" | "muted" | "error",
      immediate: boolean,
      error?: string,
    ) => {
      const active = activeRef.current;
      if (!active) {
        if (immediate) setSpeaking(false, reason);
        return;
      }
      if (active.provider === "browser") {
        stopBrowserSpeech();
      } else if (active.audio) {
        active.audio.onended = null;
        active.audio.onerror = null;
        active.audio.pause();
      }

      const settle = () => {
        if (trailingTimerRef.current !== null) {
          window.clearTimeout(trailingTimerRef.current);
          trailingTimerRef.current = null;
        }
        if (active.objectUrl) {
          URL.revokeObjectURL(active.objectUrl);
        }
        if (activeRef.current === active) activeRef.current = null;
        setSpeaking(false, reason);
        active.resolve();
      };

      if (error) {
        setStatus(active.messageId, { state: "failed", error });
      } else {
        setStatus(active.messageId, { state: "idle" });
      }
      recordDiagnostic("playback-stop", {
        messageId: active.messageId,
        reason,
        trailingEchoMs: immediate ? 0 : TRAILING_ECHO_MS,
      });
      if (immediate) {
        settle();
      } else if (!active.inTrailingWindow) {
        active.inTrailingWindow = true;
        trailingTimerRef.current = window.setTimeout(
          settle,
          TRAILING_ECHO_MS,
        );
      }
    },
    [recordDiagnostic, setSpeaking, setStatus],
  );

  const clearQueued = useCallback(() => {
    for (const job of queueRef.current.splice(0)) {
      void job.audio?.catch(() => {
        // The queued request is intentionally abandoned.
      });
      setStatus(job.messageId, { state: "idle" });
    }
  }, [setStatus]);

  const stop = useCallback(
    (reason: "manual" | "escape" | "barge_in" | "muted" = "manual") => {
      const immediate = reason === "barge_in";
      if (reason === "barge_in" || reason === "muted") {
        clearQueued();
      }
      finishActive(reason, immediate);
    },
    [clearQueued, finishActive],
  );

  const fetchAudio = useCallback(
    async (text: string) => {
      const startedAt = performance.now();
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          sessionId: sessionIdRef.current,
        }),
      });
      if (!response.ok) {
        let message = `Voice request failed (HTTP ${response.status})`;
        try {
          const payload: unknown = await response.json();
          if (
            payload &&
            typeof payload === "object" &&
            typeof (payload as Record<string, unknown>).error === "string"
          ) {
            message = String((payload as Record<string, unknown>).error);
          }
        } catch {
          // Preserve the HTTP fallback when the error body is not JSON.
        }
        throw new Error(message);
      }
      const blob = await response.blob();
      const contentType =
        response.headers.get("content-type") ?? blob.type ?? "unknown";
      const latencyMs = Math.round(performance.now() - startedAt);
      recordDiagnostic("voice-fetch-success", {
        contentType,
        bytes: blob.size,
        latencyMs,
      });
      return { blob, contentType, latencyMs };
    },
    [recordDiagnostic],
  );

  const playBrowserJob = useCallback(
    async (job: VoiceJob): Promise<void> => {
      if (!enabledRef.current) {
        setStatus(job.messageId, { state: "idle" });
        return;
      }
      await new Promise<void>((resolve) => {
        const active: ActivePlayback = {
          messageId: job.messageId,
          provider: "browser",
          resolve,
          inTrailingWindow: false,
        };
        activeRef.current = active;
        void speakBrowserText(job.text, {
          voiceName: browserVoiceNameRef.current,
          rate: browserVoiceRateRef.current,
          onStart: () => {
            setStatus(job.messageId, { state: "playing" });
            setSpeaking(true, "playback_start");
            recordDiagnostic("playback-start", {
              messageId: job.messageId,
              provider: "browser",
            });
          },
          onEnd: () => finishActive("ended", false),
          onError: (message) => finishActive("error", true, message),
        });
      });
    },
    [finishActive, recordDiagnostic, setSpeaking, setStatus],
  );

  const playJob = useCallback(
    async (
      job: VoiceJob,
      asset: { blob: Blob; contentType: string; latencyMs: number },
    ): Promise<void> => {
      if (!enabledRef.current) {
        setStatus(job.messageId, { state: "idle" });
        return;
      }
      const objectUrl = URL.createObjectURL(asset.blob);
      const audio = new Audio(objectUrl);
      await new Promise<void>((resolve) => {
        const active: ActivePlayback = {
          messageId: job.messageId,
          provider: "openrouter",
          audio,
          objectUrl,
          resolve,
          inTrailingWindow: false,
        };
        activeRef.current = active;
        audio.onended = () => finishActive("ended", false);
        audio.onerror = () =>
          finishActive("error", true, "browser could not decode audio");
        void audio
          .play()
          .then(() => {
            setStatus(job.messageId, { state: "playing" });
            setSpeaking(true, "playback_start");
            recordDiagnostic("playback-start", {
              messageId: job.messageId,
              contentType: asset.contentType,
            });
          })
          .catch((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : "browser blocked audio playback";
            finishActive("error", true, message);
          });
      });
    },
    [finishActive, recordDiagnostic, setSpeaking, setStatus],
  );

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current.shift();
        if (!job) continue;
        try {
          if (ttsProviderRef.current === "browser") {
            await playBrowserJob(job);
          } else {
            const asset = await job.audio;
            if (!asset) {
              throw new Error("Voice request failed");
            }
            await playJob(job, asset);
          }
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Voice request failed";
          setStatus(job.messageId, { state: "failed", error: message });
          recordDiagnostic("voice-failed", {
            messageId: job.messageId,
            reason: message,
          });
        }
      }
    } finally {
      processingRef.current = false;
    }
  }, [playBrowserJob, playJob, recordDiagnostic, setStatus]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const enqueue = useCallback(
    (messageId: string, text: string) => {
      if (!enabledRef.current || !text.trim()) return;
      setStatus(messageId, { state: "loading" });
      const job: VoiceJob = { messageId, text };
      if (ttsProviderRef.current === "openrouter") {
        job.audio = fetchAudio(text);
      }
      queueRef.current.push(job);
      recordDiagnostic("voice-enqueue", {
        messageId,
        provider: ttsProviderRef.current,
      });
      void processQueueRef.current();
    },
    [fetchAudio, recordDiagnostic, setStatus],
  );

  const replay = useCallback(
    (messageId: string, text: string) => {
      enqueue(messageId, text);
    },
    [enqueue],
  );

  const observeInterim = useCallback(
    (text: string) => {
      if (
        !usingHeadphonesRef.current ||
        !speakingRef.current ||
        !text.trim()
      ) {
        return;
      }
      const now = Date.now();
      if (now - playbackStartedAtRef.current < BARGE_IN_GRACE_MS) {
        interimCountRef.current = 0;
        interimStartedAtRef.current = 0;
        return;
      }
      if (now - lastInterimAtRef.current > INTERIM_GAP_RESET_MS) {
        interimCountRef.current = 0;
        interimStartedAtRef.current = now;
      }
      if (interimStartedAtRef.current === 0) {
        interimStartedAtRef.current = now;
      }
      lastInterimAtRef.current = now;
      interimCountRef.current += 1;
      const sustained =
        interimCountRef.current >= 2 ||
        now - interimStartedAtRef.current >= CONTINUOUS_INTERIM_MS;
      recordDiagnostic("barge-in-interim", {
        count: interimCountRef.current,
        elapsedMs: now - interimStartedAtRef.current,
        sustained,
      });
      if (sustained) {
        stop("barge_in");
      }
    },
    [recordDiagnostic, stop],
  );

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) stop("muted");
  }, [enabled, stop]);

  useEffect(() => {
    usingHeadphonesRef.current = usingHeadphones;
  }, [usingHeadphones]);

  useEffect(() => {
    ttsProviderRef.current = ttsProvider;
  }, [ttsProvider]);

  useEffect(() => {
    browserVoiceNameRef.current = browserVoiceName;
  }, [browserVoiceName]);

  useEffect(() => {
    browserVoiceRateRef.current = browserVoiceRate;
  }, [browserVoiceRate]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && speakingRef.current) {
        event.preventDefault();
        stop("escape");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [stop]);

  useEffect(() => {
    return () => {
      clearQueued();
      if (trailingTimerRef.current !== null) {
        window.clearTimeout(trailingTimerRef.current);
      }
      const active = activeRef.current;
      if (active?.provider === "browser") {
        stopBrowserSpeech();
      } else if (active?.audio) {
        active.audio.pause();
        if (active.objectUrl) URL.revokeObjectURL(active.objectUrl);
      }
    };
  }, [clearQueued]);

  return {
    statuses,
    diagnostics,
    enqueue,
    replay,
    stop,
    observeInterim,
  };
}
