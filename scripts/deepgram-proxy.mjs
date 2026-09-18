import { readFile } from "node:fs/promises";
import path from "node:path";
import { WebSocket, WebSocketServer } from "ws";

const HOST = "localhost";
const PORT = 3001;
const GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
const UPSTREAM_URL = "wss://api.deepgram.com/v1/listen";
const ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

async function readApiKey() {
  if (process.env.DEEPGRAM_API_KEY) {
    return process.env.DEEPGRAM_API_KEY;
  }
  const envText = await readFile(path.join(process.cwd(), ".env"), "utf8");
  const line = envText
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith("DEEPGRAM_API_KEY="));
  const value = line?.slice("DEEPGRAM_API_KEY=".length).trim();
  return value?.replace(/^["']|["']$/g, "") ?? "";
}

async function mintToken(apiKey) {
  const response = await fetch(GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ttl_seconds: 300 }),
  });
  const body = await response.text();
  console.log("Deepgram proxy grant status:", {
    status: response.status,
    requestedTtlSeconds: 300,
  });
  if (!response.ok) {
    throw new Error(`grant HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
  const parsed = JSON.parse(body);
  if (typeof parsed.access_token !== "string" || parsed.access_token.length === 0) {
    throw new Error("grant response missing access_token");
  }
  return parsed.access_token;
}

function upstreamUrl(requestUrl) {
  const local = new URL(requestUrl, `ws://${HOST}:${PORT}`);
  const upstream = new URL(UPSTREAM_URL);
  // Transparent transport: preserve every client query parameter, including
  // unknown future Deepgram options and repeated parameters.
  upstream.search = local.search;
  return upstream.toString();
}

function closeReason(code, reason) {
  const text = reason.toString();
  return `upstream ${code}${text ? `: ${text}` : ""}`.slice(0, 120);
}

const apiKey = await readApiKey();
if (!apiKey) {
  console.error(
    "Deepgram proxy cannot start: DEEPGRAM_API_KEY is missing from .env.",
  );
  process.exit(1);
}

const server = new WebSocketServer({ host: HOST, port: PORT });
const observedMessages = new Set();

server.on("connection", async (browser, request) => {
  const origin = request.headers.origin;
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    browser.close(1008, "origin not allowed");
    return;
  }

  const startedAt = Date.now();
  let upstream = null;
  let browserClosed = false;

  browser.on("close", () => {
    browserClosed = true;
    if (
      upstream &&
      (upstream.readyState === WebSocket.OPEN ||
        upstream.readyState === WebSocket.CONNECTING)
    ) {
      upstream.close(1000, "browser closed");
    }
  });

  try {
    // Fresh grant for every local browser connection, including reconnects.
    const accessToken = await mintToken(apiKey);
    if (browserClosed) {
      return;
    }

    const target = upstreamUrl(request.url ?? "/v1/listen");
    upstream = new WebSocket(target, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    upstream.on("open", () => {
      console.log("Deepgram proxy upstream open:", {
        openMs: Date.now() - startedAt,
        url: target,
      });
      if (browser.readyState === WebSocket.OPEN) {
        browser.send(
          JSON.stringify({
            type: "DryRunProxy.Ready",
            upstreamOpenMs: Date.now() - startedAt,
          }),
        );
      }
    });

    browser.on("message", (data, isBinary) => {
      if (upstream?.readyState === WebSocket.OPEN) {
        upstream.send(data, { binary: isBinary });
      }
    });

    upstream.on("message", (data, isBinary) => {
      if (!isBinary) {
        try {
          const message = JSON.parse(data.toString());
          if (
            typeof message.type === "string" &&
            !observedMessages.has(message.type)
          ) {
            observedMessages.add(message.type);
            console.log("Deepgram proxy observed message:", {
              type: message.type,
            });
          }
          if (
            message.type === "Results" &&
            message.speech_final === true &&
            !observedMessages.has("Results:speech_final")
          ) {
            observedMessages.add("Results:speech_final");
            console.log("Deepgram proxy observed message:", {
              type: "Results",
              speech_final: true,
            });
          }
        } catch {
          // Forward malformed/non-JSON upstream payloads unchanged.
        }
      }
      if (browser.readyState === WebSocket.OPEN) {
        browser.send(data, { binary: isBinary });
      }
    });

    upstream.on("close", (code, reason) => {
      console.log("Deepgram proxy upstream close:", {
        code,
        reason: reason.toString(),
        openLifetimeMs: Date.now() - startedAt,
      });
      if (browser.readyState === WebSocket.OPEN) {
        browser.close(
          code >= 1000 && code <= 4999 && code !== 1005 && code !== 1006
            ? code
            : 1011,
          closeReason(code, reason),
        );
      }
    });

    upstream.on("error", (error) => {
      console.error("Deepgram proxy upstream error:", error.message);
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("Deepgram proxy connection failed:", message);
    if (browser.readyState === WebSocket.OPEN) {
      browser.close(1011, message.slice(0, 120));
    }
  }
});

server.on("listening", () => {
  console.log(`Deepgram proxy ready at ws://${HOST}:${PORT}`);
});

server.on("error", (error) => {
  console.error("Deepgram proxy server error:", error.message);
  process.exitCode = 1;
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
