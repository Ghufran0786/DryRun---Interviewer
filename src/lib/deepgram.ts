/**
 * Shared Deepgram listen URL/query builder. Production defaults to browser-direct
 * bearer JWT; proxy transport reuses the same query string against localhost:3001.
 * PINNED FACT (g): no encoding/sample_rate params — WebM/Opus is self-describing.
 */

export const DEEPGRAM_PROXY_URL = "ws://localhost:3001/v1/listen";
export const DEEPGRAM_DIRECT_LISTEN_URL = "wss://api.deepgram.com/v1/listen";
export const DEEPGRAM_PROXY_CONTROL_PREFIX = "DryRunProxy.";

export const DEEPGRAM_LISTEN_PARAMS: Record<string, string> = {
  model: "nova-3",
  smart_format: "true",
  interim_results: "true",
  punctuate: "true",
  vad_events: "true",
  endpointing: "300",
  utterance_end_ms: "2500",
};

export function buildListenSearch(
  params: Record<string, string> = DEEPGRAM_LISTEN_PARAMS,
  keyterms: readonly string[] = [],
): string {
  const search = new URLSearchParams(params);
  for (const keyterm of keyterms) {
    search.append("keyterm", keyterm);
  }
  return search.toString();
}

export function buildProxyListenUrl(
  keyterms: readonly string[] = [],
  params: Record<string, string> = DEEPGRAM_LISTEN_PARAMS,
): string {
  return `${DEEPGRAM_PROXY_URL}?${buildListenSearch(params, keyterms)}`;
}

export function buildDirectListenUrl(
  keyterms: readonly string[] = [],
  params: Record<string, string> = DEEPGRAM_LISTEN_PARAMS,
): string {
  return `${DEEPGRAM_DIRECT_LISTEN_URL}?${buildListenSearch(params, keyterms)}`;
}

/** Proxy transport URL (legacy name retained for existing imports). */
export function buildListenUrl(
  params: Record<string, string> = DEEPGRAM_LISTEN_PARAMS,
  keyterms: readonly string[] = [],
): string {
  return buildProxyListenUrl(keyterms, params);
}

export type DeepgramResultsMessage = {
  type: "Results";
  is_final?: boolean;
  speech_final?: boolean;
  channel?: {
    alternatives?: { transcript?: string }[];
  };
};

export type DeepgramUtteranceEndMessage = {
  type: "UtteranceEnd";
  last_word_end?: number;
};

export type DeepgramMessage =
  | DeepgramResultsMessage
  | DeepgramUtteranceEndMessage
  | { type: string };

export function isDeepgramProxyControl(message: DeepgramMessage): boolean {
  return message.type.startsWith(DEEPGRAM_PROXY_CONTROL_PREFIX);
}

export function parseDeepgramMessage(raw: string): DeepgramMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (typeof record.type !== "string") {
      return null;
    }
    return record as DeepgramMessage;
  } catch {
    return null;
  }
}

export function resultTranscript(message: DeepgramResultsMessage): string {
  const alternative = message.channel?.alternatives?.[0];
  return typeof alternative?.transcript === "string"
    ? alternative.transcript
    : "";
}

export type ResultClassification =
  | { kind: "interim"; text: string }
  | { kind: "final"; text: string; endsUtterance: boolean }
  | { kind: "boundary" }
  | { kind: "ignore" };

/**
 * PINNED FACT (h): interim results are provisional and never persisted; each
 * is_final result is one TranscriptEntry; speech_final only fires the
 * utterance boundary and carries no new text of its own.
 */
export function classifyResult(
  message: DeepgramResultsMessage,
): ResultClassification {
  const text = resultTranscript(message).trim();
  const isFinal = message.is_final === true;
  const speechFinal = message.speech_final === true;

  if (text.length === 0) {
    return speechFinal ? { kind: "boundary" } : { kind: "ignore" };
  }
  if (!isFinal) {
    return { kind: "interim", text };
  }
  return { kind: "final", text, endsUtterance: speechFinal };
}
