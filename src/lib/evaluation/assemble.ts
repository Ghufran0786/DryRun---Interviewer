import {
  EVALUATOR_SYSTEM_PROMPT,
  RUBRIC_DIMENSIONS,
} from "@/lib/evaluation/rubric";
import {
  INTERVIEW_PHASES,
  PHASE_LABELS,
  type InterviewPhase,
} from "@/lib/interviewPhases";
import type { ChatMessage } from "@/lib/openrouter";
import { digestFromElementsJson } from "@/lib/sceneDigest";
import { snapshotAbsolutePath } from "@/lib/snapshotStorage";
import fs from "node:fs/promises";
import sharp from "sharp";

export type TranscriptEntryLike = {
  id: string;
  role: string;
  kind: string | null;
  text: string;
  tsMs: number;
  suppressed: boolean;
};

export type SnapshotLike = {
  id: string;
  capturedAt: Date;
  pngPath: string;
  elementsJson: string;
  trigger: string;
};

export type SessionLike = {
  problem: string;
  targetLevel: string;
  startedAt: Date | null;
  endedAt: Date | null;
  reconnectCount: number;
  closeCodesJson: string | null;
  phaseNotesJson: string | null;
};

export type InterviewStats = {
  durationMin: number;
  candidateWords: number;
  interviewerTurns: number;
  nudgeCount: number;
  suppressedCount: number;
  reconnectCount: number;
  closeCodes: number[];
  phaseTimeline: Array<{ phase: string; minutes: number }>;
};

export type SelectedSnapshot = {
  id: string;
  pngPath: string;
  digest: string;
  reason: string;
};

const MAX_EVALUATION_IMAGES = 3;
const MAX_IMAGE_SIDE = 1280;

const OUTPUT_SCHEMA = `{
  "rubricVersion": "v1",
  "scores": [
    {
      "dimension": "requirements|estimation|api_data|hld|deepdive|tradeoffs|communication|whiteboard",
      "score": 0,
      "evidence": ["[mm:ss] quote or [snapshot:id] description"],
      "improvement": "string"
    }
  ],
  "verdict": "Strong Hire|Hire|Lean Hire|No Hire",
  "verdictRationale": "string",
  "levelEstimate": "SDE-1|SDE-2|Senior",
  "wouldPass": "string",
  "strengths": ["string"],
  "gaps": ["string"],
  "actionItems": ["string", "string", "string"],
  "phaseAnalysis": [{ "phase": "string", "minutes": 0, "assessment": "string" }]
}`;

function formatTsMs(tsMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(tsMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function parsePhaseNotes(value: string | null): string[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((note): note is string => typeof note === "string")
      : [];
  } catch {
    return [];
  }
}

function parseCloseCodesJson(value: string | null): number[] {
  if (!value) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (code): code is number =>
        typeof code === "number" && Number.isInteger(code),
    );
  } catch {
    return [];
  }
}

export function parsePhaseAdvanceTarget(text: string): string | null {
  const match = text.match(/\bto\s+([a-z]+)\./i);
  return match?.[1]?.toLowerCase() ?? null;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function computeStats(
  entries: TranscriptEntryLike[],
  session: SessionLike,
): InterviewStats {
  const visible = entries.filter((entry) => !entry.suppressed);
  const candidateWords = visible
    .filter((entry) => entry.role === "candidate")
    .reduce((sum, entry) => sum + countWords(entry.text), 0);
  const interviewerTurns = visible.filter(
    (entry) => entry.role === "interviewer",
  ).length;
  const nudgeCount = visible.filter(
    (entry) => entry.role === "interviewer" && entry.kind === "nudge",
  ).length;
  const suppressedCount = entries.filter((entry) => entry.suppressed).length;

  const durationMs =
    session.startedAt && session.endedAt
      ? Math.max(0, session.endedAt.getTime() - session.startedAt.getTime())
      : visible.length > 0
        ? Math.max(...visible.map((entry) => entry.tsMs))
        : 0;

  const advances = entries
    .filter(
      (entry) =>
        entry.role === "system" &&
        entry.kind === "phase_advance" &&
        !entry.suppressed,
    )
    .sort((left, right) => left.tsMs - right.tsMs);

  const phaseTimeline: Array<{ phase: string; minutes: number }> = [];
  const phaseNotes = parsePhaseNotes(session.phaseNotesJson);
  let currentPhase: InterviewPhase = INTERVIEW_PHASES[0];
  let segmentStartMs = 0;

  for (const advance of advances) {
    const target = parsePhaseAdvanceTarget(advance.text);
    const fromMatch = advance.text.match(/\bfrom\s+([a-z]+)\s+to\s+([a-z]+)\./i);
    const fromPhase = fromMatch?.[1]?.toLowerCase() ?? null;
    const toPhase = fromMatch?.[2]?.toLowerCase() ?? target;
    if (fromPhase && toPhase && fromPhase === toPhase) {
      continue;
    }
    if (target && target === currentPhase && fromPhase === currentPhase) {
      continue;
    }
    const minutes = Math.max(
      0,
      Math.round(((advance.tsMs - segmentStartMs) / 60_000) * 10) / 10,
    );
    phaseTimeline.push({
      phase: PHASE_LABELS[currentPhase] ?? currentPhase,
      minutes,
    });
    if (target && (INTERVIEW_PHASES as readonly string[]).includes(target)) {
      currentPhase = target as (typeof INTERVIEW_PHASES)[number];
    }
    segmentStartMs = advance.tsMs;
  }

  const tailMinutes = Math.max(
    0,
    Math.round(((durationMs - segmentStartMs) / 60_000) * 10) / 10,
  );
  phaseTimeline.push({
    phase: PHASE_LABELS[currentPhase] ?? currentPhase,
    minutes: tailMinutes,
  });

  if (phaseNotes.length > 0 && phaseTimeline.length === 1) {
    phaseTimeline[0] = {
      ...phaseTimeline[0],
      phase: `${phaseTimeline[0].phase} (${phaseNotes.length} notes)`,
    };
  }

  return {
    durationMin: Math.round((durationMs / 60_000) * 10) / 10,
    candidateWords,
    interviewerTurns,
    nudgeCount,
    suppressedCount,
    reconnectCount: session.reconnectCount,
    closeCodes: parseCloseCodesJson(session.closeCodesJson),
    phaseTimeline,
  };
}

function snapshotElapsedMs(
  snapshot: SnapshotLike,
  startedAt: Date | null,
): number {
  if (!startedAt) {
    return snapshot.capturedAt.getTime();
  }
  return Math.max(0, snapshot.capturedAt.getTime() - startedAt.getTime());
}

function nearestSnapshot(
  snapshots: SnapshotLike[],
  tsMs: number,
  startedAt: Date | null,
): SnapshotLike | null {
  if (snapshots.length === 0) {
    return null;
  }
  return snapshots.reduce((best, candidate) => {
    const bestDelta = Math.abs(snapshotElapsedMs(best, startedAt) - tsMs);
    const candidateDelta = Math.abs(
      snapshotElapsedMs(candidate, startedAt) - tsMs,
    );
    return candidateDelta < bestDelta ? candidate : best;
  });
}

export function selectSnapshots(
  snapshots: SnapshotLike[],
  entries: TranscriptEntryLike[],
  startedAt: Date | null = null,
): SelectedSnapshot[] {
  const ordered = [...snapshots].sort(
    (left, right) => left.capturedAt.getTime() - right.capturedAt.getTime(),
  );
  if (ordered.length === 0) {
    return [];
  }

  const finalSnapshot =
    ordered.find((snapshot) => snapshot.trigger === "final") ??
    ordered[ordered.length - 1];

  const selected: SelectedSnapshot[] = [
    {
      id: finalSnapshot.id,
      pngPath: finalSnapshot.pngPath,
      digest: digestFromElementsJson(finalSnapshot.elementsJson),
      reason: finalSnapshot.trigger === "final" ? "final" : "latest",
    },
  ];

  const boundaryPhases = ["hld", "deepdive"] as const;
  for (const phase of boundaryPhases) {
    const advances = entries
      .filter(
        (entry) =>
          entry.role === "system" &&
          entry.kind === "phase_advance" &&
          parsePhaseAdvanceTarget(entry.text) === phase,
      )
      .sort((left, right) => left.tsMs - right.tsMs);
    const advance = advances[advances.length - 1];
    if (!advance) {
      continue;
    }
    const nearest = nearestSnapshot(ordered, advance.tsMs, startedAt);
    if (!nearest || selected.some((item) => item.id === nearest.id)) {
      continue;
    }
    selected.push({
      id: nearest.id,
      pngPath: nearest.pngPath,
      digest: digestFromElementsJson(nearest.elementsJson),
      reason: `phase_boundary_${phase}`,
    });
  }

  return selected.slice(0, MAX_EVALUATION_IMAGES);
}

async function snapshotToDataUri(
  snapshot: SelectedSnapshot,
): Promise<{ dataUri: string; bytes: number }> {
  const absolutePath = snapshotAbsolutePath(snapshot.pngPath);
  const input = await fs.readFile(absolutePath);
  const resized = await sharp(input)
    .resize({
      width: MAX_IMAGE_SIDE,
      height: MAX_IMAGE_SIDE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .png()
    .toBuffer();
  const dataUri = `data:image/png;base64,${resized.toString("base64")}`;
  return { dataUri, bytes: resized.length };
}

export type BuildEvaluationMessagesInput = {
  session: SessionLike;
  settings: {
    candidateName: string;
    strictness: string;
    interviewDurationMin: number;
    resumeText: string;
  };
  stats: InterviewStats;
  entries: TranscriptEntryLike[];
  selectedSnapshots: SelectedSnapshot[];
};

export async function buildEvaluationMessages(
  input: BuildEvaluationMessagesInput,
): Promise<{
  messages: ChatMessage[];
  structureLog: {
    textPartCount: number;
    imagePartCount: number;
    includesResume: boolean;
    snapshotIds: string[];
  };
}> {
  const transcriptLines = input.entries
    .filter((entry) => !entry.suppressed)
    .sort((left, right) => left.tsMs - right.tsMs)
    .map((entry) => {
      const kindSuffix = entry.kind ? `(${entry.kind})` : "";
      return `[${formatTsMs(entry.tsMs)}] ${entry.role}${kindSuffix}: ${entry.text}`;
    });

  const rubricBlock = RUBRIC_DIMENSIONS.map(
    (dimension) =>
      `${dimension.key} | ${dimension.label} | weight ${dimension.weight} | ${dimension.description} | Anchors: ${dimension.anchors}`,
  ).join("\n");

  const statsBlock = [
    `durationMin: ${input.stats.durationMin}`,
    `candidateWords: ${input.stats.candidateWords}`,
    `interviewerTurns: ${input.stats.interviewerTurns}`,
    `nudgeCount: ${input.stats.nudgeCount}`,
    `suppressedCount: ${input.stats.suppressedCount}`,
    `reconnectCount: ${input.stats.reconnectCount}`,
    `closeCodes: ${input.stats.closeCodes.length > 0 ? input.stats.closeCodes.join(", ") : "none"}`,
    "phaseTimeline:",
    ...input.stats.phaseTimeline.map(
      (item) => `- ${item.phase}: ${item.minutes} min`,
    ),
  ].join("\n");

  const headerLines = [
    `Problem: ${input.session.problem}`,
    `Target level: ${input.session.targetLevel}`,
    `Strictness: ${input.settings.strictness}`,
    `Duration budget: ${input.settings.interviewDurationMin} minutes`,
    `Candidate name: ${input.settings.candidateName.trim() || "not provided"}`,
  ];

  const resumeText = input.settings.resumeText.trim();
  const includesResume = resumeText.length > 0;
  if (includesResume) {
    headerLines.push(
      `Candidate resume for role-fit context:\n${resumeText}`,
    );
  }

  const digestBlocks = input.selectedSnapshots.map(
    (snapshot) =>
      `[snapshot:${snapshot.id}] (${snapshot.reason})\n${snapshot.digest}`,
  );

  const textSections = [
    headerLines.join("\n"),
    `Interview statistics:\n${statsBlock}`,
    `Rubric dimensions:\n${rubricBlock}`,
    `Transcript:\n${transcriptLines.join("\n") || "(empty)"}`,
    digestBlocks.length > 0
      ? `Whiteboard digests:\n${digestBlocks.join("\n\n")}`
      : "Whiteboard digests:\n(none)",
    `Output schema (JSON only):\n${OUTPUT_SCHEMA}`,
  ];

  const userText = textSections.join("\n\n");
  const imageParts: { type: "image_url"; image_url: { url: string } }[] = [];
  for (const snapshot of input.selectedSnapshots.slice(0, MAX_EVALUATION_IMAGES)) {
    const { dataUri } = await snapshotToDataUri(snapshot);
    imageParts.push({
      type: "image_url",
      image_url: { url: dataUri },
    });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: EVALUATOR_SYSTEM_PROMPT },
    {
      role: "user",
      content: [{ type: "text", text: userText }, ...imageParts],
    },
  ];

  return {
    messages,
    structureLog: {
      textPartCount: 1,
      imagePartCount: imageParts.length,
      includesResume,
      snapshotIds: input.selectedSnapshots.map((snapshot) => snapshot.id),
    },
  };
}

export function parseFirstJsonObject(content: string): unknown {
  const block = content.match(/\{[\s\S]*\}/)?.[0];
  if (!block) {
    throw new Error("No JSON object found in evaluator response");
  }
  return JSON.parse(block) as unknown;
}
