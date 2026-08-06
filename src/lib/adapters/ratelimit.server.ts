/**
 * Rate-limit adapter — one interface, four backends.
 *   upstash  (edge / main)        HTTP Redis, no TCP needed on Workers
 *   redis    (self-hosted)        node-redis against the Redis container
 *   postgres (either, fallback)   existing check_and_record_hit RPC
 *   memory   (dev / client-app)   per-isolate, best-effort only
 *
 * Everything above the adapter calls `check(key, limit, windowSeconds)`.
 */
import { rateLimitDriver, readEnv, requireEnv } from "./env.server";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

type Backend = (key: string, limit: number, windowSeconds: number) => Promise<RateLimitResult>;

let backend: Backend | null = null;

/** Fixed-window counter: INCR + EXPIRE on first hit. */
async function upstashBackend(): Promise<Backend> {
  const url = requireEnv("UPSTASH_REDIS_REST_URL").replace(/\/+$/, "");
  const token = requireEnv("UPSTASH_REDIS_REST_TOKEN");
  const call = async (cmd: unknown[]) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!res.ok) throw new Error(`upstash [${res.status}]: ${await res.text()}`);
    return (await res.json()) as { result: number };
  };
  return async (key, limit, windowSeconds) => {
    const { result } = await call(["INCR", key]);
    if (result === 1) await call(["EXPIRE", key, windowSeconds]);
    return { allowed: result <= limit, remaining: Math.max(0, limit - result) };
  };
}

async function redisBackend(): Promise<Backend> {
  const url = requireEnv("REDIS_URL");
  const spec = "redis";
  const { createClient } = (await import(/* @vite-ignore */ spec)) as unknown as {
    createClient: (cfg: { url: string }) => {
      connect: () => Promise<unknown>;
      incr: (k: string) => Promise<number>;
      expire: (k: string, s: number) => Promise<unknown>;
    };
  };
  const client = createClient({ url });
  await client.connect();
  return async (key, limit, windowSeconds) => {
    const count = await client.incr(key);
    if (count === 1) await client.expire(key, windowSeconds);
    return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
  };
}

async function postgresBackend(): Promise<Backend> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return async (key, limit, windowSeconds) => {
    const [bucket, ...rest] = key.split(":");
    const { data, error } = await supabaseAdmin.rpc("check_and_record_hit", {
      _bucket: bucket ?? "default",
      _key: rest.join(":") || key,
      _window_seconds: windowSeconds,
      _max: limit,
    });
    if (error) {
      console.error("[ratelimit:" + "postgres] " + error.message);
      return { allowed: true, remaining: limit }; // fail-open, same as before
    }
    return { allowed: data === true, remaining: data === true ? limit - 1 : 0 };
  };
}

function memoryBackend(): Backend {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return async (key, limit, windowSeconds) => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return { allowed: true, remaining: limit - 1 };
    }
    entry.count += 1;
    return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
  };
}

async function getBackend(): Promise<Backend> {
  if (backend) return backend;
  const driver = rateLimitDriver();
  if (driver === "upstash") backend = await upstashBackend();
  else if (driver === "redis") backend = await redisBackend();
  else if (driver === "postgres") backend = await postgresBackend();
  else backend = memoryBackend();
  return backend;
}

/** Returns allowed=false when the caller has exceeded `limit` in the window. */
export async function check(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const run = await getBackend();
    return await run(key, limit, windowSeconds);
  } catch (e) {
    console.error("[ratelimit] backend error, failing open:", e);
    return { allowed: true, remaining: limit };
  }
}

export function __setBackend(fn: Backend | null) {
  backend = fn;
}

export const currentDriver = rateLimitDriver;
export const isConfigured = () => Boolean(readEnv("UPSTASH_REDIS_REST_URL") || readEnv("REDIS_URL"));
