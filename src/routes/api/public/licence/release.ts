/**
 * §4.4 — self-service device release. The client presses "release this device"
 * (or the vendor runs it during a handover) and the slot frees up after a 12h
 * cooldown. Possession of the device secret is required, so knowing the licence
 * key alone cannot evict somebody else's live device.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { releaseDevice } from "@/lib/adapters/licence.server";
import { check } from "@/lib/adapters/ratelimit.server";
import { clientIp, json } from "@/lib/licence-http";

const Schema = z.object({
  licenceKey: z.string().min(10).max(200),
  deviceSecret: z.string().min(16).max(200),
});

export const Route = createFileRoute("/api/public/licence/release")({
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

        // Mutation → fail closed.
        const { allowed } = await check(`licence:release:${clientIp(request) ?? "unknown"}`, 5, 3600, {
          failMode: "closed",
        });
        if (!allowed) return json({ ok: false, error: "RATE_LIMITED" }, 429, {}, request);

        const result = await releaseDevice(input.licenceKey, input.deviceSecret);
        if (!result.ok) return json({ ok: false, error: result.error }, result.status, {}, request);
        return json({ ok: true, releaseAfter: result.releaseAfter }, 200, {}, request);
      },
    },
  },
});

