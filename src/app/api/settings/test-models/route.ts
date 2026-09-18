import { prisma } from "@/lib/db";
import { callChat, OpenRouterError } from "@/lib/openrouter";
import { getSettings } from "@/lib/settings";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type ModelRole = "classifier" | "interviewer" | "evaluator";
const VISION_WARNING =
  "interviewer model rejects image input — choose a vision-capable model.";
const VISION_TEST_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAIAAAD8GO2jAAAAmElEQVR4nM2WSw6AMAgFuf+ldVETG1u+ZRLdmT7mRaSAiMiFPTLokMcDn1/a6a9Br8eMEu2ghf41OPdYwze4ssc2cM8qeGghKijlYYgtStDDljkI18MX2Mc2IvKJ9SREExgRrbh4CVRKJVdgcelAZ6/InwzYFLE/mS1T9qKxrYJtdmy7ZgcOOzLZoc+uLezixa6O7PJLr+830101ZijwSwEAAAAASUVORK5CYII=";

async function testModel(role: ModelRole, model: string) {
  const startedAt = performance.now();
  try {
    await callChat({
      model,
      messages: [
        {
          role: "user",
          content:
            role === "interviewer"
              ? [
                  { type: "text", text: "Reply with OK." },
                  {
                    type: "image_url",
                    image_url: { url: VISION_TEST_PNG },
                  },
                ]
              : "Reply with OK.",
        },
      ],
      temperature: 0,
      maxTokens: 5,
    });
    return {
      role,
      model,
      ok: true,
      visionRejected: false,
      latencyMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    const visionRejected =
      role === "interviewer" &&
      error instanceof OpenRouterError &&
      (error.status === 400 ||
        error.status === 404 ||
        error.status === 422);
    return {
      role,
      model,
      ok: false,
      visionRejected,
      latencyMs: Math.round(performance.now() - startedAt),
      error: visionRejected
        ? VISION_WARNING
        : error instanceof Error
          ? error.message
          : "Model test failed",
    };
  }
}

export async function POST() {
  const settings = await getSettings();
  const results = await Promise.all([
    testModel("classifier", settings.classifierModel),
    testModel("interviewer", settings.interviewerModel),
    testModel("evaluator", settings.evaluatorModel),
  ]);
  const interviewerResult = results.find(
    (result) => result.role === "interviewer",
  );
  const interviewerVisionWarning = interviewerResult?.visionRejected
    ? VISION_WARNING
    : interviewerResult?.ok
      ? ""
      : settings.interviewerVisionWarning;
  if (
    interviewerVisionWarning !== settings.interviewerVisionWarning
  ) {
    await prisma.settings.update({
      where: { id: settings.id },
      data: { interviewerVisionWarning },
    });
  }
  return NextResponse.json({ results, interviewerVisionWarning });
}
