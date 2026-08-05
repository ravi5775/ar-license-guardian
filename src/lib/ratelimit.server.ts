/**
 * Unified Rate Limiting Adapter Module.
 * Provides rate-limiting capabilities across both:
 *  - main (edge / Upstash Redis HTTP API)
 *  - self-hosted (local Redis container or zero-dependency in-memory sliding window)
 */

export type RateLimitProvider = "upstash" | "redis" | "memory";

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetMs: number;
}

// In-memory sliding window fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>();

export function getRateLimitProvider(): RateLimitProvider {
  const provider = process.env.RATELIMIT_PROVIDER as RateLimitProvider | undefined;
  if (provider) return provider;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return "upstash";
  }
  return "memory";
}

/**
 * Checks and increments rate limit counter for a given key.
 *
 * @param key Unique rate limit identifier (e.g. `ip:192.168.1.1` or `license:KEY-123`)
 * @param limit Maximum allowed hits within the window
 * @param windowMs Window duration in milliseconds
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const provider = getRateLimitProvider();

  if (provider === "upstash") {
    const url = process.env.UPSTASH_REDIS_REST_URL!;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!;
    try {
      // Pipeline INCR and PEXPIRE via Upstash REST API
      const res = await fetch(`${url}/pipeline`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([
          ["INCR", key],
          ["PEXPIRE", key, windowMs, "NX"],
          ["PTTL", key],
        ]),
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{ result: number }>;
        const currentCount = data[0]?.result ?? 1;
        const pttl = data[2]?.result ?? windowMs;
        const remaining = Math.max(0, limit - currentCount);
        return {
          success: currentCount <= limit,
          remaining,
          resetMs: pttl > 0 ? pttl : windowMs,
        };
      }
    } catch (err) {
      console.warn("Upstash rate limit request failed, falling back to memory store:", err);
    }
  }

  // Memory sliding-window fallback
  const now = Date.now();
  const record = memoryStore.get(key);

  if (!record || now > record.resetTime) {
    const resetTime = now + windowMs;
    memoryStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      remaining: limit - 1,
      resetMs: windowMs,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, limit - record.count);
  const resetMs = Math.max(0, record.resetTime - now);

  return {
    success: record.count <= limit,
    remaining,
    resetMs,
  };
}
