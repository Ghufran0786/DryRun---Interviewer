import assert from "node:assert/strict";
import test from "node:test";
import type { DryRunExcalidrawElement } from "./excalidrawElement";
import { digestElements } from "./sceneDigest";

type FixtureElement = DryRunExcalidrawElement & {
  x: number;
  y: number;
  width: number;
  height: number;
  points?: readonly (readonly [number, number])[];
  boundElements?: readonly { id: string; type?: string }[] | null;
};

let fixtureId = 0;

function element(
  type: string,
  overrides: Partial<FixtureElement> = {},
): FixtureElement {
  fixtureId += 1;
  return {
    id: `element-${fixtureId}`,
    type,
    version: 1,
    x: 0,
    y: 0,
    width: 100,
    height: 60,
    ...overrides,
  };
}

function rectangle(
  id: string,
  x: number,
  y: number,
  width = 100,
  height = 60,
  overrides: Partial<FixtureElement> = {},
): FixtureElement {
  return element("rectangle", { id, x, y, width, height, ...overrides });
}

function text(
  id: string,
  value: string,
  x: number,
  y: number,
  overrides: Partial<FixtureElement> = {},
): FixtureElement {
  return element("text", {
    id,
    text: value,
    x,
    y,
    width: Math.max(value.length * 8, 10),
    height: 20,
    ...overrides,
  });
}

test("resolves native bound text labels", () => {
  const rect = rectangle("rect", 0, 0, 120, 60, {
    boundElements: [{ id: "label", type: "text" }],
  });
  const label = text("label", "API Gateway", 15, 20, {
    containerId: "rect",
  });

  assert.equal(digestElements([rect, label]), 'rectangle "API Gateway"');
});

test("assigns centered standalone text to its rectangle", () => {
  const rect = rectangle("rect", 0, 0);
  const label = text("label", "Client", 25, 20);

  assert.equal(digestElements([rect, label]), 'rectangle "Client"');
});

test("assigns text whose center is 20px above a rectangle", () => {
  const rect = rectangle("rect", 0, 0);
  const label = text("label", "Nearby", 20, -30, {
    width: 50,
    height: 20,
  });

  assert.equal(digestElements([rect, label]), 'rectangle "Nearby"');
});

test("assigns overlapping text to the innermost rectangle", () => {
  const outer = rectangle("outer", 0, 0, 200, 200);
  const inner = rectangle("inner", 50, 50, 80, 80);
  const label = text("label", "Inner", 65, 75, {
    width: 40,
    height: 20,
  });

  assert.equal(
    digestElements([outer, inner, label]),
    'rectangle "Inner"\n(1 unlabeled/decorative element(s))',
  );
});

test("resolves bound arrow endpoints through spatial shape labels", () => {
  const client = rectangle("client", 0, 0);
  const gateway = rectangle("gateway", 200, 0);
  const clientText = text("client-text", "Client", 20, 20);
  const gatewayText = text("gateway-text", "API Gateway", 205, 20);
  const arrow = element("arrow", {
    id: "arrow",
    x: 100,
    y: 30,
    width: 100,
    height: 0,
    points: [
      [0, 0],
      [100, 0],
    ],
    startBinding: { elementId: "client" },
    endBinding: { elementId: "gateway" },
  });

  assert.equal(
    digestElements([client, gateway, clientText, gatewayText, arrow]),
    'rectangle "Client"\nrectangle "API Gateway"\n"Client" → "API Gateway"',
  );
});

test("resolves unbound arrow endpoints spatially", () => {
  const client = rectangle("client", 0, 0);
  const gateway = rectangle("gateway", 200, 0);
  const clientText = text("client-text", "Client", 20, 20);
  const gatewayText = text("gateway-text", "API Gateway", 205, 20);
  const arrow = element("arrow", {
    id: "arrow",
    x: 80,
    y: 30,
    width: 140,
    height: 0,
    points: [
      [0, 0],
      [140, 0],
    ],
  });

  assert.equal(
    digestElements([client, gateway, clientText, gatewayText, arrow]),
    'rectangle "Client"\nrectangle "API Gateway"\n"Client" → "API Gateway"',
  );
});

test("leaves distant free text standalone", () => {
  const rect = rectangle("rect", 0, 0);
  const label = text("free-text", "100M DAU", 300, 200);

  assert.equal(
    digestElements([rect, label]),
    'text "100M DAU"\n(1 unlabeled/decorative element(s))',
  );
});

test("resolves the exact A4 mixed-label scene", () => {
  const client = rectangle("client", 0, 0);
  const gateway = rectangle("gateway", 200, 0, 130, 60);
  const database = rectangle("database", 400, 0, 100, 60, {
    boundElements: [{ id: "database-text", type: "text" }],
  });
  const clientText = text("client-text", "Client", 20, 20);
  const gatewayText = text("gateway-text", "API Gateway", 205, 20);
  const databaseText = text("database-text", "DB", 435, 20, {
    containerId: "database",
  });
  const arrow = element("arrow", {
    id: "arrow",
    x: 100,
    y: 30,
    width: 100,
    height: 0,
    points: [
      [0, 0],
      [100, 0],
    ],
    startBinding: { elementId: "client" },
    endBinding: { elementId: "gateway" },
  });

  assert.equal(
    digestElements([
      client,
      gateway,
      database,
      databaseText,
      clientText,
      arrow,
      gatewayText,
    ]),
    [
      'rectangle "Client"',
      'rectangle "API Gateway"',
      'rectangle "DB"',
      '"Client" → "API Gateway"',
    ].join("\n"),
  );
});
