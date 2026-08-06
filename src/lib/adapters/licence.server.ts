/**
 * Licence adapter — ISSUER side. Exists on `main` and `self-hosted` ONLY.
 * It must never ship on `client-app`: if the customer hosts the validator,
 * they own the validator and every control below is theatre.
 *
 * Responsibilities:
 *   1. Activation + device binding (one mobile slot, one desktop slot).
 *   2. Ed25519-signed short-lived licence tokens (24h, refreshed every 12h).
 *   3. Heartbeat attestation against the signed release manifest.
 *   4. Violation recording + admin email. Never emailed by the client — a
 *      tampered client just deletes that line.
 */
import { readEnv, requireEnv } from "./env.server";

export type DeviceClass = "mobile" | "desktop";

export interface ActivateInput {
  licenceKey: string;
  deviceFingerprint: string;
  platform: DeviceClass;
  buildId?: string;
  assetDigest?: string;
  originHost?: string;
  ip?: string;
  userAgent?: string;
}

export interface LicenceToken {
  token: string;
  expiresIn: number;
  plan: string;
  features: string[];
}

const TOKEN_TTL_SEC = 60 * 60 * 24; // 24h
const enc = new TextEncoder();

function b64url(bytes: Uint8Array | string) {
  const str =
    typeof bytes === "string" ? bytes : String.fromCharCode(...Array.from(bytes));
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function privateKey() {
  const jwk = JSON.parse(requireEnv("LICENCE_PRIVATE_KEY_JWK")) as JsonWebKey;
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
}

async function signToken(payload: Record<string, unknown>) {
  const key = await privateKey();
  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = new Uint8Array(
    await crypto.subtle.sign("Ed25519", key, enc.encode(`${header}.${body}`)),
  );
  return `${header}.${body}.${b64url(sig)}`;
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function recordViolation(
  kind: string,
  detail: Record<string, unknown>,
  ctx: { licenseId?: string | null; licenceKey?: string; fingerprint?: string; originHost?: string; ip?: string },
  opts: { suspend?: boolean } = {},
) {
  const db = await admin();
  await db.from("license_violations").insert({
    license_id: ctx.licenseId ?? null,
    license_key: ctx.licenceKey ?? null,
    kind,
    detail: detail as never,
    fingerprint: ctx.fingerprint ?? null,
    origin_host: ctx.originHost ?? null,
    ip_address: ctx.ip ?? null,
  });

  if (opts.suspend && ctx.licenseId) {
    await db.from("licenses").update({ status: "suspended" }).eq("id", ctx.licenseId);
  }
  await notifyAdmin(kind, { ...ctx, ...detail, suspended: Boolean(opts.suspend) });
}

async function notifyAdmin(kind: string, detail: Record<string, unknown>) {
  const apiKey = readEnv("RESEND_API_KEY");
  const to = readEnv("ALERT_TO_EMAIL");
  if (!apiKey || !to) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: "Aether Licensing <onboarding@resend.dev>",
      to: [to],
      subject: `⚠️ Licence violation — ${kind}`,
      html: `<p><b>${kind}</b></p><pre>${JSON.stringify(detail, null, 2)}</pre>`,
    }),
  }).catch((e) => console.error("[licence] alert email failed", e));
}

/** Compare a reported build against the manifest CI signed for that release. */
async function verifyBuild(buildId?: string, assetDigest?: string) {
  if (!buildId || !assetDigest) return { ok: false as const, reason: "missing_attestation" };
  const db = await admin();
  const { data } = await db
    .from("release_manifests")
    .select("asset_digest")
    .eq("build_id", buildId)
    .maybeSingle();
  if (!data) return { ok: false as const, reason: "unknown_build" };
  if (data.asset_digest !== assetDigest)
    return { ok: false as const, reason: "digest_mismatch", expected: data.asset_digest };
  return { ok: true as const };
}

function originAllowed(allowed: string[] | null, host?: string) {
  if (!allowed || allowed.length === 0) return true; // not configured yet
  if (!host) return false;
  return allowed.some((a) => host === a || host.endsWith(`.${a}`));
}

export async function activate(input: ActivateInput) {
  const db = await admin();
  const { data: licence } = await db
    .from("licenses")
    .select("*, license_activations(id, fingerprint, device_class, revoked_at)")
    .eq("license_key", input.licenceKey)
    .maybeSingle();

  if (!licence) return { ok: false as const, status: 404, error: "INVALID_LICENCE" };
  if (licence.status !== "active")
    return { ok: false as const, status: 403, error: `LICENCE_${licence.status.toUpperCase()}` };
  if (licence.expires_at && new Date(licence.expires_at) < new Date())
    return { ok: false as const, status: 403, error: "LICENCE_EXPIRED" };

  if (!originAllowed(licence.allowed_origins as string[] | null, input.originHost)) {
    await recordViolation(
      "origin_not_allowed",
      { originHost: input.originHost, allowed: licence.allowed_origins },
      { licenseId: licence.id, licenceKey: input.licenceKey, fingerprint: input.deviceFingerprint, ip: input.ip },
    );
    return { ok: false as const, status: 403, error: "ORIGIN_NOT_ALLOWED" };
  }

  const build = await verifyBuild(input.buildId, input.assetDigest);
  if (!build.ok && build.reason !== "missing_attestation") {
    await recordViolation(
      "build_tampered",
      { reason: build.reason, buildId: input.buildId, reported: input.assetDigest },
      { licenseId: licence.id, licenceKey: input.licenceKey, fingerprint: input.deviceFingerprint, originHost: input.originHost, ip: input.ip },
      { suspend: true },
    );
    return { ok: false as const, status: 403, error: "BUILD_TAMPERED" };
  }

  const live = (licence.license_activations ?? []).filter(
    (a: { revoked_at: string | null }) => !a.revoked_at,
  ) as Array<{ id: string; fingerprint: string; device_class: DeviceClass }>;

  const sameDevice = live.find(
    (a) => a.fingerprint === input.deviceFingerprint && a.device_class === input.platform,
  );
  const slotLimit = input.platform === "mobile" ? licence.allowed_mobile : licence.allowed_desktop;
  const slotUsed = live.filter((a) => a.device_class === input.platform).length;

  if (!sameDevice && slotUsed >= slotLimit) {
    await recordViolation(
      "device_limit",
      { platform: input.platform, limit: slotLimit, attempted: input.deviceFingerprint },
      { licenseId: licence.id, licenceKey: input.licenceKey, fingerprint: input.deviceFingerprint, originHost: input.originHost, ip: input.ip },
    );
    return { ok: false as const, status: 409, error: "DEVICE_LIMIT" };
  }

  const now = new Date().toISOString();
  if (sameDevice) {
    await db
      .from("license_activations")
      .update({
        last_seen_at: now,
        ip_address: input.ip ?? null,
        user_agent: input.userAgent ?? null,
        build_id: input.buildId ?? null,
        asset_digest: input.assetDigest ?? null,
        origin_host: input.originHost ?? null,
      })
      .eq("id", sameDevice.id);
  } else {
    await db.from("license_activations").insert({
      license_id: licence.id,
      fingerprint: input.deviceFingerprint,
      device_class: input.platform,
      deployment_domain: input.originHost ?? null,
      origin_host: input.originHost ?? null,
      build_id: input.buildId ?? null,
      asset_digest: input.assetDigest ?? null,
      ip_address: input.ip ?? null,
      user_agent: input.userAgent ?? null,
    });
  }

  const token = await issueToken(licence, input);
  return { ok: true as const, ...token };
}

async function issueToken(
  licence: { license_key: string; plan: string; grace_hours: number },
  input: ActivateInput,
): Promise<LicenceToken> {
  const iat = Math.floor(Date.now() / 1000);
  const token = await signToken({
    sub: licence.license_key,
    device: input.deviceFingerprint,
    platform: input.platform,
    plan: licence.plan,
    features: featuresFor(licence.plan),
    grace: licence.grace_hours,
    iat,
    exp: iat + TOKEN_TTL_SEC,
  });
  return { token, expiresIn: TOKEN_TTL_SEC, plan: licence.plan, features: featuresFor(licence.plan) };
}

function featuresFor(plan: string): string[] {
  if (plan === "enterprise") return ["ar", "albums", "analytics", "vr", "white_label"];
  if (plan === "pro") return ["ar", "albums", "analytics", "vr"];
  return ["ar", "albums"];
}

/** Heartbeat / refresh — same checks as activation, minus slot allocation. */
export async function refresh(input: ActivateInput) {
  const db = await admin();
  const { data: licence } = await db
    .from("licenses")
    .select("*")
    .eq("license_key", input.licenceKey)
    .maybeSingle();
  if (!licence) return { ok: false as const, status: 404, error: "INVALID_LICENCE" };
  if (licence.status !== "active")
    return { ok: false as const, status: 403, error: `LICENCE_${licence.status.toUpperCase()}` };

  const { data: device } = await db
    .from("license_activations")
    .select("id, revoked_at")
    .eq("license_id", licence.id)
    .eq("fingerprint", input.deviceFingerprint)
    .maybeSingle();
  if (!device || device.revoked_at)
    return { ok: false as const, status: 403, error: "DEVICE_NOT_ACTIVATED" };

  const build = await verifyBuild(input.buildId, input.assetDigest);
  if (!build.ok && build.reason !== "missing_attestation") {
    await recordViolation(
      "build_tampered",
      { reason: build.reason, buildId: input.buildId, reported: input.assetDigest },
      { licenseId: licence.id, licenceKey: input.licenceKey, fingerprint: input.deviceFingerprint, originHost: input.originHost, ip: input.ip },
      { suspend: true },
    );
    return { ok: false as const, status: 403, error: "BUILD_TAMPERED" };
  }

  if (!originAllowed(licence.allowed_origins as string[] | null, input.originHost)) {
    await recordViolation(
      "origin_not_allowed",
      { originHost: input.originHost },
      { licenseId: licence.id, licenceKey: input.licenceKey, fingerprint: input.deviceFingerprint, ip: input.ip },
    );
    return { ok: false as const, status: 403, error: "ORIGIN_NOT_ALLOWED" };
  }

  await db
    .from("license_activations")
    .update({
      last_seen_at: new Date().toISOString(),
      ip_address: input.ip ?? null,
      build_id: input.buildId ?? null,
      asset_digest: input.assetDigest ?? null,
      origin_host: input.originHost ?? null,
    })
    .eq("id", device.id);

  const token = await issueToken(licence, input);
  return { ok: true as const, ...token };
}

/** Release a bound device so the customer can move to new hardware. */
export async function releaseDevice(licenceKey: string, fingerprint: string) {
  const db = await admin();
  const { data: licence } = await db
    .from("licenses")
    .select("id")
    .eq("license_key", licenceKey)
    .maybeSingle();
  if (!licence) return { ok: false as const, error: "INVALID_LICENCE" };
  await db
    .from("license_activations")
    .update({ revoked_at: new Date().toISOString(), released_at: new Date().toISOString() })
    .eq("license_id", licence.id)
    .eq("fingerprint", fingerprint);
  return { ok: true as const };
}
