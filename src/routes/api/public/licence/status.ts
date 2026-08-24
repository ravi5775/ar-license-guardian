/**
 * GET /api/public/licence/status
 * Non-sensitive public endpoint for client self-service diagnostics.
 * Returns license plan, expiry, active device slots, and status without
 * exposing private keys or database IDs.
 */
import { createFileRoute } from "@tanstack/react-router";
import { enforceRateLimit } from "@/lib/rate-limiter.middleware";
import { getLicenceStatus } from "@/lib/adapters/licence.server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
}

export const Route = createFileRoute("/api/public/licence/status")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const throttled = await enforceRateLimit(request, {
          limit: 30,
          windowSec: 60,
          bucket: "licence_status",
          failMode: "open",
        });
        if (throttled) return throttled;

        const url = new URL(request.url);
        const licenceKey =
          url.searchParams.get("key") ||
          request.headers.get("x-licence-key") ||
          "";

        if (!licenceKey || licenceKey.length < 8) {
          return json({ ok: false, error: "MISSING_LICENCE_KEY" }, 400);
        }

        try {
          const result = await getLicenceStatus(licenceKey);
          if (!result.ok) {
            return json({ ok: false, error: result.error }, result.status);
          }
          return json(result, 200);
        } catch (e) {
          console.error("[licence:status] Internal error:", e);
          return json(
            { ok: false, error: "INTERNAL_ERROR" },
            500,
          );
        }
      },
    },
  },
});
