export type DeepgramTransport = "direct" | "proxy";

export function getDeepgramTransport(): DeepgramTransport {
  const raw = process.env.DEEPGRAM_TRANSPORT;
  if (raw === undefined || raw === "" || raw === "direct") {
    return "direct";
  }
  if (raw === "proxy") {
    return "proxy";
  }
  throw new Error(
    `Invalid DEEPGRAM_TRANSPORT "${raw}" (expected "direct" or "proxy")`,
  );
}
