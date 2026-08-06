import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { refresh } from "@/lib/adapters/licence.server";
import { check } from "@/lib/adapters/ratelimit.server";

const Schema = z.object({
  licenceKey: z.string().min(10),
  deviceFingerprint: z.string().min(16),
  platform: z.enum(["mobile", "desktop"]),
  buildId: z.string().max(200).optional(),
  assetDigest: z.string().max(200).optional(),
  originHost: z.string().max(255).optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

export const Route = createFileRoute("/api/public/licence/refresh")({
  server: {
    handlers: {
      OPTIONS: async () => json({ ok: true }),
      POST: async ({ request }) => {
        try {
          const input = Schema.parse(await request.json());
          const ip =
            request.headers.get("cf-connecting-ip") ||
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            "unknown";
          const { allowed } = await check(`licence:refresh:${input.deviceFingerprint}`, 12, 3600);
          if (!allowed) return json({ ok: false, error: "RATE_LIMITED" }, 429);

          const result = await refresh({
            ...input,
            ip,
            userAgent: request.headers.get("user-agent") ?? undefined,
          });
          if (!result.ok) return json({ ok: false, error: result.error }, result.status);
          return json({
            ok: true,
            token: result.token,
            plan: result.plan,
            features: result.features,
            expiresIn: result.expiresIn,
          });
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "BAD_REQUEST" }, 400);
        }
      },
    },
  },
});
