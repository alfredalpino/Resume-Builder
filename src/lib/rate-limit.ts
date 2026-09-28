type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

const DEFAULT_CAPACITY = 30;
const REFILL_PER_MS = 30 / (60 * 1000); // 30 requests per minute

export function rateLimit(
  key: string,
  capacity = DEFAULT_CAPACITY,
): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const existing = buckets.get(key) ?? { tokens: capacity, updatedAt: now };
  const elapsed = now - existing.updatedAt;
  const tokens = Math.min(capacity, existing.tokens + elapsed * REFILL_PER_MS);

  if (tokens < 1) {
    buckets.set(key, { tokens, updatedAt: now });
    const retryAfterMs = Math.ceil((1 - tokens) / REFILL_PER_MS);
    return { ok: false, retryAfterMs };
  }

  buckets.set(key, { tokens: tokens - 1, updatedAt: now });
  return { ok: true };
}
