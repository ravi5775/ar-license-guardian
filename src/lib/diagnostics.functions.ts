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
  meta: string | null;
};

/**
 * Fire-and-forget writer used by the auth gate. Unauthenticated by
 * necessity (it also logs the "no session" redirect), so it validates its
 * input strictly and is rate limited inside recordGateEvent.
 */
export const logGateEvent = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
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
    return (data ?? []).map((r) => ({
      id: String(r.id),
      created_at: r.created_at,
      user_id: r.user_id,
      path: r.path,
      decision: r.decision,
      reason: r.reason,
      is_admin: r.is_admin,
      approval: r.approval,
      deployment_role: r.deployment_role,
      meta: r.meta ? JSON.stringify(r.meta) : null,
    }));
  });

export type DeviceTelemetryRow = {
  id: string;
  device_class: string;
  capability_tier: string | null;
  origin_host: string | null;
  build_id: string | null;
  last_seen_at: string;
  license_key: string;
};

/** Admin-only reader for client device capability & telemetry. */
export const listDeviceTelemetry = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DeviceTelemetryRow[]> => {
    await requireAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("license_activations")
      .select("id, device_class, capability_tier, origin_host, build_id, last_seen_at, licenses(license_key)")
      .order("last_seen_at", { ascending: false })
      .limit(100);

    if (error) return [];
    return (data ?? []).map((r: any) => ({
      id: r.id,
      device_class: r.device_class,
      capability_tier: r.capability_tier,
      origin_host: r.origin_host,
      build_id: r.build_id,
      last_seen_at: r.last_seen_at,
      license_key: r.licenses?.license_key ?? "unknown",
    }));
  });

