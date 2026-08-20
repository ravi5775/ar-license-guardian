import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limiter.middleware";

/**
 * One-time media redemption.
 *
 * Public by design: the nonce IS the credential (32 random bytes, only its
 * SHA-256 is stored). The first GET consumes it atomically in Postgres, then
 * we redirect to a 60-second signed storage URL. A second request — including
 * a replay by anyone who intercepted the link — gets 410 Gone.
 *
 * Honest limit: the 60-second signed URL that we redirect to is itself
 * re-fetchable within that minute, and nothing here prevents the legitimate
 * viewer from saving the file. This stops link *resharing*, not copying.
 */
export const Route = createFileRoute("/api/public/m/$nonce")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const throttled = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          bucket: "nonce_redeem",
          failMode: "open",
        });
        if (throttled) return throttled;

        const raw = params.nonce;
        if (!raw || raw.length < 20 || raw.length > 200) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import(
          "@/integrations/supabase/client.server"
        );
        const { sha256Hex } = await import("@/lib/content-access.server");

        const { data, error } = await supabaseAdmin.rpc("consume_media_nonce", {
          _nonce_hash: await sha256Hex(raw),
        });

        // Already used, expired, or never existed — one indistinguishable
        // answer, so a prober cannot tell which.
        const path = (data as { storage_path: string }[] | null)?.[0]
          ?.storage_path;
        if (error || !path) {
          return new Response("This link has already been used.", {
            status: 410,
            headers: { "cache-control": "no-store" },
          });
        }

        const { data: signed } = await supabaseAdmin.storage
          .from("ar-media")
          .createSignedUrl(path, 60);
        if (!signed?.signedUrl) {
          return new Response("Unavailable", { status: 503 });
        }

        return new Response(null, {
          status: 302,
          headers: {
            location: signed.signedUrl,
            // Must never be cached: a cached 302 would make the link reusable.
            "cache-control": "no-store, private",
          },
        });
      },
    },
  },
});
