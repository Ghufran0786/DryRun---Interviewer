import {
  buildEvaluationMessages,
  computeStats,
  parseFirstJsonObject,
  selectSnapshots,
} from "@/lib/evaluation/assemble";
import { RUBRIC_VERSION } from "@/lib/evaluation/rubric";
import {
  computeWeightedScore,
  validate,
  type EvaluationPayload,
} from "@/lib/evaluation/schema";
import { prisma } from "@/lib/db";
import { callChat, OpenRouterError } from "@/lib/openrouter";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const EVALUATOR_TIMEOUT_MS = 90_000;
const EVALUATOR_MAX_TOKENS = 4000;

async function addUsage(
  sessionId: string,
  usage: { promptTokens: number; completionTokens: number },
): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      promptTokens: { increment: usage.promptTokens },
      completionTokens: { increment: usage.completionTokens },
    },
  });
}

function imageBytesFromMessages(
  messages: Awaited<ReturnType<typeof buildEvaluationMessages>>["messages"],
): number {
  const user = messages[1];
  if (!user || !Array.isArray(user.content)) {
    return 0;
  }
  let bytes = 0;
  for (const part of user.content) {
    if (
      typeof part === "object" &&
      part.type === "image_url" &&
      part.image_url.url.startsWith("data:image/png;base64,")
    ) {
      const encoded = part.image_url.url.slice(
        "data:image/png;base64,".length,
      );
      const padding =
        encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
      bytes += Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
    }
  }
  return bytes;
}

function imageCountFromMessages(
  messages: Awaited<ReturnType<typeof buildEvaluationMessages>>["messages"],
): number {
  const user = messages[1];
  if (!user || !Array.isArray(user.content)) {
    return 0;
  }
  return user.content.filter(
    (part) => typeof part === "object" && part.type === "image_url",
  ).length;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id: sessionId } = await context.params;
  if (!sessionId || sessionId.length > 64) {
    return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  if (session.status !== "completed") {
    return NextResponse.json(
      { error: "Evaluation is only available for completed sessions" },
      { status: 409 },
    );
  }

  const [settings, entries, snapshots] = await Promise.all([
    getSettings(),
    prisma.transcriptEntry.findMany({
      where: { sessionId },
      orderBy: [{ tsMs: "asc" }, { createdAt: "asc" }],
    }),
    prisma.snapshot.findMany({
      where: { sessionId },
      orderBy: { capturedAt: "asc" },
    }),
  ]);

  const stats = computeStats(entries, session);
  const selectedSnapshots = selectSnapshots(
    snapshots,
    entries,
    session.startedAt,
  );
  const { messages, structureLog } = await buildEvaluationMessages({
    session,
    settings: {
      candidateName: settings.candidateName,
      strictness: settings.strictness,
      interviewDurationMin: settings.interviewDurationMin,
      resumeText: settings.resumeText,
    },
    stats,
    entries,
    selectedSnapshots,
  });

  console.log("Evaluation assembled message structure:", {
    sessionId,
    order: "text_first_then_images",
    ...structureLog,
  });

  const imageCount = imageCountFromMessages(messages);
  const imageBytes = imageBytesFromMessages(messages);

  const runEvaluator = async (
    attemptMessages: typeof messages,
  ): Promise<{ content: string; usage: { promptTokens: number; completionTokens: number } }> => {
    const result = await callChat({
      model: settings.evaluatorModel,
      messages: attemptMessages,
      temperature: 0,
      maxTokens: EVALUATOR_MAX_TOKENS,
      timeoutMs: EVALUATOR_TIMEOUT_MS,
    });
    return result;
  };

  let rawText = "";
  try {
    const first = await runEvaluator(messages);
    rawText = first.content;
    let parsed: unknown;
    try {
      parsed = parseFirstJsonObject(rawText);
    } catch {
      parsed = null;
    }
    let validation = validate(parsed);
    if (!validation.ok) {
      const retry = await runEvaluator([
        ...messages,
        { role: "assistant", content: rawText },
        {
          role: "user",
          content: `Your previous output failed validation: ${validation.errors.join("; ")}. Output only corrected JSON.`,
        },
      ]);
      rawText = retry.content;
      await addUsage(sessionId, {
        promptTokens: first.usage.promptTokens + retry.usage.promptTokens,
        completionTokens:
          first.usage.completionTokens + retry.usage.completionTokens,
      });
      parsed = parseFirstJsonObject(rawText);
      validation = validate(parsed);
      if (!validation.ok) {
        const failure = {
          error: "Evaluator output failed validation",
          rawText,
          errors: validation.errors,
        };
        await prisma.session.update({
          where: { id: sessionId },
          data: { evaluationJson: JSON.stringify(failure) },
        });
        return NextResponse.json(
          { error: "Evaluator output failed validation" },
          { status: 502 },
        );
      }
    } else {
      await addUsage(sessionId, first.usage);
    }

    const payload = validation.value as EvaluationPayload;
    const weightedScore = computeWeightedScore(payload.scores);
    const evaluatedAt = new Date().toISOString();
    const stored = {
      ...payload,
      weightedScore,
      stats,
      evaluatedAt,
      evaluatorModel: settings.evaluatorModel,
      rubricVersion: RUBRIC_VERSION,
    };

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        verdict: payload.verdict,
        evaluationJson: JSON.stringify(stored),
      },
    });

    console.log("Evaluation completed:", {
      sessionId,
      images: imageCount,
      imageBytes,
      promptTokens: first.usage.promptTokens,
      completionTokens: first.usage.completionTokens,
      weightedScore,
    });

    return NextResponse.json(stored, { status: 201 });
  } catch (error) {
    const message =
      error instanceof OpenRouterError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Evaluation failed";
    if (rawText) {
      await prisma.session.update({
        where: { id: sessionId },
        data: {
          evaluationJson: JSON.stringify({ error: message, rawText }),
        },
      });
    }
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
