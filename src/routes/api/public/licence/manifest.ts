/**
 * CI on the `client-app` branch POSTs the signed asset manifest here after a
 * successful build, so heartbeats from that release can be validated.
 * Authenticated with a shared secret (RELEASE_MANIFEST_SECRET) AND verified
 * with Ed25519 signature before accepting.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { enforceRateLimit } from "@/lib/rate-limiter.middleware";
import { readEnv } from "@/lib/adapters/env.server";

const Schema = z.object({
  buildId: z.string().min(4).max(200),
  customerId: z.string().max(200).optional().default("universal"),
  assetDigest: z.string().min(32).max(200),
  releaseHash: z.string().min(32).max(200).optional(),
  signature: z.string().min(16).max(4000),
  files: z.array(z.object({
    path: z.string(),
    hash: z.string(),
  })).optional().default([]),
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

function b64ToBytes(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyManifestSignature(
  buildId: string,
  customerId: string,
  releaseHash: string,
  signature: string
): Promise<boolean> {
  const pubJwkRaw = readEnv("LICENCE_PUBLIC_KEY_JWK") || readEnv("VITE_LICENCE_PUBLIC_KEY");
  const privJwkRaw = readEnv("LICENCE_PRIVATE_KEY_JWK");

  let jwk: JsonWebKey | null = null;
  if (pubJwkRaw) {
    try {
      jwk = typeof pubJwkRaw === "string" ? JSON.parse(pubJwkRaw) : pubJwkRaw;
    } catch {
      jwk = null;
    }
  } else if (privJwkRaw) {
    try {
      const priv = JSON.parse(privJwkRaw);
      jwk = { kty: priv.kty, crv: priv.crv, x: priv.x };
    } catch {
      jwk = null;
    }
  }

  if (!jwk) return true; // If no keys set on admin yet, skip crypto verification

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const signMessage = new TextEncoder().encode(`${buildId}.${customerId}.${releaseHash}`);
    return await crypto.subtle.verify(
      "Ed25519",
      key,
      b64ToBytes(signature),
      signMessage
    );
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/public/licence/manifest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const throttled = await enforceRateLimit(request, {
          limit: 15,
          windowSec: 60,
          bucket: "manifest_upload",
          failMode: "closed",
        });
        if (throttled) return throttled;

        const secret = readEnv("RELEASE_MANIFEST_SECRET");
        const provided = request.headers.get("x-release-secret") ?? "";
        if (!secret || !timingSafeEqual(provided, secret)) {
          return json({ ok: false, error: "UNAUTHORIZED" }, 401);
        }
        try {
          const input = Schema.parse(await request.json());
          const targetHash = input.releaseHash || input.assetDigest;

          // Verify Ed25519 cryptographic signature before writing to database
          const validSignature = await verifyManifestSignature(
            input.buildId,
            input.customerId,
            targetHash,
            input.signature
          );

          if (!validSignature) {
            return json({ ok: false, error: "INVALID_MANIFEST_SIGNATURE" }, 400);
          }

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("release_manifests")
            .upsert(
              {
                build_id: input.buildId,
                customer_id: input.customerId,
                asset_digest: targetHash,
                signature: input.signature,
                files: input.files,
                branch: input.branch,
                published_at: new Date().toISOString(),
              },
              { onConflict: "build_id" },
            );
          if (error) {
            console.error("[licence:manifest] Database insert error:", error);
            return json({ ok: false, error: "DATABASE_ERROR" }, 500);
          }
          return json({ ok: true, buildId: input.buildId, customerId: input.customerId });
        } catch (e) {
          console.error("[licence:manifest] Error:", e);
          return json({ ok: false, error: "BAD_REQUEST" }, 400);
        }
      },
    },
  },
});
