import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { refresh } from "@/lib/adapters/licence.server";
import { check } from "@/lib/adapters/ratelimit.server";
import { clientIp, json, serverDerivedOrigin } from "@/lib/licence-http";

const Schema = z.object({
  licenceKey: z.string().min(10).max(200),
  platform: z.enum(["mobile", "desktop"]),
  deviceSecret: z.string().min(16).max(200),
  buildId: z.string().max(200).optional(),
  assetDigest: z.string().max(200).optional(),
  deviceFingerprint: z.string().max(200).optional(),
  capabilityTier: z.string().max(32).optional(),
});

export const Route = createFileRoute("/api/public/licence/refresh")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => json({ ok: true }, 200, {}, request),
      POST: async ({ request }) => {
        let input: z.infer<typeof Schema>;
        try {
          input = Schema.parse(await request.json());
        } catch (e) {
          return json(
            { ok: false, error: e instanceof Error ? e.message : "BAD_REQUEST" },
            400,
            {},
            request,
          );
        }

        const ip = clientIp(request);
        const originHost = serverDerivedOrigin(request);

        // Refresh allocates nothing and every live viewer depends on it, so a
        // limiter outage fails OPEN here — but it is logged and the response
        // says so, rather than pretending the limit was enforced.
        const { allowed, degraded } = await check(`licence:refresh:${input.licenceKey}`, 12, 3600, {
          failMode: "open",
        });
        if (!allowed)
          return json(
            { ok: false, error: "RATE_LIMITED" },
            429,
            { "Retry-After": "3600" },
            request,
            originHost,
          );

        const result = await refresh({
          licenceKey: input.licenceKey,
          platform: input.platform,
          originHost,
          ip,
          userAgent: request.headers.get("user-agent"),
          attestation: { buildId: input.buildId, assetDigest: input.assetDigest },
          fingerprintSignal: input.deviceFingerprint ?? null,
          deviceSecret: input.deviceSecret,
          capabilityTier: input.capabilityTier ?? null,
        });

        if (!result.ok)
          return json({ ok: false, error: result.error }, result.status, {}, request, originHost);
        return json(
          {
            ok: true,
            token: result.token,
            plan: result.plan,
            features: result.features,
            expiresIn: result.expiresIn,
            graceHours: result.graceHours,
            deviceId: result.deviceId,
            limiterDegraded: degraded ?? false,
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
