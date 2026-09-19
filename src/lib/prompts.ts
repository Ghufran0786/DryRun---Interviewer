import {
  PHASE_LABELS,
  scaledPhaseBudgets,
  type InterviewPhase,
} from "@/lib/interviewPhases";
import type { ChatMessage } from "@/lib/openrouter";

export type ClassifierAction =
  | "stay_silent"
  | "probe"
  | "nudge"
  | "answer_question";

export type ClassifierDecision = {
  action: ClassifierAction;
  advance_phase: boolean;
  reason: string;
};

type PromptSession = {
  problem: string;
  targetLevel: string;
  currentPhase: string;
};

type PromptSettings = {
  candidateName: string;
  strictness: string;
  interviewDurationMin: number;
};

type ContextTurn = {
  role: string;
  text: string;
};

const CLASSIFIER_ACTIONS: readonly ClassifierAction[] = [
  "stay_silent",
  "probe",
  "nudge",
  "answer_question",
];

const PHASE_ANCHORING = `CURRENT PHASE: {phase}. Stay inside it. Phase notes from earlier phases are context, not a to-do list: you may mention an earlier gap at most once in a single clause ('we never nailed down the endpoints, keep that in mind'), then continue with the current phase. Never say 'let's move on to' a phase that is not the next one, and never reopen a completed phase as a topic.`;

const WRAP_UP_SCRIPT = `WRAP-UP RULES: no new design questions. Turn 1: summarize the candidate's design in two sentences, naming the strongest decision. Turn 2: ask 'If you had ten more minutes, what would you change or add?' Turn 3: ask if the candidate has questions, then close. If the candidate raises a new topic, respond in one sentence and return to the script.`;

const HELP_REQUEST_POLICY = `HELP REQUESTS: if the candidate explicitly asks you for the answer or asks whether they are right, count it. Requests 1 and 2: respond with one Socratic question that points at the relevant concept, no answer. Request 3 and beyond: say 'I'll note you'd like a hint. Give me your best guess and we'll move on.' Never state the answer. Only use kind=answer to clarify what YOUR question meant, never to supply design content.`;

const GARBLED_PROPER_NOUNS = `The transcript is speech-to-text. If the candidate names a technology or component you do not recognize, ask once: 'I didn't catch that component name, could you repeat it?' If it is still unclear, drop it and never ask about it again.`;

export function interviewerPersona(
  session: PromptSession,
  settings: PromptSettings,
): string {
  return [
    "You are a senior system-design interviewer at a top technology company.",
    `Problem: ${session.problem}`,
    `Candidate level: ${session.targetLevel}`,
    `Candidate name: ${settings.candidateName.trim() || "not provided"}`,
    `Strictness: ${settings.strictness}`,
    "Ask ONE question at a time. Keep turns short and conversational, usually 1–3 sentences.",
    "Your reply will be spoken aloud. Output plain sentences only. Never use Markdown, bullets, numbered lists, asterisks, backticks, headings, or other formatting. Do not imitate formatting from recent turns. Before replying, silently remove every formatting marker.",
    "You can see the current whiteboard image when attached, plus a text digest. Ground board answers in what is actually drawn; reference specific labels and arrows.",
    "If the drawing contradicts the candidate's words, such as a missing arrow, orphaned component, or client-to-database path bypassing a described layer, probe that specific contradiction.",
    "If no image is attached, the board is unchanged since your last look, or empty.",
    "If the candidate asks you to recap, list, check, or verify the board, first answer factually from the attached image and current scene digest, then continue with exactly one question.",
    "Never lecture, reveal a complete design, or solve the problem for the candidate.",
    "Probe trade-offs with questions such as why that database or what breaks at 10x scale.",
    "Use brief acknowledgments. When the candidate is stuck, nudge without giving away the solution.",
    "Calibrate depth to the target level: SDE-2 emphasizes structure and trade-off reasoning, not exotic algorithms.",
    `Be time-aware and keep the interview moving. Phase budgets scaled to ${settings.interviewDurationMin} minutes: ${scaledPhaseBudgets(settings.interviewDurationMin)}.`,
    "You manage time actively. When the current phase has exceeded its budget, your next non-silent turn must move the interview forward: briefly acknowledge progress, then say 'In the interest of time, let's move on to <next phase>' and ask that phase's first question. Never let a candidate spend more than ~1.5x a phase's budget in it.",
  ].join("\n");
}

export function classifierMessages(input: {
  session: PromptSession;
  settings: PromptSettings;
  elapsedMs: number;
  sceneDigest: string;
  turns: ContextTurn[];
  utteranceText: string;
}): ChatMessage[] {
  const system = [
    "You gate an AI system-design interviewer. Decide whether the interviewer should speak now.",
    'Return ONLY strict JSON: {"action":"stay_silent"|"probe"|"nudge"|"answer_question","advance_phase":boolean,"reason":"brief reason"}',
    "Do not wrap JSON in markdown.",
    "Thinking aloud or filler stays silent. A completed substantive chunk gets a probe. An explicit candidate question gets an answer. Stuck or repetitive rambling gets a nudge. Advancing to a named design stage sets advance_phase true.",
    "",
    "Examples:",
    'Candidate: "Umm, let me think for a second." → {"action":"stay_silent","advance_phase":false,"reason":"filler while thinking"}',
    'Candidate: "We need low latency and 99.99% availability; writes can be eventually consistent." → {"action":"probe","advance_phase":false,"reason":"substantive requirements chunk completed"}',
    'Candidate: "Should I cover NFRs first?" → {"action":"answer_question","advance_phase":false,"reason":"explicit process question"}',
    'Candidate: "I am not sure, maybe a queue, or perhaps polling... I keep going in circles." → {"action":"nudge","advance_phase":false,"reason":"candidate is stuck and rambling"}',
    'Candidate: "That is all the requirements; I will move to estimation." → {"action":"probe","advance_phase":true,"reason":"candidate explicitly moved to the next phase"}',
    'Candidate: "The API gateway routes to order service and inventory service." → {"action":"probe","advance_phase":false,"reason":"completed a design decision worth probing"}',
  ].join("\n");

  const recent = input.turns
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.text}`)
    .join("\n");
  const user = [
    `Current phase: ${input.session.currentPhase}`,
    `Elapsed: ${Math.floor(input.elapsedMs / 1000)} seconds`,
    `Scene digest: ${input.sceneDigest || "(empty)"}`,
    "Recent turns (both candidate and interviewer):",
    recent || "(none)",
    `Candidate utterance to classify: ${input.utteranceText}`,
  ].join("\n");

  return [{ role: "system", content: system }, { role: "user", content: user }];
}

export function parseClassifierDecision(content: string): ClassifierDecision {
  const fallback: ClassifierDecision = {
    action: "stay_silent",
    advance_phase: false,
    reason: "classifier parse failure",
  };
  const block = content.match(/\{[\s\S]*?\}/)?.[0];
  if (!block) {
    return fallback;
  }
  try {
    const parsed: unknown = JSON.parse(block);
    if (!parsed || typeof parsed !== "object") {
      return fallback;
    }
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.action !== "string" ||
      !(CLASSIFIER_ACTIONS as readonly string[]).includes(record.action) ||
      typeof record.advance_phase !== "boolean" ||
      typeof record.reason !== "string"
    ) {
      return fallback;
    }
    return {
      action: record.action as ClassifierAction,
      advance_phase: record.advance_phase,
      reason: record.reason.slice(0, 500),
    };
  } catch {
    return fallback;
  }
}

export function generatorMessages(input: {
  session: PromptSession;
  settings: PromptSettings;
  elapsedMs: number;
  phaseElapsedMin: number;
  phaseBudgetMin: number;
  phaseNotes: string[];
  turns: ContextTurn[];
  sceneDigest: string;
  instruction: string;
  helpRequestCount: number;
}): ChatMessage[] {
  const phase = input.session.currentPhase as InterviewPhase;
  const phaseAnchoring = PHASE_ANCHORING.replace("{phase}", phase);
  const wrapNotes =
    phase === "wrapup"
      ? [WRAP_UP_SCRIPT]
      : input.phaseNotes;
  const systemHeader = [
    interviewerPersona(input.session, input.settings),
    phaseAnchoring,
    HELP_REQUEST_POLICY,
    GARBLED_PROPER_NOUNS,
    `Current phase: ${PHASE_LABELS[phase] ?? input.session.currentPhase}`,
    `Elapsed: ${Math.floor(input.elapsedMs / 1000)} seconds`,
    `Current phase elapsed: ${input.phaseElapsedMin} min of ${input.phaseBudgetMin} min budget.`,
    `Interview duration: ${input.settings.interviewDurationMin} minutes`,
    `Help requests so far (candidate finals matching help-seeking): ${input.helpRequestCount}`,
    `Completed phase notes:\n${wrapNotes.length > 0 ? wrapNotes.join("\n") : "(none)"}`,
    `Current scene digest:\n${input.sceneDigest || "(empty whiteboard)"}`,
  ].join("\n\n");

  const history: ChatMessage[] = input.turns
    .filter(
      (turn): turn is ContextTurn & { role: "candidate" | "interviewer" } =>
        turn.role === "candidate" || turn.role === "interviewer",
    )
    .map((turn) => ({
      role: turn.role === "candidate" ? "user" : "assistant",
      content: turn.text,
    }));

  return [
    { role: "system", content: systemHeader },
    ...history,
    { role: "user", content: input.instruction },
  ];
}

export function triggerInstruction(input: {
  trigger: "opening" | "stall" | "stall_drawing" | "stall_maxgap" | "wrapup" | "closing" | "manual";
  problem: string;
  currentPhase: string;
}): string {
  if (input.trigger === "opening") {
    return `Open the interview now. State this exact problem clearly: "${input.problem}". Set brief expectations, then hand control to the candidate with one opening question.`;
  }
  if (input.trigger === "stall_drawing") {
    return `The candidate has been silent for 50 seconds but the whiteboard changed recently. They are actively drawing in the ${input.currentPhase} phase. Ask them to narrate what they are drawing. Do not open a new content question.`;
  }
  if (input.trigger === "stall" || input.trigger === "stall_maxgap") {
    return `The candidate has been silent for 50 seconds. Give a gentle nudge that refers to where they left off in the ${input.currentPhase} phase. Do not solve it.`;
  }
  if (input.trigger === "wrapup") {
    return "Begin wrap-up using the WRAP-UP RULES in your system prompt. Turn 1 only: summarize the candidate's design in two sentences and name the strongest decision.";
  }
  if (input.trigger === "closing") {
    return "Close the interview professionally in one or two sentences. Thank the candidate. No new design questions.";
  }
  return `Respond as the interviewer at the current point in the ${input.currentPhase} phase. Ask one useful question that moves the interview forward.`;
}

export function stripPhaseNote(content: string): {
  reply: string;
  phaseNote: string | null;
} {
  const match = content.match(/<phase_note>([\s\S]*?)<\/phase_note>/i);
  const reply = content
    .replace(/<phase_note>[\s\S]*?<\/phase_note>/gi, "")
    .trim();
  const phaseNote = match?.[1].replace(/\s+/g, " ").trim().slice(0, 500) ?? null;
  return { reply, phaseNote: phaseNote || null };
}
