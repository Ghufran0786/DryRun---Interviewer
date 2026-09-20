const base = process.argv[2]?.trim() || "http://localhost:3000";

const routes = [
  ["GET", "/api/auth/status"],
  ["POST", "/api/auth/logout"],
  ["GET", "/api/sessions"],
  ["POST", "/api/sessions"],
  ["GET", "/api/settings"],
  ["PUT", "/api/settings"],
  ["POST", "/api/settings/test-models"],
  ["POST", "/api/deepgram/token"],
  ["POST", "/api/tts"],
  ["POST", "/api/interviewer/turn"],
  ["GET", "/api/sessions/test-id"],
  ["PATCH", "/api/sessions/test-id"],
  ["DELETE", "/api/sessions/test-id"],
  ["GET", "/api/sessions/test-id/transcript"],
  ["POST", "/api/sessions/test-id/transcript"],
  ["PUT", "/api/sessions/test-id/scene"],
  ["GET", "/api/sessions/test-id/snapshots"],
  ["POST", "/api/sessions/test-id/snapshots"],
  ["POST", "/api/sessions/test-id/evaluate"],
  ["GET", "/api/sessions/test-id/export"],
  ["GET", "/api/sessions/test-id/report.pdf"],
  ["GET", "/api/snapshots/test-snapshot-id/png"],
];

for (const [method, path] of routes) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers:
      method === "POST" || method === "PUT" || method === "PATCH"
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      method === "POST" || method === "PUT" || method === "PATCH"
        ? "{}"
        : undefined,
  });
  const line = await res.text();
  const preview = line.slice(0, 80).replace(/\s+/g, " ");
  console.log(`${method} ${path} -> ${res.status} ${preview}`);
}
