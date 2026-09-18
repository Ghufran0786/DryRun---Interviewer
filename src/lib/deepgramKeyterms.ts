export const DEFAULT_DEEPGRAM_KEYTERMS = [
  "Ghufran Ahmad Khan",
  "Ghufran",
  "Ahmad",
  "Khan",
  "LeetCode",
  "Cassandra",
  "DynamoDB",
  "PostgreSQL",
  "Redis",
  "Kafka",
  "Kubernetes",
  "gRPC",
  "CDN",
  "QPS",
  "DAU",
  "sharding",
  "consistent hashing",
  "idempotent",
  "rate limiting",
  "load balancer",
  "websocket",
  "CRDT",
  "operational transformation",
  "leaderboard",
  "write-ahead log",
  "message queue",
  "microservices",
] as const;

export const MAX_DEEPGRAM_KEYTERMS = 40;

export function seededKeyterms(candidateName: string): string {
  return [candidateName.trim(), ...DEFAULT_DEEPGRAM_KEYTERMS]
    .filter(Boolean)
    .join("\n");
}

export function parseKeyterms(value: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const line of value.split(/\r?\n/)) {
    const term = line.trim();
    const key = term.toLocaleLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === MAX_DEEPGRAM_KEYTERMS) break;
  }
  return terms;
}
