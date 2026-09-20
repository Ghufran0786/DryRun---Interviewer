/**
 * Playwright AFTER metrics for five dashboard flows (hosted prod server).
 * Requires DRYRUN_E2E_EMAIL + DRYRUN_E2E_PASSWORD in .env for authenticated clicks.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const base = process.argv[2]?.trim() || "http://localhost:3000";

function loadEnv(name) {
  const text = readFileSync(path.join(root, ".env"), "utf8");
  const line = text.split(/\r?\n/).find((row) => row.startsWith(`${name}=`));
  if (!line) return "";
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
}

const email = loadEnv("DRYRUN_E2E_EMAIL");
const password = loadEnv("DRYRUN_E2E_PASSWORD");

async function measureClick(page, label, clickFn, waitFn) {
  const requests = [];
  const onReq = (req) => {
    requests.push({ url: req.url(), start: Date.now() });
  };
  const onDone = (req) => {
    const row = requests.find((r) => r.url === req.url() && r.end === undefined);
    if (row) row.end = Date.now();
  };
  page.on("request", onReq);
  page.on("requestfinished", onDone);
  page.on("requestfailed", onDone);

  const t0 = Date.now();
  await clickFn();
  await waitFn();
  const visibleMs = Date.now() - t0;

  const durations = requests
    .filter((r) => r.end)
    .map((r) => ({ url: r.url, ms: r.end - r.start }));
  const slowest = durations.sort((a, b) => b.ms - a.ms)[0];

  page.removeListener("request", onReq);
  page.removeListener("requestfinished", onDone);
  page.removeListener("requestfailed", onDone);

  return {
    label,
    visibleMs,
    requestCount: requests.length,
    slowestUrl: slowest?.url ?? "(none)",
    slowestMs: slowest?.ms ?? 0,
  };
}

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

if (email && password) {
  await page.goto(`${base}/login`);
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/login"), {
    timeout: 15000,
  });
}

const results = [];

results.push(
  await measureClick(
    page,
    "dashboard -> New interview",
    async () => {
      await page.goto(`${base}/`);
      await page.getByRole("button", { name: /new interview/i }).click();
    },
    async () => {
      await page.getByLabel(/title/i).waitFor({ state: "visible", timeout: 10000 });
    },
  ),
);

let sessionId = "";
const sessionLink = page.locator('a[href^="/interview/"]').first();
if (await sessionLink.count()) {
  const href = await sessionLink.getAttribute("href");
  sessionId = href?.split("/").pop() ?? "";
}

if (sessionId) {
  results.push(
    await measureClick(
      page,
      "open session",
      async () => {
        await page.goto(`${base}/`);
        await page.locator(`a[href="/interview/${sessionId}"]`).first().click();
      },
      async () => {
        await page.waitForURL(`**/interview/${sessionId}`, { timeout: 10000 });
      },
    ),
  );

  results.push(
    await measureClick(
      page,
      "Begin interview",
      async () => {
        await page.getByRole("button", { name: /begin interview/i }).click();
      },
      async () => {
        await page
          .getByText(/listening|standby|interviewer/i)
          .first()
          .waitFor({ state: "visible", timeout: 15000 })
          .catch(() => undefined);
      },
    ),
  );
}

results.push(
  await measureClick(
    page,
    "Settings save",
    async () => {
      await page.goto(`${base}/settings`);
      await page.getByRole("button", { name: /save settings/i }).click();
    },
    async () => {
      await page.getByText(/settings saved/i).waitFor({ timeout: 10000 }).catch(() => undefined);
    },
  ),
);

if (sessionId) {
  await page.goto(`${base}/interview/${sessionId}`);
  results.push(
    await measureClick(
      page,
      "Capture snapshot",
      async () => {
        const btn = page.getByRole("button", { name: /capture/i });
        if (await btn.count()) await btn.first().click();
      },
      async () => {
        await page.waitForTimeout(500);
      },
    ),
  );
}

console.log(JSON.stringify({ base, authenticated: Boolean(email && password), results }, null, 2));
await browser.close();
