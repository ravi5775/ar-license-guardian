import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { notifyDuplicateFingerprint } from "@/lib/notify.functions";

const ActivateSchema = z.object({
  license_key: z.string().min(10),
  fingerprint: z.string().min(8),
  deployment_domain: z.string().optional(),
  deployment_platform: z.string().optional(),
  supabase_ref: z.string().optional(),
});

const VerifySchema = z.object({
  license_key: z.string().min(10),
  fingerprint: z.string().min(8),
});

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

async function rateLimit(request: Request, bucket: string, key: string, windowSec: number, max: number) {
  const admin = await adminClient();
  const { data, error } = await admin.rpc("check_and_record_hit", {
    _bucket: bucket,
    _key: key,
    _window_seconds: windowSec,
    _max: max,
  });
  if (error) {
    console.error("[rate_limit] rpc error", error);
    return true; // fail-open
  }
  return data === true;
}

async function handleActivate(request: Request) {
  const body = ActivateSchema.parse(await request.json());
  const ip = clientIp(request);

  // Rate limit per IP (10/min) + per license key (30/hour)
  const ipOk = await rateLimit(request, "activate:ip", ip, 60, 10);
  const keyOk = await rateLimit(request, "activate:key", body.license_key, 3600, 30);
  if (!ipOk || !keyOk) return json({ ok: false, error: "rate_limited" }, 429);

  const admin = await adminClient();

  const { data: license } = await admin
    .from("licenses")
    .select("*, license_activations(id, fingerprint, revoked_at)")
    .eq("license_key", body.license_key)
    .maybeSingle();

  if (!license) return json({ ok: false, error: "invalid_license" }, 404);
  if (license.status !== "active")
    return json({ ok: false, error: `license_${license.status}` }, 403);
  if (license.expires_at && new Date(license.expires_at) < new Date())
    return json({ ok: false, error: "license_expired" }, 403);

  const activeCount = (license.license_activations ?? []).filter((a: any) => !a.revoked_at).length;
  const existing = (license.license_activations ?? []).find(
    (a: any) => a.fingerprint === body.fingerprint && !a.revoked_at,
  );

  if (!existing && activeCount >= license.max_activations) {
    // Duplicate / over-limit → audit + notify
    await admin.from("audit_log").insert({
      action: "activation.rejected",
      target_type: "license",
      target_id: license.id,
      metadata: {
        reason: "duplicate_fingerprint_or_limit",
        attempted_fingerprint: body.fingerprint,
        attempted_domain: body.deployment_domain,
        ip,
      },
    });
    // Fire and forget — must not block response
    notifyDuplicateFingerprint({
      data: {
        license_key: body.license_key,
        client_name: license.client_name,
        client_email: license.client_email,
        attempted_fingerprint: body.fingerprint,
        attempted_domain: body.deployment_domain,
        ip,
      },
    }).catch((e) => console.error("[notify] failed", e));
    return json({ ok: false, error: "activation_limit_reached" }, 403);
  }

  const ua = request.headers.get("user-agent") || null;

  if (existing) {
    await admin
      .from("license_activations")
      .update({ last_seen_at: new Date().toISOString(), ip_address: ip, user_agent: ua })
      .eq("id", existing.id);
  } else {
    await admin.from("license_activations").insert({
      license_id: license.id,
      fingerprint: body.fingerprint,
      deployment_domain: body.deployment_domain,
      deployment_platform: body.deployment_platform,
      supabase_ref: body.supabase_ref,
      ip_address: ip,
      user_agent: ua,
    });
  }

  return json({
    ok: true,
    plan: license.plan,
    max_activations: license.max_activations,
    expires_at: license.expires_at,
  });
}

async function handleVerify(request: Request) {
  const url = new URL(request.url);
  const params =
    request.method === "POST"
      ? VerifySchema.parse(await request.json())
      : VerifySchema.parse({
          license_key: url.searchParams.get("license_key"),
          fingerprint: url.searchParams.get("fingerprint"),
        });

  const ip = clientIp(request);
  const ok = await rateLimit(request, "verify:ip", ip, 60, 30);
  if (!ok) return json({ ok: false, error: "rate_limited" }, 429);

  const admin = await adminClient();

  const { data: license } = await admin
    .from("licenses")
    .select("id, status, plan, expires_at")
    .eq("license_key", params.license_key)
    .maybeSingle();

  if (!license) return json({ ok: false, error: "invalid_license" }, 404);
  if (license.status !== "active")
    return json({ ok: false, error: `license_${license.status}` }, 403);

  const { data: activation } = await admin
    .from("license_activations")
    .select("id, revoked_at")
    .eq("license_id", license.id)
    .eq("fingerprint", params.fingerprint)
    .maybeSingle();

  if (!activation || activation.revoked_at)
    return json({ ok: false, error: "activation_not_found" }, 403);

  await admin
    .from("license_activations")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", activation.id);

  return json({ ok: true, plan: license.plan, expires_at: license.expires_at });
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    },
  });
}

export const Route = createFileRoute("/api/public/license/activate")({
  server: {
    handlers: {
      OPTIONS: async () => json({ ok: true }),
      POST: async ({ request }) => {
        try {
          return await handleActivate(request);
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "bad_request" }, 400);
        }
      },
      GET: async ({ request }) => {
        try {
          return await handleVerify(request);
        } catch (e) {
          return json({ ok: false, error: e instanceof Error ? e.message : "bad_request" }, 400);
        }
      },
    },
  },
});
