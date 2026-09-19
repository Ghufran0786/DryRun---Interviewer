/** Direct turn API checks (help + biscuit) without stall watchdog interference. */
const BASE = "http://localhost:3000";

async function api(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

async function createSession() {
  const { json } = await api("POST", "/api/sessions", {
    title: "Tuning3 API Help",
    problem: "Design URL Shortener",
  });
  return json.id;
}

async function opening(sessionId) {
  await api("POST", `/api/interviewer/turn`, {
    sessionId,
    trigger: "opening",
    tsMs: 1000,
    sceneDigest: "",
    boardChanged: false,
  });
}

async function candidate(sessionId, text, tsMs) {
  await api("POST", `/api/sessions/${sessionId}/transcript`, {
    role: "candidate",
    text,
    tsMs,
    suppressed: false,
  });
}

async function utterance(sessionId, text, tsMs) {
  return api("POST", `/api/interviewer/turn`, {
    sessionId,
    trigger: "utterance",
    utteranceText: text,
    tsMs,
    sceneDigest: "",
    boardChanged: false,
  });
}

const helpPhrase =
  "I'm not sure, can you please help me with the answer?";
const sessionId = await createSession();
await opening(sessionId);
await new Promise((r) => setTimeout(r, 12_000));
const helpReplies = [];
for (let i = 0; i < 3; i++) {
  const tsMs = 20_000 + i * 25_000;
  await candidate(sessionId, helpPhrase, tsMs - 500);
  const { status, json } = await utterance(sessionId, helpPhrase, tsMs);
  helpReplies.push({
    status,
    text: status === 201 ? json.entry.text : json,
  });
}

const session2 = await createSession();
await opening(session2);
await new Promise((r) => setTimeout(r, 12_000));
await candidate(session2, "I would use Biscuit for the analytics part", 19_000);
const b1 = await utterance(session2, "I would use Biscuit for the analytics part", 20_000);
await candidate(session2, "Let's talk about the cache instead", 44_000);
const b2 = await utterance(session2, "Let's talk about the cache instead", 45_000);

console.log(JSON.stringify({ helpReplies, biscuitReply: b1.json?.entry?.text, cacheReply: b2.json?.entry?.text }, null, 2));
