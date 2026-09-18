import {
  SESSION_STATUSES,
  STRICTNESS_LEVELS,
  TARGET_LEVELS,
  type SessionStatus,
  type Strictness,
  type TargetLevel,
} from "@/lib/types";

export function isTargetLevel(value: string): value is TargetLevel {
  return (TARGET_LEVELS as readonly string[]).includes(value);
}

export function isSessionStatus(value: string): value is SessionStatus {
  return (SESSION_STATUSES as readonly string[]).includes(value);
}

export function isStrictness(value: string): value is Strictness {
  return (STRICTNESS_LEVELS as readonly string[]).includes(value);
}

export function parseNonEmptyString(
  value: unknown,
  field: string,
  maxLength = 10_000,
): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }
  return trimmed;
}

export function parseOptionalString(
  value: unknown,
  maxLength = 100_000,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  if (value.length > maxLength) {
    return undefined;
  }
  return value;
}
