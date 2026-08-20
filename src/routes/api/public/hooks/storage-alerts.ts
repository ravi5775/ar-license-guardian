import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limiter.middleware";

/**
 * Nightly storage check. Called by pg_cron / an external scheduler and
 * authenticated with a dedicated shared secret (STORAGE_ALERTS_CRON_SECRET)
 * sent as `x-cron-secret` or `Authorization: Bearer <secret>`. The publishable
 * key is NOT a credential — it ships in the browser bundle.
 *
 * Alerts at 80% of quota, once per crossing: `storage_alert_sent_at` is set
 * when we notify and cleared when usage drops back under the threshold, so a
 * client sitting at 85% for a month gets one email, not thirty.
 */
function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/hooks/storage-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const throttled = await enforceRateLimit(request, {
          limit: 10,
          windowSec: 60,
          bucket: "cron_storage_alerts",
          failMode: "closed",
        });
        if (throttled) return throttled;

        const expected = process.env["STORAGE_ALERTS_CRON_SECRET"];
        const provided =
          request.headers.get("x-cron-secret") ??
          request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
          "";
        if (!expected || !provided || !constantTimeEqual(provided, expected)) {
          return new Response("Unauthorized", { status: 401 });
        }


        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );

        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("id, email, display_name, storage_quota_bytes, storage_alert_sent_at")
          .eq("approval_status", "approved");

        let notified = 0;
        let cleared = 0;

        for (const p of profiles ?? []) {
          const { data: rows } = await supabaseAdmin
            .from("media_objects")
            .select("bytes")
            .eq("owner_id", p.id);
          const used = (rows ?? []).reduce((n, r) => n + Number(r.bytes ?? 0), 0);
          const quota = Number(p.storage_quota_bytes ?? 0);
          if (quota <= 0) continue;

          const over = used / quota >= 0.8;

          if (over && !p.storage_alert_sent_at) {
            await supabaseAdmin
              .from("profiles")
              .update({ storage_alert_sent_at: new Date().toISOString() })
              .eq("id", p.id);
            await supabaseAdmin.from("audit_log").insert({
              actor_id: null,
              action: "storage.quota_warning",
              target_type: "profile",
              target_id: p.id,
              metadata: {
                used_bytes: used,
                quota_bytes: quota,
                percent: Math.round((used / quota) * 100),
              },
            });
            notified++;
          } else if (!over && p.storage_alert_sent_at) {
            // Re-arm so the next crossing alerts again.
            await supabaseAdmin
              .from("profiles")
              .update({ storage_alert_sent_at: null })
              .eq("id", p.id);
            cleared++;
          }
        }

        return Response.json({ ok: true, notified, cleared });
      },
    },
  },
});
