import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import {
  isStrictness,
  isTargetLevel,
  parseOptionalString,
} from "@/lib/validation";
import { NextResponse } from "next/server";

export async function GET() {
  const settings = await getSettings();
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
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
  const data: {
    candidateName?: string;
    defaultTargetLevel?: string;
    classifierModel?: string;
    interviewerModel?: string;
    evaluatorModel?: string;
    ttsEnabled?: boolean;
    ttsModel?: string;
    ttsVoice?: string;
    usingHeadphones?: boolean;
    interviewDurationMin?: number;
    keyterms?: string;
    strictness?: string;
    resumeText?: string;
    localEvaluationEnabled?: boolean;
  } = {};

  const candidateName = parseOptionalString(record.candidateName, 200);
  if (candidateName !== undefined) {
    data.candidateName = candidateName;
  }

  const classifierModel = parseOptionalString(record.classifierModel, 200);
  if (classifierModel !== undefined) {
    if (classifierModel.trim().length === 0) {
      return NextResponse.json(
        { error: "classifierModel cannot be empty" },
        { status: 400 },
      );
    }
    data.classifierModel = classifierModel.trim();
  }

  if (typeof record.defaultTargetLevel === "string") {
    if (!isTargetLevel(record.defaultTargetLevel)) {
      return NextResponse.json(
        { error: "Invalid defaultTargetLevel" },
        { status: 400 },
      );
    }
    data.defaultTargetLevel = record.defaultTargetLevel;
  }

  const interviewerModel = parseOptionalString(record.interviewerModel, 200);
  if (interviewerModel !== undefined) {
    if (interviewerModel.trim().length === 0) {
      return NextResponse.json(
        { error: "interviewerModel cannot be empty" },
        { status: 400 },
      );
    }
    data.interviewerModel = interviewerModel.trim();
  }

  const evaluatorModel = parseOptionalString(record.evaluatorModel, 200);
  if (evaluatorModel !== undefined) {
    if (evaluatorModel.trim().length === 0) {
      return NextResponse.json(
        { error: "evaluatorModel cannot be empty" },
        { status: 400 },
      );
    }
    data.evaluatorModel = evaluatorModel.trim();
  }

  if (record.ttsEnabled !== undefined) {
    if (typeof record.ttsEnabled !== "boolean") {
      return NextResponse.json({ error: "ttsEnabled must be boolean" }, { status: 400 });
    }
    data.ttsEnabled = record.ttsEnabled;
  }

  const ttsModel = parseOptionalString(record.ttsModel, 200);
  if (ttsModel !== undefined) {
    data.ttsModel = ttsModel.trim();
  }

  const ttsVoice = parseOptionalString(record.ttsVoice, 200);
  if (ttsVoice !== undefined) {
    data.ttsVoice = ttsVoice.trim();
  }

  if (record.usingHeadphones !== undefined) {
    if (typeof record.usingHeadphones !== "boolean") {
      return NextResponse.json(
        { error: "usingHeadphones must be boolean" },
        { status: 400 },
      );
    }
    data.usingHeadphones = record.usingHeadphones;
  }

  if (record.interviewDurationMin !== undefined) {
    if (
      typeof record.interviewDurationMin !== "number" ||
      !Number.isSafeInteger(record.interviewDurationMin) ||
      record.interviewDurationMin < 2 ||
      record.interviewDurationMin > 180
    ) {
      return NextResponse.json(
        { error: "interviewDurationMin must be an integer from 2 to 180" },
        { status: 400 },
      );
    }
    data.interviewDurationMin = record.interviewDurationMin;
  }

  const keyterms = parseOptionalString(record.keyterms, 10_000);
  if (keyterms !== undefined) {
    data.keyterms = keyterms;
  }

  if (typeof record.strictness === "string") {
    if (!isStrictness(record.strictness)) {
      return NextResponse.json({ error: "Invalid strictness" }, { status: 400 });
    }
    data.strictness = record.strictness;
  }

  const resumeText = parseOptionalString(record.resumeText, 200_000);
  if (resumeText !== undefined) {
    data.resumeText = resumeText;
  }

  if (record.localEvaluationEnabled !== undefined) {
    if (typeof record.localEvaluationEnabled !== "boolean") {
      return NextResponse.json(
        { error: "localEvaluationEnabled must be boolean" },
        { status: 400 },
      );
    }
    data.localEvaluationEnabled = record.localEvaluationEnabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await getSettings();

  const settings = await prisma.settings.update({
    where: { id: "singleton" },
    data,
  });

  return NextResponse.json(settings);
}
