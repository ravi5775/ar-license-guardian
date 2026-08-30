/**
 * ============================================================================
 * AETHER AR — ENTERPRISE RATE LIMITING & ABUSE PREVENTION MIDDLEWARE
 * ============================================================================
 *
 * Protects every public API route, authentication step, and server function
 * with sliding-window throttles and standard HTTP 429 Retry-After responses.
 *
 * Tiers:
 *  - Anonymous Public (e.g. PIN submit, Media redemption): 30 req/min
 *  - Authenticated Editor: 120 req/min
 *  - Admin Actions: 300 req/min
 *  - Activation & License API: 10 req/min
 * ============================================================================
 */

import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { check } from "@/lib/adapters/ratelimit.server";

export interface RateLimitConfig {
  limit: number;
  windowSec: number;
  bucket?: string;
  failMode?: "open" | "closed";
}

/** Extracts client IP safely across Cloudflare, proxies, and local development. */
export function getClientIp(req?: Request | null): string {
  if (!req) return "127.0.0.1";
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  const xForwarded = req.headers.get("x-forwarded-for");
  if (xForwarded) return xForwarded.split(",")[0].trim();
  const xReal = req.headers.get("x-real-ip");
  if (xReal) return xReal.trim();
  return "127.0.0.1";
}

/**
 * Enforces rate limiting on an incoming HTTP Request.
 * Returns null if allowed, or a 429 Response if throttled.
 */
export async function enforceRateLimit(
  request: Request,
  config: RateLimitConfig,
): Promise<Response | null> {
  const ip = getClientIp(request);
  const bucket = config.bucket || "api";
  const key = `${bucket}:${ip}`;

  const { allowed, remaining, degraded } = await check(key, config.limit, config.windowSec, {
    failMode: config.failMode || "open",
  });

  if (!allowed) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: degraded ? "RATE_LIMITER_DOWN" : "TOO_MANY_REQUESTS",
        message: "Too many requests. Please try again later.",
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(config.windowSec),
          "X-RateLimit-Limit": String(config.limit),
          "X-RateLimit-Remaining": String(remaining),
        },
      },
    );
  }

  return null;
}

/**
 * TanStack Start Server Function Middleware for Rate Limiting.
 */
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return createMiddleware({ type: "function" }).server(async ({ next }) => {
    const request = getRequest();
    if (request) {
      const throttled = await enforceRateLimit(request, config);
      if (throttled) {
        throw new Error(
          `Rate limit exceeded (${config.limit} req / ${config.windowSec}s). Please wait.`,
        );
      }
    }
    return next();
  });
}

/** Pre-configured Standard Rate Limiting Middleware */
export const publicApiRateLimit = createRateLimitMiddleware({
  limit: 60,
  windowSec: 60,
  bucket: "public_api",
});

export const authRateLimit = createRateLimitMiddleware({
  limit: 15,
  windowSec: 60,
  bucket: "auth",
  failMode: "closed",
});

export const uploadRateLimit = createRateLimitMiddleware({
  limit: 30,
  windowSec: 60,
  bucket: "upload",
});
