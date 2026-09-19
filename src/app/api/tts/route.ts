import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  callSpeech,
  OpenRouterSpeechError,
} from "@/lib/openrouterSpeech";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_TTS_TEXT_LENGTH = 1200;
const globalForTts = globalThis as unknown as {
  dryRunLoggedFirstTtsSuccess?: boolean;
};

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "invalid_request" },
      { status: 400 },
    );
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { error: "Invalid request body", code: "invalid_request" },
      { status: 400 },
    );
  }

  const record = body as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text.trim() : "";
  if (text.length === 0 || text.length > MAX_TTS_TEXT_LENGTH) {
    return NextResponse.json(
      {
        error: `text must contain 1–${MAX_TTS_TEXT_LENGTH} characters`,
        code: "invalid_request",
      },
      { status: 400 },
    );
  }

  const settings = await getSettings();
  if (settings.ttsProvider !== "openrouter") {
    return NextResponse.json(
      {
        error: "OpenRouter TTS is disabled — use browser voice in Settings",
        code: "tts_provider_browser",
      },
      { status: 422 },
    );
  }
  if (!settings.ttsModel.trim() || !settings.ttsVoice.trim()) {
    return NextResponse.json(
      {
        error: "Configure TTS model and voice in Settings",
        code: "tts_not_configured",
      },
      { status: 422 },
    );
  }

  try {
    const speech = await callSpeech({
      text,
      model: settings.ttsModel,
      voice: settings.ttsVoice,
      timeoutMs: 20_000,
    });
    const sessionId =
      typeof record.sessionId === "string" ? record.sessionId.trim() : "";
    if (sessionId) {
      await prisma.session.updateMany({
        where: { id: sessionId },
        data: { ttsChars: { increment: text.length } },
      });
    }

    if (!globalForTts.dryRunLoggedFirstTtsSuccess) {
      globalForTts.dryRunLoggedFirstTtsSuccess = true;
      console.log("OpenRouter TTS first success:", {
        responseShape: "raw ReadableStream<Uint8Array>",
        requestedFormat: "mp3",
        upstreamContentType: speech.upstreamContentType,
        downstreamContentType: speech.contentType,
        contentLength: speech.contentLength ?? "streamed",
      });
    }

    const headers = new Headers({
      "Cache-Control": "no-store",
      "Content-Type": speech.contentType,
      "X-DryRun-TTS-Latency-Ms": String(speech.latencyMs),
    });
    if (speech.contentLength) {
      headers.set("Content-Length", speech.contentLength);
    }
    return new Response(speech.body, { status: 200, headers });
  } catch (error) {
    if (error instanceof OpenRouterSpeechError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }
    console.error("TTS request failed:", error);
    return NextResponse.json(
      { error: "OpenRouter request failed — retry", code: "upstream_failed" },
      { status: 502 },
    );
  }
}
