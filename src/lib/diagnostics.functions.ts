import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "@/lib/admin-guard";

export type GateEventRow = {
  id: string;
  created_at: string;
  user_id: string | null;
  path: string;
  decision: string;
  reason: string;
  is_admin: boolean;
  approval: string | null;
  deployment_role: string;
  meta: Record<string, unknown> | null;
};

/**
 * Fire-and-forget writer used by the auth gate. Unauthenticated by
 * necessity (it also logs the "no session" redirect), so it validates its
 * input strictly and is rate limited inside recordGateEvent.
 */
export const logGateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        path: z.string().max(512),
        decision: z.enum(["allow", "redirect", "deny"]),
        reason: z.string().max(200),
        isAdmin: z.boolean().optional(),
        approval: z.string().max(32).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { recordGateEvent } = await import("@/lib/gate-log.server");
    await recordGateEvent(data);
    return { ok: true as const };
  });

/** Admin-only reader for the diagnostics page. */
export const listGateEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GateEventRow[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("gate_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as GateEventRow[];
  });
