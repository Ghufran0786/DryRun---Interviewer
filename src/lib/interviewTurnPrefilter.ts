/** VERBATIM filler tokens for utterance pre-filter (tuning 2). */
export const PREFILTER_FILLER_WORDS = new Set([
  "um",
  "uh",
  "umm",
  "hmm",
  "okay",
  "ok",
  "so",
  "yeah",
  "yes",
  "right",
  "like",
  "let",
  "me",
  "think",
  "a",
  "second",
  "sec",
  "moment",
  "one",
  "wait",
  "hold",
  "on",
]);

export function capDigestLines(digest: string, maxLines: number): string {
  const trimmed = digest.trim();
  if (!trimmed) {
    return trimmed;
  }
  const lines = trimmed.split("\n");
  if (lines.length <= maxLines) {
    return trimmed;
  }
  const kept = lines.slice(0, maxLines);
  return `${kept.join("\n")}\n... (+${lines.length - maxLines} more lines)`;
}

export function utteranceWordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

export function isPrefilterShortUtterance(text: string): boolean {
  return utteranceWordCount(text) < 4 && !text.trim().endsWith("?");
}

export function isPrefilterFillerOnly(text: string): boolean {
  const tokens = text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return true;
  }
  return tokens.every((token) => PREFILTER_FILLER_WORDS.has(token));
}

export const STALL_NUDGE_CAP = 6;

export const CLASSIFIER_TURN_LIMIT = 4;
export const GENERATOR_TURN_LIMIT = 8;
export const CLASSIFIER_DIGEST_MAX_LINES = 40;
export const GENERATOR_DIGEST_MAX_LINES = 60;
export const CLASSIFIER_MAX_TOKENS = 60;
export const GENERATOR_MAX_TOKENS = 220;
