/**
 * Structured logging for middleware gate decisions.
 *
 * Writes go through the service-role client because `gate_events` denies
 * INSERT to every Data-API role by design (it is an append-only diagnostics
 * sink, not user data). Every write is rate limited per user so a redirect
 * loop can never turn into an unbounded write amplifier, and failures are
 * swallowed: diagnostics must never break the auth gate.
 */
import { check } from "@/lib/adapters/ratelimit.server";
import { deploymentProfile } from "@/lib/adapters/deployment.server";

export type GateDecision = "allow" | "redirect" | "deny";

export type GateEventInput = {
  userId?: string | null;
  path: string;
  decision: GateDecision;
  reason: string;
  isAdmin?: boolean;
  approval?: string | null;
  meta?: Record<string, unknown>;
};

export async function recordGateEvent(input: GateEventInput): Promise<void> {
  try {
    // 30 events / 5 min per subject keeps redirect loops cheap.
    const subject = input.userId ?? "anonymous";
    const { allowed } = await check(`gate:${subject}`, 30, 300, { failMode: "open" });
    if (!allowed) return;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("gate_events").insert({
      user_id: input.userId ?? null,
      path: input.path.slice(0, 512),
      decision: input.decision,
      reason: input.reason.slice(0, 200),
      is_admin: input.isAdmin ?? false,
      approval: input.approval ?? null,
      deployment_role: deploymentProfile().role,
      meta: (input.meta ?? {}) as never,
    });
  } catch (e) {
    console.error("[gate-log] failed to record gate event:", e);
  }
}
