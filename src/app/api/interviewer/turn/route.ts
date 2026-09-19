import { prisma } from "@/lib/db";
import {
  BASE_PHASE_BUDGETS,
  INTERVIEW_PHASES,
  isInterviewPhase,
  nextInterviewPhase,
  type InterviewPhase,
} from "@/lib/interviewPhases";
import {
  callChat,
  OpenRouterError,
  type ChatUsage,
} from "@/lib/openrouter";
import {
  classifierMessages,
  generatorMessages,
  parseClassifierDecision,
  stripPhaseNote,
  triggerInstruction,
  type ClassifierAction,
  type ClassifierDecision,
} from "@/lib/prompts";
import {
  capDigestLines,
  CLASSIFIER_DIGEST_MAX_LINES,
  CLASSIFIER_MAX_TOKENS,
  CLASSIFIER_TURN_LIMIT,
  GENERATOR_DIGEST_MAX_LINES,
  GENERATOR_MAX_TOKENS,
  GENERATOR_TURN_LIMIT,
  isPrefilterFillerOnly,
  isPrefilterShortUtterance,
  STALL_NUDGE_CAP_PER_PHASE,
  isHelpRequestUtterance,
} from "@/lib/interviewTurnPrefilter";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const TURN_TRIGGERS = [
  "utterance",
  "opening",
  "stall",
  "stall_drawing",
  "stall_maxgap",
  "wrapup",
  "closing",
  "manual",
] as const;

const STALL_TURN_TRIGGERS = new Set<TurnTrigger>([
  "stall",
  "stall_drawing",
  "stall_maxgap",
]);
type TurnTrigger = (typeof TURN_TRIGGERS)[number];

const TURN_FLOOR_MS = 20_000;
const HARD_COOLDOWN_MS = 6_000;
const QUESTION_SHORTCIRCUIT_CLEARANCE_MS = 10_000;
const QUESTION_SHORTCIRCUIT_MIN_WORDS = 8;
const MAX_BOARD_IMAGE_LENGTH = 8_000_000;
const VISION_WARNING =
  "interviewer model rejects image input — choose a vision-capable model.";
const globalForTurns = globalThis as unknown as {
  dryRunInterviewerTurns?: Set<string>;
};
const inFlightTurns =
  globalForTurns.dryRunInterviewerTurns ??
  (globalForTurns.dryRunInterviewerTurns = new Set<string>());

function validSessionId(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 64 &&
    /^[a-z0-9]+$/i.test(value)
  );
}

function validTrigger(value: unknown): value is TurnTrigger {
  return (
    typeof value === "string" &&
    (TURN_TRIGGERS as readonly string[]).includes(value)
  );
}

function elapsedMs(startedAt: Date | null): number {
  return startedAt ? Math.max(0, Date.now() - startedAt.getTime()) : 0;
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function validBoardImage(value: string): boolean {
  return (
    value.length <= MAX_BOARD_IMAGE_LENGTH &&
    /^data:image\/png;base64,[a-z0-9+/]+={0,2}$/i.test(value)
  );
}

function imageByteLength(dataUrl: string): number {
  const encoded = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
}

function phaseBudgetMin(
  phase: InterviewPhase,
  interviewDurationMin: number,
): number {
  const baseTotal = INTERVIEW_PHASES.reduce(
    (sum, key) => sum + BASE_PHASE_BUDGETS[key],
    0,
  );
  const scale = interviewDurationMin / baseTotal;
  return Math.max(1, Math.round(BASE_PHASE_BUDGETS[phase] * scale));
}

function parsePhaseNotes(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((note): note is string => typeof note === "string")
      : [];
  } catch {
    return [];
  }
}

async function addUsage(sessionId: string, usage: ChatUsage): Promise<void> {
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      promptTokens: { increment: usage.promptTokens },
      completionTokens: { increment: usage.completionTokens },
    },
  });
}

function actionInstruction(
  action: Exclude<ClassifierAction, "stay_silent">,
  utteranceText: string,
): string {
  if (action === "answer_question") {
    return `Answer the candidate's explicit question directly but briefly, without revealing a complete design. Their question was: "${utteranceText}"`;
  }
  if (action === "nudge") {
    return `The candidate appears stuck. Give a small nudge without solving the problem, based on: "${utteranceText}"`;
  }
  return `Probe one important trade-off or assumption in this completed candidate thought: "${utteranceText}"`;
}

function kindForAction(action: Exclude<ClassifierAction, "stay_silent">) {
  if (action === "answer_question") return "answer";
  return action;
}

export async function POST(request: Request) {
  const routeStartedAt = Date.now();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const record = body as Record<string, unknown>;
  if (!validSessionId(record.sessionId)) {
    return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
  }
  if (!validTrigger(record.trigger)) {
    return NextResponse.json({ error: "Invalid trigger" }, { status: 400 });
  }
  const turnTrigger: TurnTrigger = record.trigger;
  if (
    typeof record.tsMs !== "number" ||
    !Number.isSafeInteger(record.tsMs) ||
    record.tsMs < 0 ||
    record.tsMs > 86_400_000
  ) {
    return NextResponse.json({ error: "Invalid tsMs" }, { status: 400 });
  }
  if (typeof record.sceneDigest !== "string" || record.sceneDigest.length > 20_000) {
    return NextResponse.json({ error: "Invalid sceneDigest" }, { status: 400 });
  }
  if (
    record.boardChanged !== undefined &&
    typeof record.boardChanged !== "boolean"
  ) {
    return NextResponse.json({ error: "Invalid boardChanged" }, { status: 400 });
  }
  const boardChanged = record.boardChanged === true;
  const boardImageBase64 =
    typeof record.boardImageBase64 === "string"
      ? record.boardImageBase64
      : null;
  if (
    boardImageBase64 !== null &&
    (!boardChanged || !validBoardImage(boardImageBase64))
  ) {
    return NextResponse.json(
      { error: "Invalid boardImageBase64" },
      { status: 400 },
    );
  }
  const boardImageBytes = boardImageBase64
    ? imageByteLength(boardImageBase64)
    : 0;
  const utteranceText =
    typeof record.utteranceText === "string" ? record.utteranceText.trim() : "";
  if (
    (turnTrigger === "utterance" &&
      (utteranceText.length === 0 || utteranceText.length > 10_000)) ||
    utteranceText.length > 10_000
  ) {
    return NextResponse.json({ error: "Invalid utteranceText" }, { status: 400 });
  }
  const utteranceEndedAtEpochMs =
    typeof record.utteranceEndedAtEpochMs === "number" &&
    Number.isSafeInteger(record.utteranceEndedAtEpochMs) &&
    record.utteranceEndedAtEpochMs > 0 &&
    record.utteranceEndedAtEpochMs <= Date.now() + 5_000
      ? record.utteranceEndedAtEpochMs
      : routeStartedAt;
  const timerFiredAtEpochMs =
    typeof record.timerFiredAtEpochMs === "number" &&
    Number.isSafeInteger(record.timerFiredAtEpochMs) &&
    record.timerFiredAtEpochMs >= utteranceEndedAtEpochMs &&
    record.timerFiredAtEpochMs <= Date.now() + 5_000
      ? record.timerFiredAtEpochMs
      : utteranceEndedAtEpochMs;

  const sessionId = record.sessionId;
  if (inFlightTurns.has(sessionId)) {
    return NextResponse.json(
      { error: "Interviewer turn already in flight" },
      { status: 409 },
    );
  }
  inFlightTurns.add(sessionId);

  try {
    const [session, settings] = await Promise.all([
      prisma.session.findUnique({ where: { id: sessionId } }),
      getSettings(),
    ]);
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    if (session.status !== "active") {
      return NextResponse.json(
        { error: "Session must be active" },
        { status: 409 },
      );
    }

    const lastPhaseAdvanceForStall = await prisma.transcriptEntry.findFirst({
      where: {
        sessionId,
        kind: "phase_advance",
        suppressed: false,
      },
      orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
      select: { tsMs: true },
    });
    const phaseStartTsMs = lastPhaseAdvanceForStall?.tsMs ?? 0;
    if (
      turnTrigger === "stall" ||
      turnTrigger === "stall_drawing"
    ) {
      const stallNudges = await prisma.transcriptEntry.count({
        where: {
          sessionId,
          role: "interviewer",
          kind: "nudge",
          tsMs: { gte: phaseStartTsMs },
          trigger: { in: ["stall", "stall_drawing"] },
        },
      });
      if (stallNudges >= STALL_NUDGE_CAP_PER_PHASE) {
        console.log("Interviewer turn skipped:", {
          sessionId,
          reason: "stall:capped",
          stallNudges,
          phaseStartTsMs,
        });
        return new Response(null, { status: 204 });
      }
    }
    if (turnTrigger === "stall_maxgap") {
      console.log("Interviewer stall:maxgap", { sessionId, phaseStartTsMs });
    }
    if (!isInterviewPhase(session.currentPhase)) {
      return NextResponse.json(
        { error: "Session has an invalid current phase" },
        { status: 500 },
      );
    }

    if (
      turnTrigger === "opening" ||
      turnTrigger === "wrapup" ||
      turnTrigger === "closing"
    ) {
      const duplicate = await prisma.transcriptEntry.findFirst({
        where: {
          sessionId,
          role: "interviewer",
          trigger: turnTrigger,
          suppressed: false,
        },
        select: { id: true },
      });
      if (duplicate) {
        console.log("Interviewer turn skipped:", {
          trigger: turnTrigger,
          reason: "already persisted",
        });
        return new Response(null, { status: 204 });
      }
    }

    const canonicalElapsedMs = elapsedMs(session.startedAt);
    const latestInterviewer = await prisma.transcriptEntry.findFirst({
      where: { sessionId, role: "interviewer", suppressed: false },
      orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
    });
    const sinceLastInterviewerMs = latestInterviewer
      ? canonicalElapsedMs - latestInterviewer.tsMs
      : Number.POSITIVE_INFINITY;
    const classifierTurns = await prisma.transcriptEntry.findMany({
      where: {
        sessionId,
        suppressed: false,
        role: { in: ["candidate", "interviewer"] },
      },
      orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
      take: CLASSIFIER_TURN_LIMIT,
    });

    const classifierDigest = capDigestLines(
      record.sceneDigest,
      CLASSIFIER_DIGEST_MAX_LINES,
    );
    const generatorDigest = capDigestLines(
      record.sceneDigest,
      GENERATOR_DIGEST_MAX_LINES,
    );

    let decision: ClassifierDecision | null = null;
    let classifierMs = 0;
    let generatorMs = 0;
    let shortcircuit: "question" | null = null;
    let turnPromptTokens = 0;
    let turnCompletionTokens = 0;
    if (turnTrigger === "utterance") {
      if (isPrefilterShortUtterance(utteranceText)) {
        console.log("Interviewer classifier:", {
          action: "stay_silent",
          reason: "prefilter:short",
        });
        return new Response(null, { status: 204 });
      }
      if (isPrefilterFillerOnly(utteranceText)) {
        console.log("Interviewer classifier:", {
          action: "stay_silent",
          reason: "prefilter:filler",
        });
        return new Response(null, { status: 204 });
      }
      const qualifiesForQuestionShortcircuit =
        wordCount(utteranceText) >= QUESTION_SHORTCIRCUIT_MIN_WORDS &&
        utteranceText.endsWith("?") &&
        sinceLastInterviewerMs >= QUESTION_SHORTCIRCUIT_CLEARANCE_MS;
      if (qualifiesForQuestionShortcircuit) {
        shortcircuit = "question";
        decision = {
          action: "answer_question",
          advance_phase: false,
          reason: "shortcircuit=question",
        };
        console.log("Interviewer classifier bypass:", {
          shortcircuit: "question",
        });
      } else {
        const classifierStartedAt = performance.now();
        const classified = await callChat({
          model: settings.classifierModel,
          messages: classifierMessages({
            session,
            settings,
            elapsedMs: canonicalElapsedMs,
            sceneDigest: classifierDigest,
            turns: classifierTurns.reverse(),
            utteranceText,
          }),
          temperature: 0,
          maxTokens: CLASSIFIER_MAX_TOKENS,
        });
        classifierMs = Math.round(performance.now() - classifierStartedAt);
        turnPromptTokens += classified.usage.promptTokens;
        turnCompletionTokens += classified.usage.completionTokens;
        await addUsage(sessionId, classified.usage);
        decision = parseClassifierDecision(classified.content);
        console.log("Interviewer classifier:", {
          action: decision.action,
          reason: decision.reason,
        });
      }
      if (decision.action === "stay_silent") {
        return new Response(null, { status: 204 });
      }
      if (session.currentPhase === "wrapup") {
        decision.advance_phase = false;
      }
    }

    if (
      latestInterviewer &&
      sinceLastInterviewerMs < HARD_COOLDOWN_MS
    ) {
      console.log("Interviewer turn skipped:", {
        trigger: turnTrigger,
        reason: "hard_cooldown",
        sinceLastInterviewerMs,
      });
      return new Response(null, { status: 204 });
    }

    const floorApplies =
      (STALL_TURN_TRIGGERS.has(turnTrigger) &&
        turnTrigger !== "stall_maxgap") ||
      (turnTrigger === "utterance" &&
        decision?.action !== "answer_question");
    if (floorApplies) {
      if (
        latestInterviewer &&
        canonicalElapsedMs - latestInterviewer.tsMs < TURN_FLOOR_MS
      ) {
        console.log("Interviewer turn skipped:", {
          trigger: turnTrigger,
          reason: "floor",
        });
        return new Response(null, { status: 204 });
      }
    }

    const fullTurns = await prisma.transcriptEntry.findMany({
      where: {
        sessionId,
        suppressed: false,
        role: { in: ["candidate", "interviewer"] },
      },
      orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
      take: GENERATOR_TURN_LIMIT,
    });
    const lastPhaseAdvance = await prisma.transcriptEntry.findFirst({
      where: {
        sessionId,
        kind: "phase_advance",
        suppressed: false,
      },
      orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
      select: { tsMs: true },
    });
    const phaseStartMs = lastPhaseAdvance?.tsMs ?? 0;
    const phaseElapsedMs = Math.max(0, canonicalElapsedMs - phaseStartMs);
    const phaseElapsedMin = Math.floor(phaseElapsedMs / 60_000);
    const currentPhase = session.currentPhase as InterviewPhase;
    const phaseBudgetMinValue = phaseBudgetMin(
      currentPhase,
      settings.interviewDurationMin,
    );
    const advancePhase =
      session.currentPhase !== "wrapup" &&
      (decision?.advance_phase === true ||
        phaseElapsedMin > phaseBudgetMinValue);
    const helpRequestRows = await prisma.transcriptEntry.findMany({
      where: {
        sessionId,
        role: "candidate",
        suppressed: false,
      },
      select: { text: true },
    });
    const helpRequestCount = helpRequestRows.filter((row) =>
      isHelpRequestUtterance(row.text),
    ).length;
    const baseInstruction =
      turnTrigger === "utterance" &&
      decision &&
      decision.action !== "stay_silent"
        ? actionInstruction(decision.action, utteranceText)
        : triggerInstruction({
            trigger: turnTrigger as Exclude<TurnTrigger, "utterance">,
            problem: session.problem,
            currentPhase: session.currentPhase,
          });
    const boardContext = boardImageBase64
      ? "A fresh whiteboard image is attached. Inspect it together with the current scene digest."
      : record.sceneDigest.trim().length === 0
        ? "The board is empty. No image is attached."
        : boardChanged
          ? "The board changed, but fresh image capture exceeded its latency budget. Use the digest only for this turn."
          : "Board unchanged since the last image.";
    const instructionBase = `${baseInstruction}\n${boardContext}`;
    const instruction = advancePhase
      ? `${instructionBase}\nAppend <phase_note>one-line summary of the phase just completed</phase_note> after your reply.`
      : instructionBase;
    const fallbackInstructionBase = `${baseInstruction}\nThe fresh board image was rejected by the model. Answer from the current scene digest only.`;
    const fallbackInstruction = advancePhase
      ? `${fallbackInstructionBase}\nAppend <phase_note>one-line summary of the phase just completed</phase_note> after your reply.`
      : fallbackInstructionBase;

    const generatorStartedAt = performance.now();
    const orderedTurns = fullTurns.reverse();
    const generatorContext = {
      session,
      settings,
      elapsedMs: canonicalElapsedMs,
      phaseElapsedMin,
      phaseBudgetMin: phaseBudgetMinValue,
      phaseNotes: parsePhaseNotes(session.phaseNotesJson),
      turns: orderedTurns,
      sceneDigest: generatorDigest,
    };
    const textOnlyMessages = generatorMessages({
      ...generatorContext,
      instruction,
      helpRequestCount,
    });
    const fallbackMessages = boardImageBase64
      ? generatorMessages({
          ...generatorContext,
          instruction: fallbackInstruction,
          helpRequestCount,
        })
      : textOnlyMessages;
    const lastMessage = textOnlyMessages[textOnlyMessages.length - 1];
    const imageMessages = boardImageBase64
      ? [
          ...textOnlyMessages.slice(0, -1),
          {
            role: "user" as const,
            content: [
              {
                type: "text" as const,
                text:
                  typeof lastMessage.content === "string"
                    ? lastMessage.content
                    : instruction,
              },
              {
                type: "image_url" as const,
                image_url: { url: boardImageBase64 },
              },
            ],
          },
        ]
      : textOnlyMessages;
    let imageUsed = false;
    let generated: Awaited<ReturnType<typeof callChat>>;
    try {
      generated = await callChat({
        model: settings.interviewerModel,
        messages: imageMessages,
        temperature: 0.4,
        maxTokens: GENERATOR_MAX_TOKENS,
      });
      imageUsed = boardImageBase64 !== null;
      if (imageUsed && settings.interviewerVisionWarning) {
        await prisma.settings.update({
          where: { id: settings.id },
          data: { interviewerVisionWarning: "" },
        });
      }
    } catch (error) {
      const canRetryWithoutImage =
        boardImageBase64 !== null &&
        error instanceof OpenRouterError &&
        (error.status === 400 ||
          error.status === 404 ||
          error.status === 422);
      if (!canRetryWithoutImage) throw error;
      generated = await callChat({
        model: settings.interviewerModel,
        messages: fallbackMessages,
        temperature: 0.4,
        maxTokens: GENERATOR_MAX_TOKENS,
      });
      await prisma.settings.update({
        where: { id: settings.id },
        data: { interviewerVisionWarning: VISION_WARNING },
      });
      console.warn("Interviewer vision fallback:", {
        sessionId,
        model: settings.interviewerModel,
        warning: VISION_WARNING,
      });
    }
    generatorMs = Math.round(performance.now() - generatorStartedAt);
    turnPromptTokens += generated.usage.promptTokens;
    turnCompletionTokens += generated.usage.completionTokens;
    await addUsage(sessionId, generated.usage);

    const parsed = stripPhaseNote(generated.content);
    const reply = parsed.reply || "Let us continue. What would you consider next?";
    const action = decision?.action;
    const kind =
      turnTrigger === "opening"
        ? "opening"
        : turnTrigger === "wrapup" || turnTrigger === "closing"
          ? turnTrigger === "closing"
            ? "wrapup"
            : "wrapup"
          : STALL_TURN_TRIGGERS.has(turnTrigger)
            ? "nudge"
            : action && action !== "stay_silent"
              ? kindForAction(action)
              : "probe";
    const replyTsMs = elapsedMs(session.startedAt);
    const phaseNotes = parsePhaseNotes(session.phaseNotesJson);
    const nextPhase = advancePhase
      ? nextInterviewPhase(session.currentPhase as InterviewPhase)
      : null;

    const persisted = await prisma.$transaction(async (tx) => {
      const latestCandidate = await tx.transcriptEntry.findFirst({
        where: {
          sessionId,
          role: "candidate",
          suppressed: false,
        },
        orderBy: [{ tsMs: "desc" }, { createdAt: "desc" }],
        select: { tsMs: true },
      });
      const interviewerEntry = await tx.transcriptEntry.create({
        data: {
          sessionId,
          role: "interviewer",
          kind,
          trigger: turnTrigger,
          text: reply,
          tsMs: replyTsMs,
          suppressed: false,
        },
      });
      let phaseAdvanceEntry: typeof interviewerEntry | null = null;
      if (nextPhase && nextPhase !== session.currentPhase) {
        const note =
          parsed.phaseNote ??
          `${session.currentPhase}: ${decision?.reason ?? "phase completed"}`;
        await tx.session.update({
          where: { id: sessionId },
          data: {
            currentPhase: nextPhase,
            phaseNotesJson: JSON.stringify([...phaseNotes, note]),
          },
        });
        phaseAdvanceEntry = await tx.transcriptEntry.create({
          data: {
            sessionId,
            role: "system",
            kind: "phase_advance",
            text: `Phase advanced from ${session.currentPhase} to ${nextPhase}.`,
            tsMs: replyTsMs,
            suppressed: false,
          },
        });
      }
      return {
        entry: interviewerEntry,
        phaseAdvanceEntry,
        persistedCandidateThroughTsMs: latestCandidate?.tsMs ?? -1,
      };
    });

    const timing = {
      utteranceEndToTimerFireMs: Math.max(
        0,
        timerFiredAtEpochMs - utteranceEndedAtEpochMs,
      ),
      classifierMs,
      generatorMs,
      totalUtteranceToReplyMs: Math.max(
        0,
        Date.now() - utteranceEndedAtEpochMs,
      ),
      shortcircuit,
      image: imageUsed,
      imageBytes: imageUsed ? boardImageBytes : 0,
      promptTokens: turnPromptTokens,
      completionTokens: turnCompletionTokens,
    };
    console.log("Interviewer turn timing:", {
      sessionId,
      trigger: turnTrigger,
      boardContext:
        boardImageBase64 && !imageUsed
          ? "Image rejected; retried from digest only."
          : boardContext,
      ...timing,
    });
    return NextResponse.json(
      {
        entry: persisted.entry,
        phaseAdvanceEntry: persisted.phaseAdvanceEntry,
        persistedCandidateThroughTsMs:
          persisted.persistedCandidateThroughTsMs,
        currentPhase: nextPhase ?? session.currentPhase,
        phaseAdvanced: Boolean(persisted.phaseAdvanceEntry),
        timing,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof OpenRouterError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status >= 400 && error.status <= 599 ? error.status : 502 },
      );
    }
    console.error("Interviewer turn failed:", error);
    return NextResponse.json(
      { error: "Interviewer turn failed — retry" },
      { status: 500 },
    );
  } finally {
    inFlightTurns.delete(sessionId);
  }
}
