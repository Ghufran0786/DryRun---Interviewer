"use client";

import { Button } from "@/components/ui/Button";
import {
  buildListenUrl,
  parseDeepgramMessage,
  resultTranscript,
  type DeepgramResultsMessage,
} from "@/lib/deepgram";
import { useCallback, useState } from "react";

type DoctorLog = {
  id: number;
  at: string;
  test: string;
  passed: boolean;
  detail: string;
};

type TokenResult = {
  accessToken: string;
  status: number;
  expiresIn: number | null;
  tokenLength: number;
};

const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  channelCount: 1,
};

function mimeType(): string {
  return MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function mintToken(): Promise<TokenResult> {
  const response = await fetch("/api/deepgram/token", { method: "POST" });
  const body = await response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`HTTP ${response.status}; body=${body.slice(0, 200)}`);
  }
  const record = parsed as Record<string, unknown>;
  if (!response.ok || typeof record.accessToken !== "string") {
    throw new Error(`HTTP ${response.status}; body=${body.slice(0, 200)}`);
  }
  return {
    accessToken: record.accessToken,
    status: response.status,
    expiresIn:
      typeof record.expiresIn === "number" ? record.expiresIn : null,
    tokenLength: record.accessToken.length,
  };
}

export function DeepgramDoctor() {
  const [logs, setLogs] = useState<DoctorLog[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const append = useCallback(
    (test: string, passed: boolean, detail: string) => {
      setLogs((previous) => [
        ...previous,
        {
          id: previous.length + 1,
          at: new Date().toISOString(),
          test,
          passed,
          detail,
        },
      ]);
    },
    [],
  );

  const run = useCallback(
    async (name: string, action: () => Promise<string>) => {
      if (running) {
        return;
      }
      setRunning(name);
      try {
        append(name, true, await action());
      } catch (cause) {
        append(
          name,
          false,
          cause instanceof Error ? cause.message : String(cause),
        );
      } finally {
        setRunning(null);
      }
    },
    [append, running],
  );

  const tokenRoute = () =>
    run("Token route", async () => {
      const token = await mintToken();
      return `status=${token.status}; expires_in=${token.expiresIn}; token_length=${token.tokenLength}`;
    });

  const bareWebSocket = () =>
    run("Bare WS, no mic", async () => {
      const url = buildListenUrl({ model: "nova-3" });
      const startedAt = performance.now();
      let openedAt: number | null = null;
      let messages = 0;
      const messageTypes: string[] = [];

      return new Promise<string>((resolve, reject) => {
        const socket = new WebSocket(url);
        let keepAlive: number | null = null;
        let successTimer: number | null = null;
        let settled = false;

        const cleanup = () => {
          if (keepAlive) window.clearInterval(keepAlive);
          if (successTimer) window.clearTimeout(successTimer);
        };

        socket.onopen = () => {
          // The local socket is open; success timing starts at DryRunProxy.Ready,
          // which confirms the upstream Bearer-authenticated socket is open.
        };

        socket.onmessage = (event: MessageEvent<string>) => {
          messages += 1;
          if (typeof event.data !== "string") {
            return;
          }
          const message = parseDeepgramMessage(event.data);
          if (message && messageTypes.length < 20) {
            messageTypes.push(message.type);
          }
          if (message?.type !== "DryRunProxy.Ready" || openedAt !== null) {
            return;
          }
          openedAt = performance.now();
          keepAlive = window.setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ type: "KeepAlive" }));
            }
          }, 5000);
          successTimer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            const openMs = Math.round((openedAt ?? performance.now()) - startedAt);
            socket.close(1000, "doctor complete");
            resolve(
              `open_ms=${openMs}; stayed_open_ms=30000; messages=${messages}; message_types=${JSON.stringify(messageTypes)}`,
            );
          }, 30_000);
        };

        socket.onerror = () => {
          // CloseEvent carries the actionable browser-visible evidence.
        };

        socket.onclose = (event) => {
          cleanup();
          if (settled) return;
          settled = true;
          const elapsed = Math.round(performance.now() - startedAt);
          reject(
            new Error(
              `open_ms=${openedAt === null ? "never" : Math.round(openedAt - startedAt)}; elapsed_ms=${elapsed}; messages=${messages}; close_code=${event.code}; close_reason=${JSON.stringify(event.reason)}; was_clean=${event.wasClean}`,
            ),
          );
        };
      });
    });

  const micCapture = () =>
    run("Mic capture, no WS", async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
      const selectedMimeType = mimeType();
      const recorder = new MediaRecorder(stream, {
        mimeType: selectedMimeType,
      });
      let chunks = 0;
      let nonEmptyChunks = 0;
      let bytes = 0;
      recorder.ondataavailable = (event) => {
        chunks += 1;
        if (event.data.size > 0) {
          nonEmptyChunks += 1;
          bytes += event.data.size;
        }
      };

      try {
        recorder.start(250);
        await wait(5000);
        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });
        recorder.stop();
        await stopped;
      } finally {
        stream.getTracks().forEach((track) => track.stop());
      }

      if (nonEmptyChunks === 0) {
        throw new Error(
          `mimeType=${selectedMimeType}; chunks=${chunks}; non_empty_chunks=0; total_bytes=${bytes}`,
        );
      }
      return `mimeType=${selectedMimeType}; chunks=${chunks}; non_empty_chunks=${nonEmptyChunks}; total_bytes=${bytes}`;
    });

  const fullPipeline = () =>
    run("Full pipeline 15s", async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONSTRAINTS,
      });
      const recorderRef: { current: MediaRecorder | null } = {
        current: null,
      };
      let chunks = 0;
      let bytes = 0;
      let results = 0;
      const transcripts: string[] = [];
      const startedAt = performance.now();

      try {
        const socket = new WebSocket(buildListenUrl());

        await new Promise<void>((resolve, reject) => {
          let settled = false;
          let completionTimer: number | null = null;
          let pipelineStarted = false;
          socket.onopen = () => {
            // Wait for DryRunProxy.Ready before creating the one recorder for this
            // upstream connection.
          };
          socket.onmessage = (event: MessageEvent<string>) => {
            if (typeof event.data !== "string") return;
            const message = parseDeepgramMessage(event.data);
            if (
              message?.type === "DryRunProxy.Ready" &&
              !pipelineStarted
            ) {
              pipelineStarted = true;
              const selectedMimeType = mimeType();
              const recorder = new MediaRecorder(stream, {
                mimeType: selectedMimeType,
              });
              recorderRef.current = recorder;
              recorder.ondataavailable = (event) => {
                if (
                  event.data.size > 0 &&
                  socket.readyState === WebSocket.OPEN
                ) {
                  chunks += 1;
                  bytes += event.data.size;
                  socket.send(event.data);
                }
              };
              recorder.start(250);
              completionTimer = window.setTimeout(() => {
                settled = true;
                resolve();
              }, 15_000);
              return;
            }
            if (message?.type !== "Results") return;
            results += 1;
            const text = resultTranscript(
              message as DeepgramResultsMessage,
            ).trim();
            if (text) transcripts.push(text);
          };
          socket.onerror = () => {
            // CloseEvent reports code/reason.
          };
          socket.onclose = (event) => {
            if (settled) return;
            settled = true;
            if (completionTimer !== null) {
              window.clearTimeout(completionTimer);
            }
            reject(
              new Error(
                `handshake/open failure after ${Math.round(performance.now() - startedAt)}ms; close_code=${event.code}; close_reason=${JSON.stringify(event.reason)}; chunks=${chunks}; bytes=${bytes}`,
              ),
            );
          };
        });

        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "CloseStream" }));
          await wait(500);
          socket.close(1000, "doctor complete");
        }
        return `elapsed_ms=${Math.round(performance.now() - startedAt)}; chunks=${chunks}; total_bytes=${bytes}; results_messages=${results}; transcripts=${JSON.stringify(transcripts)}`;
      } finally {
        const recorder = recorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
        stream.getTracks().forEach((track) => track.stop());
      }
    });

  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          variant="secondary"
          onClick={tokenRoute}
          disabled={running !== null}
        >
          Token route
        </Button>
        <Button
          variant="secondary"
          onClick={bareWebSocket}
          disabled={running !== null}
        >
          Bare WS, no mic
        </Button>
        <Button
          variant="secondary"
          onClick={micCapture}
          disabled={running !== null}
        >
          Mic capture, no WS
        </Button>
        <Button
          variant="secondary"
          onClick={fullPipeline}
          disabled={running !== null}
        >
          Full pipeline 15s
        </Button>
      </div>

      {running ? (
        <p className="text-sm text-muted">Running: {running}…</p>
      ) : null}

      <section>
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Diagnostic log
        </h2>
        <pre className="mt-3 min-h-64 overflow-x-auto whitespace-pre-wrap rounded-[6px] border border-border bg-white p-4 font-mono text-xs leading-relaxed text-foreground">
          {logs.length === 0
            ? "No checks run yet."
            : logs
                .map(
                  (entry) =>
                    `${entry.at} ${entry.passed ? "PASS" : "FAIL"} ${entry.test}\\n${entry.detail}`,
                )
                .join("\n\n")}
        </pre>
      </section>
    </div>
  );
}
