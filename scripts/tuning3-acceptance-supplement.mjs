import { chromium } from "playwright";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const DB = path.join(process.cwd(), "data", "dryrun.db");
const OUT = path.join(process.cwd(), "data", "tuning3-acceptance-evidence.json");
const evidence = JSON.parse(fs.readFileSync(OUT, "utf8"));

async function api(method, urlPath, body) {
  const res = await fetch(`${BASE}${urlPath}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { json: await res.json() };
}

function backdate(id, sec) {
  execSync(
    `sqlite3 "${DB}" "UPDATE Session SET startedAt = ${Date.now() - sec * 1000} WHERE id='${id}';"`,
  );
}

async function newSession(title) {
  return (await api("POST", "/api/sessions", { title, problem: "Design URL Shortener" })).json.id;
}

async function begin(page, id) {
  await page.goto(`${BASE}/interview/${id}`, { waitUntil: "networkidle" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("tab", { name: "Interviewer" }).click();
  await page.getByRole("button", { name: "Begin interview" }).click();
  await page.getByText("thinking…").waitFor({ state: "detached", timeout: 120000 });
  await page.waitForTimeout(25000);
}

async function inject(page, text) {
  await page.getByLabel("Simulate utterance").fill(text);
  await page.getByRole("button", { name: "Inject" }).click();
  await page.getByText("thinking…").waitFor({ state: "detached", timeout: 120000 });
  await page.waitForTimeout(1500);
}

async function rows(id) {
  const t = (await api("GET", `/api/sessions/${id}/transcript`)).json;
  return t.filter((e) => e.role === "interviewer");
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await api("PUT", "/api/settings", { interviewDurationMin: 20, ttsEnabled: false });

const drawId = await newSession("Tuning3 Drawing2");
await begin(page, drawId);
const canvas = page.locator("canvas.excalidraw__canvas").first();
const box = await canvas.boundingBox();
await page.mouse.move(box.x + 100, box.y + 100);
await page.mouse.down();
await page.mouse.move(box.x + 300, box.y + 220, { steps: 12 });
await page.mouse.up();
await page.getByRole("button", { name: "Capture" }).click();
await page.waitForTimeout(3000);
await page.getByRole("tab", { name: "Interviewer" }).click();
await page.waitForTimeout(12000);
evidence.sections.stallDrawing = {
  drawingNudge: (await rows(drawId)).find((r) => r.trigger === "stall_drawing"),
};

const helpId = await newSession("Tuning3 Help2");
await begin(page, helpId);
const helpPhrase = "I'm not sure, can you please help me with the answer";
const helpReplies = [];
for (let i = 0; i < 3; i++) {
  await inject(page, helpPhrase);
  const all = await rows(helpId);
  helpReplies.push(all[all.length - 1]);
  if (i < 2) await page.waitForTimeout(26000);
}
evidence.sections.help = { helpReplies };

const biscuitId = await newSession("Tuning3 Biscuit2");
await begin(page, biscuitId);
await inject(page, "I would use Biscuit for the analytics part");
const allB = await rows(biscuitId);
const biscuitReply = allB[allB.length - 1];
await page.waitForTimeout(26000);
await inject(page, "Let's talk about the cache instead");
const allB2 = await rows(biscuitId);
evidence.sections.biscuit = { biscuitReply, cacheReply: allB2[allB2.length - 1] };

await api("PUT", "/api/settings", { interviewDurationMin: 6, ttsEnabled: false });
const wrapId = await newSession("Tuning3 Wrapup2");
await begin(page, wrapId);
backdate(wrapId, 362);
await page.reload({ waitUntil: "networkidle" });
await page.getByRole("tab", { name: "Interviewer" }).click();
await page.waitForTimeout(45000);
const wrapRows = await rows(wrapId);
const status = (await api("GET", `/api/sessions/${wrapId}`)).json.status;
const advances = (await api("GET", `/api/sessions/${wrapId}/transcript`)).json.filter(
  (e) => e.kind === "phase_advance",
);
evidence.sections.wrapup = {
  interviewerTurns: wrapRows,
  sessionStatus: status,
  advances,
};

const liveId = await newSession("Tuning3 PhaseLive2");
await begin(page, liveId);
const t0 = Date.now();
await inject(
  page,
  "That completes requirements estimation API high level design and deep dive for me.",
);
await page.getByText(/Phase advanced from/i).waitFor({ timeout: 10000 }).catch(() => null);
evidence.sections.phaseAdvanceLive = {
  latencyMs: Date.now() - t0,
  systemRows: (await api("GET", `/api/sessions/${liveId}/transcript`)).json.filter(
    (e) => e.kind === "phase_advance",
  ),
};

await api("PUT", "/api/settings", { interviewDurationMin: 45, ttsEnabled: true });
evidence.settingsRestored = (await api("GET", "/api/settings")).json;
fs.writeFileSync(OUT, JSON.stringify(evidence, null, 2));
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
