import {
  type DryRunExcalidrawElement,
  nonDeletedElements,
  parseElementsJson,
} from "./excalidrawElement";

const SPATIAL_TOLERANCE = 24;
const SHAPE_TYPES = new Set(["rectangle", "diamond", "ellipse"]);

type Point = { x: number; y: number };
type BBox = Point & { width: number; height: number };
type DigestElement = DryRunExcalidrawElement & {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  points?: readonly (readonly [number, number])[];
  boundElements?: readonly { id: string; type?: string }[] | null;
};

type LabelResolution = {
  labelsByShapeId: Map<string, string>;
  consumedTextIds: Set<string>;
  textOwnerById: Map<string, DigestElement>;
};

function numberOrZero(value: number | undefined): number {
  return Number.isFinite(value) ? (value ?? 0) : 0;
}

function bbox(element: DigestElement): BBox {
  const x = numberOrZero(element.x);
  const y = numberOrZero(element.y);
  const width = numberOrZero(element.width);
  const height = numberOrZero(element.height);
  return {
    x: width >= 0 ? x : x + width,
    y: height >= 0 ? y : y + height,
    width: Math.abs(width),
    height: Math.abs(height),
  };
}

function center(element: DigestElement): Point {
  const box = bbox(element);
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

function area(element: DigestElement): number {
  const box = bbox(element);
  return box.width * box.height;
}

function distanceToBox(point: Point, box: BBox): number {
  const dx = Math.max(box.x - point.x, 0, point.x - (box.x + box.width));
  const dy = Math.max(box.y - point.y, 0, point.y - (box.y + box.height));
  return Math.hypot(dx, dy);
}

function centerDistance(a: DigestElement, point: Point): number {
  const candidateCenter = center(a);
  return Math.hypot(candidateCenter.x - point.x, candidateCenter.y - point.y);
}

function readingOrder(a: DigestElement, b: DigestElement): number {
  const aBox = bbox(a);
  const bBox = bbox(b);
  return aBox.y - bBox.y || aBox.x - bBox.x || a.id.localeCompare(b.id);
}

function pickSpatialShape(
  point: Point,
  shapes: readonly DigestElement[],
): DigestElement | undefined {
  const candidates = shapes
    .map((shape) => ({
      shape,
      edgeDistance: distanceToBox(point, bbox(shape)),
      centerDistance: centerDistance(shape, point),
    }))
    .filter(({ edgeDistance }) => edgeDistance <= SPATIAL_TOLERANCE);

  candidates.sort((a, b) => {
    const aInside = a.edgeDistance === 0;
    const bInside = b.edgeDistance === 0;
    if (aInside !== bInside) {
      return aInside ? -1 : 1;
    }
    if (aInside) {
      return (
        area(a.shape) - area(b.shape) ||
        a.centerDistance - b.centerDistance ||
        readingOrder(a.shape, b.shape)
      );
    }
    return (
      a.edgeDistance - b.edgeDistance ||
      a.centerDistance - b.centerDistance ||
      area(a.shape) - area(b.shape) ||
      readingOrder(a.shape, b.shape)
    );
  });

  return candidates[0]?.shape;
}

function textValue(element: DigestElement): string {
  return element.text?.trim() ?? "";
}

function resolveLabels(
  shapes: readonly DigestElement[],
  texts: readonly DigestElement[],
): LabelResolution {
  const shapeById = new Map(shapes.map((shape) => [shape.id, shape]));
  const textById = new Map(texts.map((text) => [text.id, text]));
  const labelsByShapeId = new Map<string, string>();
  const consumedTextIds = new Set<string>();
  const textOwnerById = new Map<string, DigestElement>();
  const textsByShape = new Map<string, DigestElement[]>();

  const assign = (text: DigestElement, shape: DigestElement): void => {
    if (consumedTextIds.has(text.id) || textValue(text).length === 0) {
      return;
    }
    consumedTextIds.add(text.id);
    textOwnerById.set(text.id, shape);
    const assigned = textsByShape.get(shape.id) ?? [];
    assigned.push(text);
    textsByShape.set(shape.id, assigned);
  };

  // Pass 1: native Excalidraw bindings always win.
  for (const text of texts) {
    if (text.containerId) {
      const shape = shapeById.get(text.containerId);
      if (shape) {
        assign(text, shape);
      }
    }
  }
  for (const shape of shapes) {
    for (const binding of shape.boundElements ?? []) {
      const text = textById.get(binding.id);
      if (text?.type === "text") {
        assign(text, shape);
      }
    }
  }

  // Pass 2: assign standalone labels only to shapes lacking a bound label.
  const unlabeledShapes = shapes.filter(
    (shape) => (textsByShape.get(shape.id)?.length ?? 0) === 0,
  );
  for (const text of texts.filter((item) => !consumedTextIds.has(item.id))) {
    const shape = pickSpatialShape(center(text), unlabeledShapes);
    if (shape) {
      assign(text, shape);
    }
  }

  for (const shape of shapes) {
    const assigned = textsByShape.get(shape.id);
    if (!assigned?.length) {
      continue;
    }
    const label = [...assigned]
      .sort(readingOrder)
      .map(textValue)
      .filter(Boolean)
      .join(" ");
    if (label) {
      labelsByShapeId.set(shape.id, label);
    }
  }

  return { labelsByShapeId, consumedTextIds, textOwnerById };
}

function endpoint(arrow: DigestElement, atStart: boolean): Point {
  const points = arrow.points ?? [];
  const point = atStart ? points[0] : points[points.length - 1];
  return {
    x: numberOrZero(arrow.x) + (point?.[0] ?? 0),
    y: numberOrZero(arrow.y) + (point?.[1] ?? 0),
  };
}

function endpointShape(
  arrow: DigestElement,
  atStart: boolean,
  byId: Map<string, DigestElement>,
  shapes: readonly DigestElement[],
  textOwnerById: Map<string, DigestElement>,
): DigestElement | undefined {
  const binding = atStart ? arrow.startBinding : arrow.endBinding;
  if (binding) {
    const bound = byId.get(binding.elementId);
    if (bound && SHAPE_TYPES.has(bound.type)) {
      return bound;
    }
    if (bound?.type === "text") {
      const owner = textOwnerById.get(bound.id);
      if (owner) {
        return owner;
      }
    }
  }
  return pickSpatialShape(endpoint(arrow, atStart), shapes);
}

export function digestElements(
  elements: readonly DryRunExcalidrawElement[],
): string {
  const active = nonDeletedElements(elements) as DigestElement[];
  const byId = new Map(active.map((element) => [element.id, element]));
  const shapes = active
    .filter((element) => SHAPE_TYPES.has(element.type))
    .sort(readingOrder);
  const texts = active.filter((element) => element.type === "text");
  const arrows = active
    .filter((element) => element.type === "arrow")
    .sort(readingOrder);
  const { labelsByShapeId, consumedTextIds, textOwnerById } = resolveLabels(
    shapes,
    texts,
  );
  const lines: string[] = [];
  let unlabeledDecorative = 0;

  for (const shape of shapes) {
    const label = labelsByShapeId.get(shape.id);
    if (label) {
      lines.push(`${shape.type} "${label}"`);
    } else {
      unlabeledDecorative += 1;
    }
  }

  for (const text of texts
    .filter((element) => !consumedTextIds.has(element.id))
    .sort(readingOrder)) {
    const value = textValue(text);
    if (value) {
      lines.push(`text "${value}"`);
    } else {
      unlabeledDecorative += 1;
    }
  }

  for (const arrow of arrows) {
    const start = endpointShape(arrow, true, byId, shapes, textOwnerById);
    const end = endpointShape(arrow, false, byId, shapes, textOwnerById);
    const startLabel = start
      ? labelsByShapeId.get(start.id) ?? start.type
      : "unknown";
    const endLabel = end ? labelsByShapeId.get(end.id) ?? end.type : "unknown";
    lines.push(`"${startLabel}" → "${endLabel}"`);
  }

  const handledIds = new Set([
    ...shapes.map((element) => element.id),
    ...texts.map((element) => element.id),
    ...arrows.map((element) => element.id),
  ]);
  unlabeledDecorative += active.filter(
    (element) => !handledIds.has(element.id),
  ).length;

  if (unlabeledDecorative > 0) {
    lines.push(`(${unlabeledDecorative} unlabeled/decorative element(s))`);
  }

  return lines.join("\n");
}

export function digestFromElementsJson(json: string): string {
  return digestElements(parseElementsJson(json));
}
