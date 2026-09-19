/**
 * Tuning 3 acceptance (injection path). Requires npm run dev + OPENROUTER_API_KEY.
 */
import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.DRYRUN_BASE ?? "http://localhost:3000";
const DB_PATH = path.join(process.cwd(), "data", "dryrun.db");
const OUT = path.join(process.cwd(), "data", "tuning3-acceptance-evidence.json");

const evidence = { at: new Date().toISOString(), sections: {} };

function save() {
  fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
}

async function api(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: res.status, json };
}

function mmss(tsMs) {
  const s = Math.floor(tsMs / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

async function transcript(sessionId) {
  const { json } = await api("GET", `/api/sessions/${sessionId}/transcript`);
  return json ?? [];
}

async function interviewerRows(sessionId) {
  return (await transcript(sessionId))
    .filter((e) => e.role === "interviewer")
    .map((e) => ({
      tsMs: e.tsMs,
      mmss: mmss(e.tsMs),
      kind: e.kind,
      trigger: e.trigger,
      text: e.text,
    }));
}

function backdateSession(sessionId, secondsAgo) {
  const startedMs = Date.now() - secondsAgo * 1000;
  execSync(
    `sqlite3 "${DB_PATH}" "UPDATE Session SET startedAt = ${startedMs} WHERE id = '${sessionId}';"`,
    { stdio: "pipe" },
  );
}

async function newSession(title) {
  const created = await api("POST", "/api/sessions", {
    title,
    problem: "Design URL Shortener",
    targetLevel: "SDE-2",
  });
  return created.json.id;
}

async function beginInterview(page, sessionId) {
  await page.goto(`${BASE}/interview/${sessionId}`, { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Interviewer" }).click();
  const begin = page.getByRole("button", { name: "Begin interview" });
  if (await begin.isVisible().catch(() => false)) {
    await begin.click();
    await page.getByText("thinking…").waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
    await page.getByText("thinking…").waitFor({ state: "detached", timeout: 120_000 });
    await page.waitForTimeout(1000);
  }
}

async function simulate(page, text) {
  await page.getByRole("tab", { name: "Interviewer" }).click();
  await page.getByLabel("Simulate utterance").fill(text);
  await page.getByRole("button", { name: "Inject" }).click();
  await page.getByText("thinking…").waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  await page.getByText("thinking…").waitFor({ state: "detached", timeout: 120_000 });
  await page.waitForTimeout(1500);
}

async function drawOnBoard(page) {
  const canvas = page.locator("canvas.excalidraw__canvas").first();
  await canvas.waitFor({ state: "visible", timeout: 15_000 });
  const box = await canvas.boundingBox();
  if (!box) throw new Error("canvas bbox missing");
  await page.mouse.move(box.x + 80, box.y + 80);
  await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 160, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  await page.mouse.move(box.x + 260, box.y + 90);
  await page.mouse.down();
  await page.mouse.move(box.x + 380, box.y + 200, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(6000);
}

function attachConsole(page, bucket) {
  page.on("console", (msg) => {
    const t = msg.text();
    if (
      t.includes("stall:capped") ||
      t.includes("stall:maxgap") ||
      t.includes("wrapup to wrapup")
    ) {
      bucket.push(t);
    }
  });
}

async function run() {
  await api("PUT", "/api/settings", {
    interviewDurationMin: 20,
    ttsEnabled: false,
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1440, height: 900 });
  const consoleLogs = [];
  attachConsole(page, consoleLogs);

  const session1 = await newSession("Tuning3 StallCap");
  await beginInterview(page, session1);
  await page.waitForTimeout(78_000);
  const rowsBeforeAdvance = await interviewerRows(session1);
  const stallBefore = rowsBeforeAdvance.filter((r) =>
    ["stall", "stall_drawing"].includes(r.trigger ?? ""),
  );
  await page.getByRole("button", { name: "Estimation" }).click();
  await page.waitForTimeout(10_000);
  const rowsAfter = await interviewerRows(session1);
  evidence.sections.stallCap = {
    consoleCapped: consoleLogs.filter((l) => l.includes("stall:capped")),
    stallRowsBeforeAdvance: stallBefore,
    allInterviewerAfter: rowsAfter,
    postAdvanceStall: rowsAfter.filter(
      (r) =>
        ["stall", "stall_drawing"].includes(r.trigger ?? "") &&
        r.tsMs > (stallBefore[stallBefore.length - 1]?.tsMs ?? 0),
    ),
  };
  save();

  const session2 = await newSession("Tuning3 MaxGap");
  await beginInterview(page, session2);
  await page.waitForTimeout(78_000);
  consoleLogs.length = 0;
  await page.waitForTimeout(125_000);
  evidence.sections.maxgap = {
    consoleMaxgap: consoleLogs.filter((l) => l.includes("stall:maxgap")),
    maxgapRows: (await interviewerRows(session2)).filter(
      (r) => r.trigger === "stall_maxgap",
    ),
  };
  save();

  const session3 = await newSession("Tuning3 Drawing");
  await beginInterview(page, session3);
  await drawOnBoard(page);
  await page.getByRole("tab", { name: "Interviewer" }).click();
  await page.waitForTimeout(28_000);
  evidence.sections.stallDrawing = {
    drawingNudge: (await interviewerRows(session3)).find(
      (r) => r.trigger === "stall_drawing",
    ),
  };
  save();

  const session4 = await newSession("Tuning3 Help");
  await beginInterview(page, session4);
  const helpPhrase =
    "I'm not sure, can you please help me with the answer";
  const helpReplies = [];
  for (let i = 0; i < 3; i += 1) {
    await simulate(page, helpPhrase);
    const rows = await interviewerRows(session4);
    helpReplies.push(rows[rows.length - 1]);
    if (i < 2) await page.waitForTimeout(26_000);
  }
  evidence.sections.help = { helpReplies };
  save();

  const session5 = await newSession("Tuning3 Biscuit");
  await beginInterview(page, session5);
  await simulate(page, "I would use Biscuit for the analytics part");
  let r5 = await interviewerRows(session5);
  const biscuitReply = r5[r5.length - 1];
  await page.waitForTimeout(26_000);
  await simulate(page, "Let's talk about the cache instead");
  r5 = await interviewerRows(session5);
  evidence.sections.biscuit = {
    biscuitReply,
    cacheReply: r5[r5.length - 1],
  };
  save();

  await api("PUT", "/api/settings", { interviewDurationMin: 6, ttsEnabled: false });
  const session6 = await newSession("Tuning3 Wrapup");
  await beginInterview(page, session6);
  backdateSession(session6, 330);
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "Interviewer" }).click();
  consoleLogs.length = 0;
  await page.waitForTimeout(90_000);
  const rows6 = await interviewerRows(session6);
  evidence.sections.wrapup = {
    interviewerTurns: rows6,
    sessionStatus: (await api("GET", `/api/sessions/${session6}`)).json?.status,
    advances: (await transcript(session6)).filter((e) => e.kind === "phase_advance"),
    consoleLogs: [...consoleLogs],
  };
  save();

  const session7 = await newSession("Tuning3 PhaseLive");
  await beginInterview(page, session7);
  const t0 = Date.now();
  await simulate(
    page,
    "We finished requirements estimation API high level design and deep dive and I am ready to wrap up now.",
  );
  await page
    .getByText(/Phase advanced from/i)
    .waitFor({ state: "visible", timeout: 8000 })
    .catch(() => null);
  evidence.sections.phaseAdvanceLive = {
    latencyMs: Date.now() - t0,
    systemRows: (await transcript(session7)).filter((e) => e.kind === "phase_advance"),
  };

  await api("PUT", "/api/settings", {
    interviewDurationMin: 45,
    ttsEnabled: true,
  });
  evidence.settingsRestored = (await api("GET", "/api/settings")).json;
  save();

  console.log(JSON.stringify(evidence, null, 2));
  await browser.close();
}

run().catch((error) => {
  console.error(error);
  save();
  process.exit(1);
});
