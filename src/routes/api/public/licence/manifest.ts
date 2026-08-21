/**
 * CI on the `client-app` branch POSTs the signed asset manifest here after a
 * successful build, so heartbeats from that release can be validated.
 * Authenticated with a shared secret (RELEASE_MANIFEST_SECRET), not a licence.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Schema = z.object({
  buildId: z.string().min(4).max(200),
  assetDigest: z.string().min(32).max(200),
  signature: z.string().min(16).max(4000),
  branch: z.string().max(64).default("client-app"),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/licence/manifest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["RELEASE_MANIFEST_SECRET"];
        const provided = request.headers.get("x-release-secret") ?? "";
        if (!secret || !timingSafeEqual(provided, secret)) {
          return json({ ok: false, error: "UNAUTHORIZED" }, 401);
        }
        try {
          const input = Schema.parse(await request.json());
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("release_manifests").upsert(
            {
              build_id: input.buildId,
              asset_digest: input.assetDigest,
              signature: input.signature,
              branch: input.branch,
            },
            { onConflict: "build_id" },
          );
          if (error) return json({ ok: false, error: error.message }, 500);
          return json({ ok: true });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "BAD_REQUEST" }, 400);
        }
      },
    },
  },
});
