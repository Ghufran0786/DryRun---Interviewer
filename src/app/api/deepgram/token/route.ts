import { requireUser } from "@/lib/auth/requireUser";
import { enforceRateLimit } from "@/lib/rateLimit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GRANT_URL = "https://api.deepgram.com/v1/auth/grant";
const TOKEN_TTL_SECONDS = 30;

type GrantResponse = {
  access_token?: unknown;
  expires_in?: unknown;
};

type GrantAttempt = {
  status: number;
  body: string;
  parsed: GrantResponse | null;
};

async function requestGrant(
  apiKey: string,
  body: object,
): Promise<GrantAttempt> {
  const response = await fetch(GRANT_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  console.log("Deepgram grant status:", {
    status: response.status,
    requestedTtlSeconds: TOKEN_TTL_SECONDS,
  });
  let parsed: GrantResponse | null = null;
  try {
    parsed = text.length > 0 ? (JSON.parse(text) as GrantResponse) : null;
  } catch {
    parsed = null;
  }
  return { status: response.status, body: text, parsed };
}

export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const limited = await enforceRateLimit(
    `deepgram-token:${auth.userId}`,
    60,
    60 * 1000,
  );
  if (limited) {
    return limited;
  }

  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "DEEPGRAM_API_KEY is not configured. Add a Member-scope-or-higher key to .env and restart the server.",
      },
      { status: 500 },
    );
  }

  let attempt: GrantAttempt;
  try {
    attempt = await requestGrant(apiKey, { ttl_seconds: TOKEN_TTL_SECONDS });
    if (attempt.status >= 400 && attempt.status < 500) {
      attempt = await requestGrant(apiKey, {});
    }
  } catch {
    return NextResponse.json(
      { error: "Deepgram grant service is unreachable." },
      { status: 502 },
    );
  }

  if (attempt.status < 200 || attempt.status >= 300) {
    console.error("Deepgram grant failed", {
      status: attempt.status,
      body: attempt.body.slice(0, 500),
    });
    const hint =
      attempt.status === 401 || attempt.status === 403
        ? "The key was rejected — it must have Member scope or higher."
        : "Check that DEEPGRAM_API_KEY is a valid Member-scope-or-higher key.";
    return NextResponse.json(
      { error: `Deepgram token grant failed (${attempt.status}). ${hint}` },
      { status: 502 },
    );
  }

  const grant = attempt.parsed;
  if (
    !grant ||
    typeof grant.access_token !== "string" ||
    grant.access_token.length === 0
  ) {
    return NextResponse.json(
      { error: "Deepgram grant response did not contain access_token." },
      { status: 502 },
    );
  }

  const expiresInSec =
    typeof grant.expires_in === "number" ? grant.expires_in : TOKEN_TTL_SECONDS;

  return NextResponse.json({
    token: grant.access_token,
    expiresInSec,
  });
}
