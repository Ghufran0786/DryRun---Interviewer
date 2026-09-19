"use client";

import {
  buildDirectListenUrl,
  buildProxyListenUrl,
  classifyResult,
  isDeepgramProxyControl,
  parseDeepgramMessage,
  type DeepgramResultsMessage,
} from "@/lib/deepgram";
import type { DeepgramTransport } from "@/lib/deepgramTransport";
import { parseKeyterms } from "@/lib/deepgramKeyterms";
import { elapsedMsSinceSessionStart } from "@/lib/sessionTime";
import { useCallback, useEffect, useRef, useState } from "react";

export type DeepgramState =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "listening"
  | "reconnecting"
  | "stopped"
  | "error";

// Deepgram already waits utterance_end_ms=2500. UtteranceEnd therefore needs
// only a short client settle; speech_final gets a longer fallback in case no
// UtteranceEnd message follows.
const UTTERANCE_END_SETTLE_MS = 800;
const SPEECH_FINAL_FALLBACK_MS = 2000;
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_RECONNECTS = BACKOFF_MS.length;
const CLOSE_DRAIN_MS = 500;
const AUDIO_TIMESLICE_MS = 250;

async function fetchDeepgramListenToken(): Promise<string> {
  const response = await fetch("/api/deepgram/token", { method: "POST" });
  const bodyText = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`Token route returned non-JSON (HTTP ${response.status})`);
  }
  const record = parsed as Record<string, unknown>;
  if (!response.ok || typeof record.token !== "string" || record.token.length === 0) {
    const message =
      typeof record.error === "string" ? record.error : `HTTP ${response.status}`;
    throw new Error(message);
  }
  return record.token;
}

export type UseDeepgramLiveOptions = {
  startedAtMs: number;
  keyterms: string;
  deepgramTransport: DeepgramTransport;
  shouldSuppressTranscript: () => boolean;
  onInterim: (text: string) => void;
  onFinal: (text: string, tsMs: number) => void;
  onUtteranceEnd: (
    text: string,
    tsMs: number,
    timing: UtteranceTiming,
  ) => void;
};

export type UtteranceTiming = {
  boundarySource:
    | "utterance_end"
    | "speech_final"
    | "stop_flush"
    | "injection";
  utteranceEndedAtEpochMs: number;
  timerFiredAtEpochMs: number;
  utteranceEndToTimerFireMs: number;
};

export type UseDeepgramLive = {
  state: DeepgramState;
  error: string | null;
  diagnostics: DeepgramDiagnosticEvent[];
  connectionSummary: DeepgramConnectionSummary;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export type DeepgramDiagnosticEvent = {
  at: string;
  attemptId: number;
  event: string;
  details: Record<string, string | number | boolean | null>;
};

export type DeepgramConnectionSummary = {
  attempts: number;
  reconnectCount: number;
  closeCodes: string;
};

export function summarizeDeepgramConnections(
  events: DeepgramDiagnosticEvent[],
): DeepgramConnectionSummary {
  const attempts = events.filter((event) => event.event === "attempt-start");
  const closeCodes = events
    .filter((event) => event.event === "websocket-close")
    .map((event) => event.details.code)
    .filter((code): code is number => typeof code === "number");
  return {
    attempts: attempts.length,
    reconnectCount: attempts.filter(
      (event) => event.details.reconnect === true,
    ).length,
    closeCodes: closeCodes.length > 0 ? closeCodes.join(", ") : "none",
  };
}

type AttemptSummary = {
  attemptId: number;
  reconnect: boolean;
  startedAtMs: number;
  proxySocketOpened: boolean;
  tokenOutcome: string;
  wsUrl: string;
  timeToOpenMs: number | null;
  handshakeFailureMs: number | null;
  closeCode: number | null;
  closeReason: string;
  openToCloseMs: number | null;
  audioChunkCount: number;
  audioBytes: number;
  finished: boolean;
};

function pickMimeType(): string {
  return typeof MediaRecorder !== "undefined" &&
    MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
}

export function useDeepgramLive({
  startedAtMs,
  keyterms,
  deepgramTransport,
  shouldSuppressTranscript,
  onInterim,
  onFinal,
  onUtteranceEnd,
}: UseDeepgramLiveOptions): UseDeepgramLive {
  const [state, setState] = useState<DeepgramState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<DeepgramDiagnosticEvent[]>([]);
  const [connectionSummary, setConnectionSummary] =
    useState<DeepgramConnectionSummary>({
      attempts: 0,
      reconnectCount: 0,
      closeCodes: "none",
    });

  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepAliveTimerRef = useRef<number | null>(null);
  const stoppingRef = useRef(false);
  const attemptSequenceRef = useRef(0);
  const activeAttemptRef = useRef<AttemptSummary | null>(null);
  const deepgramTransportRef = useRef(deepgramTransport);

  const utteranceTextRef = useRef<string[]>([]);
  const utteranceTsRef = useRef(0);
  const utteranceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utteranceBoundaryAtRef = useRef(0);
  const utteranceBoundarySourceRef =
    useRef<UtteranceTiming["boundarySource"]>("speech_final");
  const utteranceTraceIdRef = useRef(1);

  const callbacksRef = useRef({
    shouldSuppressTranscript,
    onInterim,
    onFinal,
    onUtteranceEnd,
  });
  useEffect(() => {
    callbacksRef.current = {
      shouldSuppressTranscript,
      onInterim,
      onFinal,
      onUtteranceEnd,
    };
  }, [onInterim, onFinal, onUtteranceEnd, shouldSuppressTranscript]);

  useEffect(() => {
    deepgramTransportRef.current = deepgramTransport;
  }, [deepgramTransport]);

  const recordDiagnostic = useCallback(
    (
      attemptId: number,
      event: string,
      details: DeepgramDiagnosticEvent["details"],
    ) => {
      const entry: DeepgramDiagnosticEvent = {
        at: new Date().toISOString(),
        attemptId,
        event,
        details,
      };
      setDiagnostics((previous) => [...previous, entry].slice(-50));
      console.debug("[DryRun STT]", entry);
    },
    [],
  );

  const reportFailedAttempt = useCallback((attempt: AttemptSummary) => {
    console.table([
      {
        attempt: attempt.attemptId,
        reconnect: attempt.reconnect,
        token: attempt.tokenOutcome,
        wsUrl: attempt.wsUrl,
        timeToOpenMs: attempt.timeToOpenMs,
        handshakeFailureMs: attempt.handshakeFailureMs,
        closeCode: attempt.closeCode,
        closeReason: attempt.closeReason,
        openToCloseMs: attempt.openToCloseMs,
        audioChunks: attempt.audioChunkCount,
        audioBytes: attempt.audioBytes,
      },
    ]);
  }, []);

  const clearUtteranceTimer = useCallback((reason: string) => {
    if (utteranceTimerRef.current) {
      clearTimeout(utteranceTimerRef.current);
      utteranceTimerRef.current = null;
      recordDiagnostic(attemptSequenceRef.current, "utterance-timer-reset", {
        reason,
      });
    }
  }, [recordDiagnostic]);

  const fireUtterance = useCallback(() => {
    utteranceTimerRef.current = null;
    const text = utteranceTextRef.current.join(" ").trim();
    utteranceTextRef.current = [];
    if (text.length === 0) return;
    const timerFiredAtEpochMs = Date.now();
    const timing: UtteranceTiming = {
      boundarySource: utteranceBoundarySourceRef.current,
      utteranceEndedAtEpochMs: utteranceBoundaryAtRef.current,
      timerFiredAtEpochMs,
      utteranceEndToTimerFireMs: Math.max(
        0,
        timerFiredAtEpochMs - utteranceBoundaryAtRef.current,
      ),
    };
    recordDiagnostic(attemptSequenceRef.current, "utterance-end", {
      utteranceId: utteranceTraceIdRef.current,
      source: timing.boundarySource,
      timerDelayMs: timing.utteranceEndToTimerFireMs,
      textLength: text.length,
    });
    callbacksRef.current.onUtteranceEnd(
      text,
      utteranceTsRef.current,
      timing,
    );
    utteranceTraceIdRef.current += 1;
  }, [recordDiagnostic]);

  const armUtteranceTimer = useCallback((
    delayMs: number,
    source: UtteranceTiming["boundarySource"],
  ) => {
    clearUtteranceTimer(`superseded_by_${source}`);
    if (utteranceTextRef.current.length === 0) {
      return;
    }
    utteranceBoundaryAtRef.current = Date.now();
    utteranceBoundarySourceRef.current = source;
    recordDiagnostic(attemptSequenceRef.current, "utterance-timer-arm", {
      source,
      delayMs,
    });
    utteranceTimerRef.current = setTimeout(() => {
      fireUtterance();
    }, delayMs);
  }, [clearUtteranceTimer, fireUtterance, recordDiagnostic]);

  const teardownRecorder = useCallback(() => {
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) {
      return;
    }
    recorder.ondataavailable = null;
    if (recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* recorder already torn down */
      }
    }
  }, []);

  const teardownSocket = useCallback(() => {
    if (keepAliveTimerRef.current !== null) {
      window.clearInterval(keepAliveTimerRef.current);
      keepAliveTimerRef.current = null;
    }
    const socket = socketRef.current;
    socketRef.current = null;
    if (!socket) {
      return;
    }
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (
      socket.readyState === WebSocket.OPEN ||
      socket.readyState === WebSocket.CONNECTING
    ) {
      try {
        socket.close();
      } catch {
        /* socket already closing */
      }
    }
  }, []);

  const releaseMic = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
  }, []);

  const handleResults = useCallback(
    (message: DeepgramResultsMessage) => {
      recordDiagnostic(attemptSequenceRef.current, "raw-results", {
        utteranceId: utteranceTraceIdRef.current,
        isFinal: message.is_final === true,
        speechFinal: message.speech_final === true,
        transcript: message.channel?.alternatives?.[0]?.transcript ?? "",
      });
      const result = classifyResult(message);

      if (result.kind === "ignore") {
        return;
      }
      if (result.kind === "boundary") {
        armUtteranceTimer(UTTERANCE_END_SETTLE_MS, "utterance_end");
        return;
      }
      if (result.kind === "interim") {
        callbacksRef.current.onInterim(result.text);
        return;
      }

      const tsMs = elapsedMsSinceSessionStart(startedAtMs);
      clearUtteranceTimer("new_persisted_final");
      callbacksRef.current.onFinal(result.text, tsMs);
      if (callbacksRef.current.shouldSuppressTranscript()) {
        recordDiagnostic(attemptSequenceRef.current, "final-suppressed", {
          utteranceId: utteranceTraceIdRef.current,
          textLength: result.text.length,
        });
        return;
      }
      utteranceTextRef.current.push(result.text);
      utteranceTsRef.current = tsMs;

      if (result.endsUtterance) {
        armUtteranceTimer(SPEECH_FINAL_FALLBACK_MS, "speech_final");
      }
    },
    [armUtteranceTimer, clearUtteranceTimer, recordDiagnostic, startedAtMs],
  );

  // connectRef breaks the cycle between connect() and its own reconnect scheduler.
  const connectRef = useRef<(isReconnect: boolean) => Promise<void>>(
    async () => {},
  );

  const scheduleReconnect = useCallback((attempt: AttemptSummary) => {
    if (stoppingRef.current) {
      return;
    }
    if (attempt.finished) {
      return;
    }
    attempt.finished = true;
    reportFailedAttempt(attempt);
    teardownRecorder();
    teardownSocket();

    if (reconnectAttemptsRef.current >= MAX_RECONNECTS) {
      releaseMic();
      if (!attempt.proxySocketOpened) {
        const handshakeError =
          deepgramTransportRef.current === "proxy"
            ? "proxy not running (is npm run dev up?)"
            : "Deepgram handshake failed (check DEEPGRAM_API_KEY and network).";
        setError(handshakeError);
        setState("error");
        return;
      }
      const close = attempt.closeCode === null
        ? "handshake failed without a CloseEvent"
        : `${attempt.closeCode}: ${attempt.closeReason}`;
      setError(`Lost connection (${close}) after 3 reconnect attempts.`);
      setState("error");
      return;
    }

    const wait = BACKOFF_MS[reconnectAttemptsRef.current];
    reconnectAttemptsRef.current += 1;
    setState("reconnecting");
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      void connectRef.current(true);
    }, wait);
  }, [
    releaseMic,
    reportFailedAttempt,
    teardownRecorder,
    teardownSocket,
  ]);

  const startRecorder = useCallback(
    (socket: WebSocket, attempt: AttemptSummary) => {
      const stream = streamRef.current;
      if (!stream) {
        return;
      }
      // PINNED FACT (g): exactly one recorder per socket, 250ms timeslice, never paused.
      const recorder = new MediaRecorder(stream, { mimeType: pickMimeType() });
      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0 && socket.readyState === WebSocket.OPEN) {
          socket.send(event.data);
          attempt.audioChunkCount += 1;
          attempt.audioBytes += event.data.size;
        }
      };
      recorderRef.current = recorder;
      recorder.start(AUDIO_TIMESLICE_MS);
    },
    [],
  );

  const connect = useCallback(
    async (isReconnect: boolean): Promise<void> => {
      if (stoppingRef.current) {
        return;
      }
      const transport = deepgramTransportRef.current;
      setState(isReconnect ? "reconnecting" : "connecting");
      const attempt: AttemptSummary = {
        attemptId: ++attemptSequenceRef.current,
        reconnect: isReconnect,
        startedAtMs: Date.now(),
        proxySocketOpened: false,
        tokenOutcome: transport === "proxy" ? "proxy-managed" : "pending",
        wsUrl: "",
        timeToOpenMs: null,
        handshakeFailureMs: null,
        closeCode: null,
        closeReason: "",
        openToCloseMs: null,
        audioChunkCount: 0,
        audioBytes: 0,
        finished: false,
      };
      activeAttemptRef.current = attempt;
      recordDiagnostic(attempt.attemptId, "attempt-start", {
        reconnect: isReconnect,
        transport,
      });
      setConnectionSummary((previous) => ({
        ...previous,
        attempts: previous.attempts + 1,
        reconnectCount:
          previous.reconnectCount + (isReconnect ? 1 : 0),
      }));

      if (stoppingRef.current) {
        return;
      }

      const selectedKeyterms = parseKeyterms(keyterms);
      let bearerToken: string | null = null;
      if (transport === "direct") {
        recordDiagnostic(attempt.attemptId, "token-fetch-start", {});
        try {
          bearerToken = await fetchDeepgramListenToken();
          attempt.tokenOutcome = "minted";
          recordDiagnostic(attempt.attemptId, "token-fetch-ok", {
            tokenLength: bearerToken.length,
          });
        } catch (cause) {
          attempt.tokenOutcome =
            cause instanceof Error ? cause.message : "token-fetch-failed";
          recordDiagnostic(attempt.attemptId, "token-fetch-failed", {
            detail: attempt.tokenOutcome,
          });
          setError(attempt.tokenOutcome);
          setState("error");
          return;
        }
      } else {
        recordDiagnostic(attempt.attemptId, "token-delegated", {
          detail: "local proxy mints a fresh JWT for this connection",
        });
      }

      if (stoppingRef.current) {
        return;
      }

      const wsUrl =
        transport === "direct"
          ? buildDirectListenUrl(selectedKeyterms)
          : buildProxyListenUrl(selectedKeyterms);
      attempt.wsUrl = wsUrl;
      recordDiagnostic(attempt.attemptId, "websocket-created", {
        url: attempt.wsUrl,
        urlLength: wsUrl.length,
        keytermCount: selectedKeyterms.length,
        transport,
      });
      recordDiagnostic(attempt.attemptId, "production-websocket-url", {
        url: attempt.wsUrl,
        authentication:
          transport === "direct"
            ? "bearer subprotocol; token elided"
            : "proxy-managed; token elided",
        keytermCount: selectedKeyterms.length,
      });

      const socket =
        transport === "direct" && bearerToken
          ? new WebSocket(wsUrl, ["bearer", bearerToken])
          : new WebSocket(wsUrl);
      socket.binaryType = "arraybuffer";
      socketRef.current = socket;

      const markListening = () => {
        if (attempt.timeToOpenMs !== null) {
          return;
        }
        attempt.timeToOpenMs = Date.now() - attempt.startedAtMs;
        attempt.proxySocketOpened = true;
        recordDiagnostic(attempt.attemptId, "websocket-open", {
          timeToOpenMs: attempt.timeToOpenMs,
          transport,
        });
        reconnectAttemptsRef.current = 0;
        setError(null);
        setState("listening");
        startRecorder(socket, attempt);
        keepAliveTimerRef.current = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: "KeepAlive" }));
          }
        }, 5_000);
      };

      socket.onopen = () => {
        if (transport === "direct") {
          markListening();
          return;
        }
        attempt.proxySocketOpened = true;
        recordDiagnostic(attempt.attemptId, "proxy-socket-open", {
          localOpenMs: Date.now() - attempt.startedAtMs,
        });
      };

      socket.onmessage = (event: MessageEvent<string>) => {
        if (typeof event.data !== "string") {
          return;
        }
        const message = parseDeepgramMessage(event.data);
        if (!message) {
          return;
        }
        if (transport === "proxy" && isDeepgramProxyControl(message)) {
          if (message.type !== "DryRunProxy.Ready") {
            return;
          }
          markListening();
          return;
        }
        if (message.type === "Results") {
          handleResults(message as DeepgramResultsMessage);
          return;
        }
        if (message.type === "UtteranceEnd") {
          recordDiagnostic(attempt.attemptId, "raw-utterance-end", {
            utteranceId: utteranceTraceIdRef.current,
          });
          armUtteranceTimer(UTTERANCE_END_SETTLE_MS, "utterance_end");
        }
      };

      socket.onerror = () => {
        recordDiagnostic(attempt.attemptId, "websocket-error", {
          readyState: socket.readyState,
        });
      };

      socket.onclose = (event: CloseEvent) => {
        const closedAtMs = Date.now();
        attempt.closeCode = event.code;
        attempt.closeReason = event.reason;
        if (attempt.timeToOpenMs === null) {
          attempt.handshakeFailureMs = closedAtMs - attempt.startedAtMs;
        } else {
          const openedAtMs = attempt.startedAtMs + attempt.timeToOpenMs;
          attempt.openToCloseMs = closedAtMs - openedAtMs;
        }
        recordDiagnostic(attempt.attemptId, "websocket-close", {
          code: event.code,
          reason: event.reason,
          wasClean: event.wasClean,
          handshakeFailureMs: attempt.handshakeFailureMs,
          openToCloseMs: attempt.openToCloseMs,
          audioChunkCount: attempt.audioChunkCount,
          audioBytes: attempt.audioBytes,
        });
        setConnectionSummary((previous) => ({
          ...previous,
          closeCodes:
            previous.closeCodes === "none"
              ? String(event.code)
              : `${previous.closeCodes}, ${event.code}`,
        }));
        if (!stoppingRef.current) {
          const handshakeError =
            transport === "proxy"
              ? "proxy not running (is npm run dev up?)"
              : "Deepgram handshake failed (check DEEPGRAM_API_KEY and network).";
          setError(
            attempt.proxySocketOpened
              ? `Lost connection (${event.code}: ${event.reason}).`
              : handshakeError,
          );
          scheduleReconnect(attempt);
        }
      };
    },
    [
      armUtteranceTimer,
      handleResults,
      keyterms,
      recordDiagnostic,
      scheduleReconnect,
      startRecorder,
    ],
  );

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  const start = useCallback(async (): Promise<void> => {
    if (
      state === "listening" ||
      state === "connecting" ||
      state === "requesting-mic" ||
      state === "reconnecting"
    ) {
      return;
    }

    stoppingRef.current = false;
    reconnectAttemptsRef.current = 0;
    activeAttemptRef.current = null;
    utteranceTextRef.current = [];
    setError(null);
    setState("requesting-mic");

    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          channelCount: 1,
        },
      });
    } catch {
      setError(
        "Microphone permission denied or no input device available.",
      );
      setState("error");
      return;
    }

    await connect(false);
  }, [connect, state]);

  const stop = useCallback(async (): Promise<void> => {
    stoppingRef.current = true;
    if (utteranceTextRef.current.length > 0) {
      utteranceBoundaryAtRef.current = Date.now();
      utteranceBoundarySourceRef.current = "stop_flush";
      clearUtteranceTimer("stop_flush");
      fireUtterance();
    } else {
      clearUtteranceTimer("mic_stop");
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    teardownRecorder();

    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ type: "CloseStream" }));
      } catch {
        /* socket already gone */
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, CLOSE_DRAIN_MS);
      });
    }

    teardownSocket();
    releaseMic();
    utteranceTextRef.current = [];
    setState("stopped");
  }, [
    clearUtteranceTimer,
    fireUtterance,
    releaseMic,
    teardownRecorder,
    teardownSocket,
  ]);

  useEffect(() => {
    return () => {
      stoppingRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (utteranceTimerRef.current) {
        clearTimeout(utteranceTimerRef.current);
      }
      teardownRecorder();
      teardownSocket();
      releaseMic();
    };
  }, [releaseMic, teardownRecorder, teardownSocket]);

  return {
    state,
    error,
    diagnostics,
    connectionSummary,
    start,
    stop,
  };
}
