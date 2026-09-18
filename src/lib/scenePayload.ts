export type ScenePayload = {
  elements: unknown[];
  files: Record<string, unknown>;
};

export function parseSceneJson(raw: string | null | undefined): ScenePayload | null {
  if (!raw) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    const record = parsed as Record<string, unknown>;
    if (!Array.isArray(record.elements)) {
      return null;
    }
    const files =
      record.files && typeof record.files === "object" && !Array.isArray(record.files)
        ? (record.files as Record<string, unknown>)
        : {};
    return { elements: record.elements, files };
  } catch {
    return null;
  }
}

export function serializeScenePayload(payload: ScenePayload): string {
  return JSON.stringify({
    elements: payload.elements,
    files: payload.files,
  });
}

export function validateSceneBody(body: unknown): ScenePayload | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (!Array.isArray(record.elements)) {
    return null;
  }
  const files =
    record.files && typeof record.files === "object" && !Array.isArray(record.files)
      ? (record.files as Record<string, unknown>)
      : {};
  return { elements: record.elements, files };
}
