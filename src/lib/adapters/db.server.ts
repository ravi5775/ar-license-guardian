/**
 * Database adapter — the ONLY module that knows whether we're talking to Neon
 * (HTTP, edge) or plain Postgres 16 (TCP, self-hosted). Query code calls
 * `sql` / `queryOne` / `queryMany` and stays byte-identical on both branches.
 *
 * Write plain SQL only. Anything Neon lacks (extensions, LISTEN/NOTIFY,
 * background workers) is off-limits, otherwise the branches genuinely fork.
 */
import { dbDriver, requireEnv } from "./env.server";

export type Row = Record<string, unknown>;

type Executor = (text: string, params: unknown[]) => Promise<Row[]>;

let executor: Executor | null = null;

async function neonExecutor(): Promise<Executor> {
  const url = requireEnv("DATABASE_URL");
  // Resolved at runtime only — the package is installed per branch, not in the
  // shared lockfile, so keep the specifier out of the static import graph.
  const spec = "@neondatabase/serverless";
  const { neon } = (await import(/* @vite-ignore */ spec)) as unknown as {
    neon: (u: string) => (t: string, p: unknown[]) => Promise<Row[]>;
  };
  const client = neon(url);
  return (text, params) => client(text, params);
}

async function postgresExecutor(): Promise<Executor> {
  const url = requireEnv("DATABASE_URL");
  const spec = "pg";
  const { Pool } = (await import(/* @vite-ignore */ spec)) as unknown as {
    Pool: new (cfg: { connectionString: string; max?: number }) => {
      query: (t: string, p: unknown[]) => Promise<{ rows: Row[] }>;
    };
  };
  const pool = new Pool({ connectionString: url, max: 10 });
  return async (text, params) => (await pool.query(text, params)).rows;
}

async function getExecutor(): Promise<Executor> {
  if (executor) return executor;
  const driver = dbDriver();
  if (driver === "none") {
    throw new Error(
      "No database on this build. The client-app branch is stateless — it must not query a DB.",
    );
  }
  executor = driver === "neon" ? await neonExecutor() : await postgresExecutor();
  return executor;
}

/** Parameterised query. Never interpolate user input into `text`. */
export async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await getExecutor();
  return (await run(text, params)) as T[];
}

export async function queryOne<T extends Row = Row>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await sql<T>(text, params);
  return rows[0] ?? null;
}

export const queryMany = sql;

/** Test hook — lets the RLS/licence tests swap in a fake executor. */
export function __setExecutor(fn: Executor | null) {
  executor = fn;
}
