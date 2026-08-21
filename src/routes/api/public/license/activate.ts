import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { sendDuplicateFingerprintAlert } from "@/lib/notify.server";

/**
 * ANTI-RESALE REALITY CHECK — read before relying on this.
 *
 * Deployment fingerprinting is a DETERRENT, not enforcement. The client
 * receives the source code, so any determined buyer can delete this call,
 * stub the response, or point it at their own server. It raises effort and
 * creates a paper trail; it does not make resale impossible.
 *
 * Real enforcement is the signed Source License Agreement. Treat everything
 * here as evidence-gathering, never as a security boundary.
 * See docs/anti-resale.md for the two measures that actually raise the cost.
 */
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

async function rateLimit(
  request: Request,
  bucket: string,
  key: string,
  windowSec: number,
  max: number,
) {
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

// Progressive tiers — if ANY tier trips, request is rejected.
// Repeat offenders hit the daily cap long before the per-minute one resets.
type Tier = { window: number; max: number; label: string };
const IP_TIERS: Tier[] = [
  { window: 60, max: 5, label: "1m" },
  { window: 3600, max: 30, label: "1h" },
  { window: 86400, max: 150, label: "1d" },
];
const FP_TIERS: Tier[] = [
  { window: 60, max: 3, label: "1m" },
  { window: 3600, max: 15, label: "1h" },
  { window: 86400, max: 50, label: "1d" },
];
const KEY_TIERS: Tier[] = [
  { window: 60, max: 5, label: "1m" },
  { window: 3600, max: 30, label: "1h" },
  { window: 86400, max: 100, label: "1d" },
];

async function progressiveLimit(request: Request, bucket: string, key: string, tiers: Tier[]) {
  for (const t of tiers) {
    const ok = await rateLimit(request, `${bucket}:${t.label}`, key, t.window, t.max);
    if (!ok) return { ok: false, tier: t.label };
  }
  return { ok: true as const };
}

// Basic bot / abuse heuristics. Cheap, deterministic, no external calls.
const BOT_UA =
  /(bot|crawler|spider|slurp|curl|wget|python-requests|httpclient|scrapy|headlesschrome|phantomjs)/i;
function botScore(request: Request, fingerprint: string): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const ua = request.headers.get("user-agent") || "";
  if (!ua) {
    score += 3;
    reasons.push("no_ua");
  } else if (ua.length < 15) {
    score += 2;
    reasons.push("short_ua");
  } else if (BOT_UA.test(ua)) {
    score += 3;
    reasons.push("bot_ua");
  }
  const accept = request.headers.get("accept") || "";
  if (!accept.includes("json") && !accept.includes("*/*")) {
    score += 1;
    reasons.push("weak_accept");
  }
  const ct = request.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    score += 2;
    reasons.push("bad_content_type");
  }
  // Fingerprint sanity: reject trivially repeating / low-entropy values.
  const unique = new Set(fingerprint).size;
  if (unique < 5) {
    score += 3;
    reasons.push("low_entropy_fp");
  }
  if (/^(0+|1+|a+|f+)$/i.test(fingerprint)) {
    score += 3;
    reasons.push("dummy_fp");
  }
  return { score, reasons };
}

async function auditReject(
  licenseId: string | null,
  reason: string,
  meta: Record<string, unknown>,
) {
  const admin = await adminClient();
  await admin.from("audit_log").insert({
    action: "activation.rejected",
    target_type: "license",
    target_id: licenseId,
    metadata: { reason, ...meta },
  });
}

async function handleActivate(request: Request) {
  const body = ActivateSchema.parse(await request.json());
  const ip = clientIp(request);

  // 1. Bot / heuristic scoring — score >= 4 is treated as automated abuse.
  const bot = botScore(request, body.fingerprint);
  if (bot.score >= 4) {
    await auditReject(null, "bot_detected", {
      ip,
      fingerprint: body.fingerprint,
      score: bot.score,
      reasons: bot.reasons,
    });
    // Register a hit on the punitive bucket so repeat offenders get IP-banned fast.
    await rateLimit(request, "activate:bot:1h", ip, 3600, 3);
    return json({ ok: false, error: "forbidden" }, 403);
  }

  // 2. Punitive bucket — an IP that's tripped bot detection recently gets short-circuited.
  const notFlagged = await rateLimit(request, "activate:bot:check:1h", ip, 3600, 3);
  if (!notFlagged) {
    return json({ ok: false, error: "temporarily_blocked" }, 429);
  }

  // 3. Progressive rate limits: IP, fingerprint, license key.
  const ipLim = await progressiveLimit(request, "activate:ip", ip, IP_TIERS);
  if (!ipLim.ok)
    return json({ ok: false, error: "rate_limited", scope: "ip", tier: ipLim.tier }, 429);
  const fpLim = await progressiveLimit(request, "activate:fp", body.fingerprint, FP_TIERS);
  if (!fpLim.ok)
    return json({ ok: false, error: "rate_limited", scope: "fingerprint", tier: fpLim.tier }, 429);
  const keyLim = await progressiveLimit(request, "activate:key", body.license_key, KEY_TIERS);
  if (!keyLim.ok)
    return json({ ok: false, error: "rate_limited", scope: "license", tier: keyLim.tier }, 429);

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
    void sendDuplicateFingerprintAlert({
      license_key: body.license_key,
      client_name: license.client_name,
      client_email: license.client_email,
      attempted_fingerprint: body.fingerprint,
      attempted_domain: body.deployment_domain,
      ip,
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
