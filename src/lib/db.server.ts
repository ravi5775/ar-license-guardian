/**
 * Unified Database Adapter Module.
 * Abstracts database operations across both:
 *  - main (edge / Neon / Supabase serverless Postgres)
 *  - self-hosted (private server / Docker / Postgres 16)
 */

export type DbDriver = "supabase" | "postgres" | "neon";

export function getDbDriver(): DbDriver {
  const driver = process.env.DB_DRIVER as DbDriver | undefined;
  if (driver) return driver;
  if (process.env.DATABASE_URL) return "postgres";
  return "supabase";
}

/**
 * Returns the administrative Supabase client instance.
 */
export async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Returns database connection string if self-hosted or using direct PostgreSQL connection.
 */
export function getDatabaseUrl(): string | null {
  return process.env.DATABASE_URL || null;
}

/**
 * Executes a database action using the unified driver configuration.
 */
export async function executeDbAction<T>(
  action: (db: Awaited<ReturnType<typeof getSupabaseAdmin>>) => Promise<T>,
): Promise<T> {
  const db = await getSupabaseAdmin();
  return action(db);
}
