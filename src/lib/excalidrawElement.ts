/** Minimal element shape shared by snapshot gate, digest, and API validation. */
export type DryRunExcalidrawElement = {
  id: string;
  type: string;
  isDeleted?: boolean;
  version: number;
  text?: string;
  containerId?: string | null;
  startBinding?: { elementId: string } | null;
  endBinding?: { elementId: string } | null;
};

export function parseElementsJson(json: string): DryRunExcalidrawElement[] {
  const parsed: unknown = JSON.parse(json);
  if (!Array.isArray(parsed)) {
    return [];
  }
  return parsed.filter(isElementLike);
}

function isElementLike(value: unknown): value is DryRunExcalidrawElement {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.type === "string" &&
    typeof record.version === "number"
  );
}

export function nonDeletedElements(
  elements: readonly DryRunExcalidrawElement[],
): DryRunExcalidrawElement[] {
  return elements.filter((el) => el.isDeleted !== true);
}
