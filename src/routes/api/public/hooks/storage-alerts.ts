import { createFileRoute } from "@tanstack/react-router";

/**
 * Nightly storage check. Called by pg_cron; authenticated with the anon key
 * in the `apikey` header (the documented pattern — no bespoke shared secret).
 *
 * Alerts at 80% of quota, once per crossing: `storage_alert_sent_at` is set
 * when we notify and cleared when usage drops back under the threshold, so a
 * client sitting at 85% for a month gets one email, not thirty.
 */
export const Route = createFileRoute("/api/public/hooks/storage-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey");
        if (!key || key !== process.env["SUPABASE_ANON_KEY"]) {
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
