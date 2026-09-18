import "server-only";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[];
};

export type ChatUsage = {
  promptTokens: number;
  completionTokens: number;
};

export class OpenRouterError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

type CallChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  timeoutMs?: number;
};

function taxonomyError(status: number, model: string): string {
  if (status === 401) {
    return "OpenRouter authentication failed — check OPENROUTER_API_KEY";
  }
  if (status === 402) {
    return "OpenRouter credits exhausted";
  }
  if (status === 429) {
    return "OpenRouter rate limited — retry";
  }
  if (status === 400 || status === 404) {
    return `OpenRouter model ID '${model}' invalid — fix in Settings`;
  }
  return `OpenRouter request failed (HTTP ${status})`;
}

function tokenCount(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : 0;
}

export async function callChat({
  model,
  messages,
  temperature,
  maxTokens,
  timeoutMs = 30_000,
}: CallChatOptions): Promise<{ content: string; usage: ChatUsage }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError(
      "OpenRouter authentication failed — check OPENROUTER_API_KEY",
      401,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      throw new OpenRouterError(taxonomyError(response.status, model), response.status);
    }

    const payload: unknown = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new OpenRouterError("OpenRouter returned an invalid response", 502);
    }
    const record = payload as Record<string, unknown>;
    const choices = Array.isArray(record.choices) ? record.choices : [];
    const first = choices[0];
    const message =
      first && typeof first === "object"
        ? (first as Record<string, unknown>).message
        : null;
    const content =
      message && typeof message === "object"
        ? (message as Record<string, unknown>).content
        : null;
    if (typeof content !== "string" || content.trim().length === 0) {
      throw new OpenRouterError("OpenRouter returned an empty response", 502);
    }
    const usage =
      record.usage && typeof record.usage === "object"
        ? (record.usage as Record<string, unknown>)
        : {};

    return {
      content: content.trim(),
      usage: {
        promptTokens: tokenCount(usage.prompt_tokens),
        completionTokens: tokenCount(usage.completion_tokens),
      },
    };
  } catch (error) {
    if (error instanceof OpenRouterError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OpenRouterError(
        `OpenRouter request timed out after ${timeoutMs}ms`,
        504,
      );
    }
    throw new OpenRouterError("OpenRouter request failed — retry", 502);
  } finally {
    clearTimeout(timeout);
  }
}
