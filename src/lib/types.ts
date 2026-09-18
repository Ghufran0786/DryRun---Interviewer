export const TARGET_LEVELS = ["SDE-1", "SDE-2", "Senior"] as const;
export type TargetLevel = (typeof TARGET_LEVELS)[number];

export const SESSION_STATUSES = ["created", "active", "completed"] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TRANSCRIPT_ROLES = ["candidate", "interviewer", "system"] as const;
export type TranscriptRole = (typeof TRANSCRIPT_ROLES)[number];

export const TRANSCRIPT_KINDS = [
  "opening",
  "probe",
  "nudge",
  "answer",
  "phase_advance",
  "wrapup",
] as const;
export type TranscriptKind = (typeof TRANSCRIPT_KINDS)[number];

export const STRICTNESS_LEVELS = ["Lenient", "Standard", "Bar-raiser"] as const;
export type Strictness = (typeof STRICTNESS_LEVELS)[number];

