import "server-only";

import { OpenRouterError } from "@/lib/openrouter";

const OPENROUTER_SPEECH_URL =
  "https://openrouter.ai/api/v1/audio/speech";

export type SpeechErrorCode =
  | "authentication_failed"
  | "credits_exhausted"
  | "rate_limited"
  | "invalid_tts_configuration"
  | "timeout"
  | "upstream_failed";

export class OpenRouterSpeechError extends OpenRouterError {
  constructor(
    message: string,
    status: number,
    public readonly code: SpeechErrorCode,
  ) {
    super(message, status);
    this.name = "OpenRouterSpeechError";
  }
}

function speechError(status: number): OpenRouterSpeechError {
  if (status === 401) {
    return new OpenRouterSpeechError(
      "OpenRouter authentication failed — check OPENROUTER_API_KEY",
      status,
      "authentication_failed",
    );
  }
  if (status === 402) {
    return new OpenRouterSpeechError(
      "OpenRouter credits exhausted",
      status,
      "credits_exhausted",
    );
  }
  if (status === 429) {
    return new OpenRouterSpeechError(
      "OpenRouter rate limited — retry",
      status,
      "rate_limited",
    );
  }
  if (status === 400 || status === 404) {
    return new OpenRouterSpeechError(
      "OpenRouter TTS model or voice is invalid — fix it in Settings",
      status,
      "invalid_tts_configuration",
    );
  }
  return new OpenRouterSpeechError(
    `OpenRouter request failed (HTTP ${status})`,
    status,
    "upstream_failed",
  );
}

export async function callSpeech(options: {
  text: string;
  model: string;
  voice: string;
  timeoutMs?: number;
}): Promise<{
  body: ReadableStream<Uint8Array>;
  contentType: string;
  contentLength: string | null;
  upstreamContentType: string | null;
  latencyMs: number;
}> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw speechError(401);
  }

  const timeoutMs = options.timeoutMs ?? 20_000;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = performance.now();

  try {
    const response = await fetch(OPENROUTER_SPEECH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model,
        input: options.text,
        voice: options.voice,
        response_format: "mp3",
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      clearTimeout(timeout);
      throw speechError(response.status);
    }
    if (!response.body) {
      clearTimeout(timeout);
      throw new OpenRouterSpeechError(
        "OpenRouter returned an empty audio response",
        502,
        "upstream_failed",
      );
    }

    const reader = response.body.getReader();
    const body = new ReadableStream<Uint8Array>({
      async pull(streamController) {
        try {
          const chunk = await reader.read();
          if (chunk.done) {
            clearTimeout(timeout);
            streamController.close();
            return;
          }
          streamController.enqueue(chunk.value);
        } catch (error) {
          clearTimeout(timeout);
          streamController.error(error);
        }
      },
      async cancel(reason) {
        clearTimeout(timeout);
        await reader.cancel(reason);
      },
    });
    const upstreamContentType = response.headers.get("content-type");
    return {
      body,
      contentType:
        upstreamContentType?.startsWith("audio/")
          ? upstreamContentType
          : "audio/mpeg",
      contentLength: response.headers.get("content-length"),
      upstreamContentType,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof OpenRouterSpeechError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterSpeechError(
        `OpenRouter request timed out after ${timeoutMs}ms`,
        504,
        "timeout",
      );
    }
    throw new OpenRouterSpeechError(
      "OpenRouter request failed — retry",
      502,
      "upstream_failed",
    );
  }
}
