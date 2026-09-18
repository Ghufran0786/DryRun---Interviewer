import {
  type DryRunExcalidrawElement,
  nonDeletedElements,
  parseElementsJson,
} from "@/lib/excalidrawElement";

export type SceneSignature = {
  count: number;
  versionSum: number;
};

export function sceneSignature(
  elements: readonly DryRunExcalidrawElement[],
): SceneSignature {
  const active = nonDeletedElements(elements);
  let versionSum = 0;
  for (const el of active) {
    versionSum += el.version;
  }
  return { count: active.length, versionSum };
}

export function isMaterialChange(
  previous: SceneSignature | null,
  next: SceneSignature,
): boolean {
  if (previous === null) {
    return next.count > 0;
  }
  return previous.count !== next.count || previous.versionSum !== next.versionSum;
}

export function signatureFromElementsJson(json: string): SceneSignature {
  return sceneSignature(parseElementsJson(json));
}
