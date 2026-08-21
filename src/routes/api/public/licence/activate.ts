import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { activate } from "@/lib/adapters/licence.server";
import { check } from "@/lib/adapters/ratelimit.server";
import { clientIp, json, serverDerivedOrigin } from "@/lib/licence-http";

/**
 * Note what is NOT in this schema: `originHost`. The origin is taken from the
 * request headers below — a body-declared origin is self-certification (§4.2).
 * `deviceFingerprint` IS accepted, but only as a support signal; device
 * identity is the server-minted `deviceSecret`.
 */
const Schema = z.object({
  licenceKey: z.string().min(10).max(200),
  platform: z.enum(["mobile", "desktop"]),
  buildId: z.string().max(200).optional(),
  assetDigest: z.string().max(200).optional(),
  deviceFingerprint: z.string().max(200).optional(),
  deviceSecret: z.string().max(200).optional(),
  capabilityTier: z.string().max(32).optional(),
  label: z.string().max(80).optional(),
});

export const Route = createFileRoute("/api/public/licence/activate")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => json({ ok: true }, 200, {}, request),
      POST: async ({ request }) => {
        let input: z.infer<typeof Schema>;
        try {
          input = Schema.parse(await request.json());
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "BAD_REQUEST" }, 400, {}, request);
        }

        const ip = clientIp(request);
        const originHost = serverDerivedOrigin(request);

        // Activation is a mutation that allocates a device slot: it fails CLOSED
        // when the limiter store is down, so an outage is never a free-for-all.
        for (const [key, limit, win] of [
          [`licence:ip:${ip ?? "unknown"}`, 10, 60],
          [`licence:key:${input.licenceKey}`, 20, 3600],
        ] as const) {
          const { allowed, degraded } = await check(key, limit, win, { failMode: "closed" });
          if (!allowed) {
            return json(
              { ok: false, error: degraded ? "RATE_LIMITER_DOWN" : "RATE_LIMITED" },
              429,
              {},
              request,
              originHost,
            );
          }
        }

        const result = await activate({
          licenceKey: input.licenceKey,
          platform: input.platform,
          originHost,
          ip,
          userAgent: request.headers.get("user-agent"),
          attestation: { buildId: input.buildId, assetDigest: input.assetDigest },
          fingerprintSignal: input.deviceFingerprint ?? null,
          deviceSecret: input.deviceSecret ?? null,
          capabilityTier: input.capabilityTier ?? null,
          label: input.label ?? null,
        });

        if (!result.ok) return json({ ok: false, error: result.error }, result.status, {}, request, originHost);
        return json(
          {
            ok: true,
            token: result.token,
            plan: result.plan,
            features: result.features,
            expiresIn: result.expiresIn,
            graceHours: result.graceHours,
            deviceId: result.deviceId,
            // Shown exactly once. The client stores it; the server keeps only a hash.
            deviceSecret: result.deviceSecret,
          },
          200,
          {},
          request,
          originHost,
        );
      },
    },
  },
});

