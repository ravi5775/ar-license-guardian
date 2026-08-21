/**
 * Single source of truth for runtime selection across the three branches.
 *
 *   main         RUNTIME=edge        DB_DRIVER=neon      RATELIMIT_DRIVER=upstash
 *   self-hosted  RUNTIME=node        DB_DRIVER=postgres  RATELIMIT_DRIVER=redis
 *   client-app   RUNTIME=<either>    DB_DRIVER=none      RATELIMIT_DRIVER=memory
 *
 * Nothing outside src/lib/adapters/** may read these variables. Components,
 * routes and business logic import the adapters, never the env.
 */

export type Runtime = "edge" | "node";
export type DbDriver = "neon" | "postgres" | "none";
export type RateLimitDriver = "upstash" | "redis" | "postgres" | "memory";
export type LicenceRole = "issuer" | "client";

function env(name: string, fallback?: string): string | undefined {
  // Read at call time — edge runtimes inject env per request.
  return process.env[name] ?? fallback;
}

export function runtime(): Runtime {
  return (env("RUNTIME") as Runtime) ?? "edge";
}

export function dbDriver(): DbDriver {
  const explicit = env("DB_DRIVER") as DbDriver | undefined;
  if (explicit) return explicit;
  return runtime() === "node" ? "postgres" : "neon";
}

export function rateLimitDriver(): RateLimitDriver {
  const explicit = env("RATELIMIT_DRIVER") as RateLimitDriver | undefined;
  if (explicit) return explicit;
  if (env("UPSTASH_REDIS_REST_URL")) return "upstash";
  if (env("REDIS_URL")) return "redis";
  return "postgres";
}

/**
 * "issuer" on main + self-hosted, "client" on client-app.
 * The licence issuer must NEVER be deployed to a customer.
 *
 * Default is "client" (least privilege). Admin builds MUST explicitly set
 * LICENCE_ROLE=issuer. An unconfigured deployment is never accidentally
 * promoted to an admin build.
 */
export function licenceRole(): LicenceRole {
  return (env("LICENCE_ROLE") as LicenceRole) ?? "client";
}

export function requireEnv(name: string): string {
  const value = env(name);
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const readEnv = env;
