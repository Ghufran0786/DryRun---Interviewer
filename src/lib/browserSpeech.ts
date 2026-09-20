/** Chrome silently stops utterances longer than ~15s; chunk at sentence boundaries. */
const MAX_CHUNK_CHARS = 180;
const VOICES_WAIT_MS = 2000;

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

let voiceChoiceLogged = false;
let activeSpeakGeneration = 0;

export function splitTextIntoChunks(text: string, maxLen = MAX_CHUNK_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.split(SENTENCE_SPLIT).filter((part) => part.length > 0);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxLen) {
      current = candidate;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = "";
    }
    if (sentence.length <= maxLen) {
      current = sentence;
      continue;
    }
    let offset = 0;
    while (offset < sentence.length) {
      const slice = sentence.slice(offset, offset + maxLen).trim();
      if (slice) chunks.push(slice);
      offset += maxLen;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export function waitForVoices(maxMs = VOICES_WAIT_MS): Promise<SpeechSynthesisVoice[]> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve([]);
  }
  const synth = window.speechSynthesis;
  const existing = synth.getVoices();
  if (existing.length > 0) {
    return Promise.resolve(existing);
  }
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(synth.getVoices());
    }, maxMs);
    const onVoicesChanged = () => {
      const voices = synth.getVoices();
      if (voices.length > 0) {
        window.clearTimeout(timeoutId);
        synth.removeEventListener("voiceschanged", onVoicesChanged);
        resolve(voices);
      }
    };
    synth.addEventListener("voiceschanged", onVoicesChanged);
  });
}

/** Warm the voice list before speak (Chrome loads voices asynchronously). */
export function primeBrowserSpeechVoices(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  window.speechSynthesis.getVoices();
}

export type BrowserSpeechVoiceOption = {
  name: string;
  lang: string;
  isNatural: boolean;
};

export function sortVoicesForSettings(
  voices: SpeechSynthesisVoice[],
): BrowserSpeechVoiceOption[] {
  const mapped = voices.map((voice) => ({
    name: voice.name,
    lang: voice.lang,
    isNatural: voice.name.includes("Natural"),
  }));
  mapped.sort((a, b) => {
    if (a.isNatural !== b.isNatural) {
      return a.isNatural ? -1 : 1;
    }
    const langA = a.lang.toLowerCase().startsWith("en");
    const langB = b.lang.toLowerCase().startsWith("en");
    if (langA !== langB) {
      return langA ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
  return mapped;
}

function resolveVoice(
  voices: SpeechSynthesisVoice[],
  voiceName: string | null | undefined,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;

  if (voiceName) {
    const exact = voices.find((voice) => voice.name === voiceName);
    if (exact) {
      if (!voiceChoiceLogged) {
        console.debug("[DryRun TTS] browser voice:", exact.name, exact.lang);
        voiceChoiceLogged = true;
      }
      return exact;
    }
  }

  const naturalEn = voices.find(
    (voice) =>
      voice.lang.toLowerCase().startsWith("en") &&
      voice.name.includes("Natural"),
  );
  if (naturalEn) {
    if (!voiceChoiceLogged) {
      console.debug("[DryRun TTS] browser voice:", naturalEn.name, naturalEn.lang);
      voiceChoiceLogged = true;
    }
    return naturalEn;
  }

  const en = voices.find((voice) => voice.lang.toLowerCase().startsWith("en"));
  const chosen = en ?? voices[0];
  if (!voiceChoiceLogged) {
    console.debug("[DryRun TTS] browser voice:", chosen.name, chosen.lang);
    voiceChoiceLogged = true;
  }
  return chosen;
}

export type SpeakOptions = {
  voiceName?: string | null;
  rate?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

export function stopBrowserSpeech(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return;
  }
  activeSpeakGeneration += 1;
  window.speechSynthesis.cancel();
}

export async function speakBrowserText(
  text: string,
  { voiceName, rate = 1, onStart, onEnd, onError }: SpeakOptions = {},
): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onError?.("browser speech unavailable");
    return;
  }

  const generation = ++activeSpeakGeneration;
  const synth = window.speechSynthesis;
  synth.cancel();

  const voices = await waitForVoices();
  const voice = resolveVoice(voices, voiceName);
  const chunks = splitTextIntoChunks(text);
  if (chunks.length === 0) {
    onEnd?.();
    return;
  }

  let started = false;
  let chunkIndex = 0;

  const fail = (message: string) => {
    if (generation !== activeSpeakGeneration) return;
    stopBrowserSpeech();
    onError?.(message);
  };

  const speakChunk = (index: number) => {
    if (generation !== activeSpeakGeneration) return;
    if (index >= chunks.length) {
      onEnd?.();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunks[index]);
    if (voice) utterance.voice = voice;
    utterance.rate = rate;

    utterance.onstart = () => {
      if (generation !== activeSpeakGeneration) return;
      if (!started) {
        started = true;
        onStart?.();
      }
    };

    utterance.onend = () => {
      if (generation !== activeSpeakGeneration) return;
      chunkIndex = index + 1;
      if (chunkIndex >= chunks.length) {
        onEnd?.();
        return;
      }
      speakChunk(chunkIndex);
    };

    utterance.onerror = (event) => {
      if (generation !== activeSpeakGeneration) return;
      const code =
        event &&
        typeof event === "object" &&
        "error" in event &&
        typeof (event as SpeechSynthesisErrorEvent).error === "string"
          ? (event as SpeechSynthesisErrorEvent).error
          : "";
      if (code === "interrupted" || code === "canceled") {
        return;
      }
      fail("browser speech failed");
    };

    synth.speak(utterance);
  };

  speakChunk(0);
}
