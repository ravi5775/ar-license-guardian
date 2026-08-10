/**
 * Licence adapter — ISSUER side. Exists on `main` and `self-hosted` ONLY.
 * It must never ship on `client-release`: if the customer hosts the validator,
 * they own the validator and every control below is theatre.
 *
 * Design rule (see the commercial blueprint §0): this layer is NOT DRM. Its job
 * is attribution and provenance — make a resold deployment detectable and
 * attributable. The one control with real teeth is presign gating (§4.7): media
 * lives in a bucket with no public read policy, so a licence that does not
 * verify simply never gets a URL.
 *
 * Hard rules encoded here:
 *   §4.1 absent/unparseable attestation is INVALID, never "skip".
 *   §4.2 origin and device identity are server-derived, never body-supplied.
 *   §4.3 one live mobile + one live desktop, enforced by a unique partial index.
 *   §4.4 self-service release with a 12h cooldown.
 *   §4.5 24h EdDSA tokens carrying their own 72h grace window.
 *   §4.8 high-severity violations email the admin, deduped per kind per 24h.
 */
import { readEnv, requireEnv } from "./env.server";
import { sendMail } from "./mailer.server";
import { escapeHtml } from "@/lib/notify.server";

export type DeviceClass = "mobile" | "desktop";

/** Attestation as it arrives from the client. Never trusted, always verified. */
export interface Attestation {
  buildId?: unknown;
  assetDigest?: unknown;
}

/**
 * Everything the issuer needs. `originHost` and `ip` are filled in by the route
 * from request headers — callers must not accept them from the request body.
 */
export interface ActivateInput {
  licenceKey: string;
  platform: DeviceClass;
  /** Server-derived from Origin/Host. */
  originHost: string | null;
  ip: string | null;
  userAgent?: string | null;
  attestation: Attestation;
  /** Client-computed. Stored as a support signal only — never an identity. */
  fingerprintSignal?: string | null;
  /** Returned once at activation; proves possession on later calls. */
  deviceSecret?: string | null;
  capabilityTier?: string | null;
  label?: string | null;
}

export interface IssuedLicence {
  token: string;
  expiresIn: number;
  graceHours: number;
  plan: string;
  features: string[];
  deviceId: string;
  /** Present only on first activation of a device. Never retrievable again. */
  deviceSecret?: string;
}

const TOKEN_TTL_SEC = 60 * 60 * 24; // 24h
const GRACE_HOURS = 72; // §4.5
const RELEASE_COOLDOWN_HOURS = 12; // §4.4
const NOTIFY_DEDUP_HOURS = 24; // §4.8
const enc = new TextEncoder();

/* ------------------------------------------------------------------ crypto */

function b64url(bytes: Uint8Array | string) {
  const str = typeof bytes === "string" ? bytes : String.fromCharCode(...Array.from(bytes));
  return btoa(str).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function randomSecret() {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256Hex(value: string) {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function signToken(payload: Record<string, unknown>) {
  const jwk = JSON.parse(requireEnv("LICENCE_PRIVATE_KEY_JWK")) as JsonWebKey;
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
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

/* -------------------------------------------------------------- violations */

type Severity = "low" | "medium" | "high" | "critical";

const SEVERITY: Record<string, Severity> = {
  missing_attestation: "high",
  unsigned_build: "high",
  unknown_build: "high",
  digest_mismatch: "critical",
  origin_not_allowed: "high",
  device_limit: "high",
  device_secret_mismatch: "critical",
  duplicate_deployment: "critical",
  release_cooldown: "low",
};

export async function recordViolation(
  kind: string,
  detail: Record<string, unknown>,
  ctx: {
    licenseId?: string | null;
    licenceKey?: string;
    fingerprint?: string | null;
    originHost?: string | null;
    ip?: string | null;
  },
  opts: { suspend?: boolean } = {},
) {
  const db = await admin();
  const severity = SEVERITY[kind] ?? "medium";

  const { data: inserted } = await db
    .from("license_violations")
    .insert({
      license_id: ctx.licenseId ?? null,
      license_key: ctx.licenceKey ?? null,
      kind,
      severity,
      detail: detail as never,
      fingerprint: ctx.fingerprint ?? null,
      origin_host: ctx.originHost ?? null,
      ip_address: ctx.ip ?? null,
    })
    .select("id")
    .maybeSingle();

  if (opts.suspend && ctx.licenseId) {
    await db.from("licenses").update({ status: "suspended" }).eq("id", ctx.licenseId);
  }

  if (severity !== "high" && severity !== "critical") return;

  // §4.8 — at most one email per (licence, kind) per 24h.
  const since = new Date(Date.now() - NOTIFY_DEDUP_HOURS * 3600_000).toISOString();
  const { count } = await db
    .from("license_violations")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("license_id", ctx.licenseId ?? "00000000-0000-0000-0000-000000000000")
    .gt("notified_at", since);
  if ((count ?? 0) > 0) return;

  const to = readEnv("ALERT_TO_EMAIL");
  if (!to) return;
  const rows = Object.entries({ ...ctx, ...detail, severity, suspended: !!opts.suspend })
    .map(([k, v]) => `<tr><td><b>${escapeHtml(k)}</b></td><td>${escapeHtml(v)}</td></tr>`)
    .join("");
  const sent = await sendMail({
    to,
    subject: `[${severity}] Licence violation — ${kind}`,
    html: `<p>A licence violation was recorded.</p><table>${rows}</table>
           <p><a href="${escapeHtml(readEnv("ADMIN_BASE_URL") ?? "")}/dashboard/activations">Open the admin dashboard</a></p>`,
  });
  if (sent && inserted?.id) {
    await db
      .from("license_violations")
      .update({ notified_at: new Date().toISOString() })
      .eq("id", inserted.id);
  }
}

/* ------------------------------------------------------------- attestation */

/**
 * §4.1 — a discriminated union so a new state cannot silently fall through to
 * "allow". Callers must handle every case; the default branch denies.
 */
type Attested =
  | { kind: "ok"; buildId: string; assetDigest: string }
  | { kind: "missing_attestation" }
  | { kind: "unsigned_build" }
  | { kind: "unknown_build"; buildId: string }
  | { kind: "digest_mismatch"; buildId: string; reported: string; expected: string };

async function verifyAttestation(a: Attestation): Promise<Attested> {
  const buildId = typeof a.buildId === "string" ? a.buildId.trim() : "";
  const assetDigest = typeof a.assetDigest === "string" ? a.assetDigest.trim() : "";
  if (!buildId || !assetDigest) return { kind: "missing_attestation" };

  const db = await admin();
  const { data } = await db
    .from("release_manifests")
    .select("asset_digest, signature")
    .eq("build_id", buildId)
    .maybeSingle();

  if (!data) return { kind: "unknown_build", buildId };
  if (!data.signature || data.signature === "unsigned") return { kind: "unsigned_build" };
  if (data.asset_digest !== assetDigest)
    return { kind: "digest_mismatch", buildId, reported: assetDigest, expected: data.asset_digest };
  return { kind: "ok", buildId, assetDigest };
}

/** Exactly one place decides whether a build may proceed. Default: deny. */
function attestationAllows(a: Attested): boolean {
  switch (a.kind) {
    case "ok":
      return true;
    case "missing_attestation":
    case "unsigned_build":
    case "unknown_build":
    case "digest_mismatch":
      return false;
    default: {
      const _exhaustive: never = a;
      void _exhaustive;
      return false;
    }
  }
}

/* ------------------------------------------------------------------ origin */

function originAllowed(allowed: string[] | null, host: string | null) {
  if (!allowed || allowed.length === 0) return true; // not yet configured
  if (!host) return false;
  const h = host.toLowerCase().replace(/:\d+$/, "");
  return allowed.some((a) => {
    const want = a.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/:\d+$/, "");
    return h === want || h.endsWith(`.${want}`);
  });
}

/* ------------------------------------------------------------------ tokens */

async function issueToken(
  licence: { id: string; license_key: string; plan: string },
  deviceId: string,
  platform: DeviceClass,
) {
  const iat = Math.floor(Date.now() / 1000);
  const features = featuresFor(licence.plan);
  const token = await signToken({
    sub: licence.license_key,
    dep: licence.id,
    did: deviceId,
    jti: crypto.randomUUID(),
    platform,
    plan: licence.plan,
    features,
    grace: GRACE_HOURS,
    iat,
    exp: iat + TOKEN_TTL_SEC,
  });
  return { token, expiresIn: TOKEN_TTL_SEC, graceHours: GRACE_HOURS, plan: licence.plan, features };
}

function featuresFor(plan: string): string[] {
  if (plan === "enterprise") return ["ar", "albums", "analytics", "vr", "white_label"];
  if (plan === "pro") return ["ar", "albums", "analytics", "vr"];
  return ["ar", "albums"];
}

/* -------------------------------------------------------------- entrypoint */

type Failure = { ok: false; status: number; error: string };
const fail = (status: number, error: string): Failure => ({ ok: false, status, error });

async function loadLicence(licenceKey: string) {
  const db = await admin();
  const { data } = await db
    .from("licenses")
    .select("id, license_key, plan, status, expires_at, allowed_origins")
    .eq("license_key", licenceKey)
    .maybeSingle();
  return data;
}

async function commonChecks(input: ActivateInput) {
  const licence = await loadLicence(input.licenceKey);
  if (!licence) return { failure: fail(404, "INVALID_LICENCE") } as const;
  if (licence.status !== "active")
    return { failure: fail(403, `LICENCE_${String(licence.status).toUpperCase()}`) } as const;
  if (licence.expires_at && new Date(licence.expires_at) < new Date())
    return { failure: fail(403, "LICENCE_EXPIRED") } as const;

  const ctx = {
    licenseId: licence.id,
    licenceKey: input.licenceKey,
    fingerprint: input.fingerprintSignal ?? null,
    originHost: input.originHost,
    ip: input.ip,
  };

  if (!originAllowed(licence.allowed_origins as string[] | null, input.originHost)) {
    await recordViolation(
      "origin_not_allowed",
      { originHost: input.originHost, allowed: licence.allowed_origins },
      ctx,
    );
    return { failure: fail(403, "ORIGIN_NOT_ALLOWED") } as const;
  }

  const attested = await verifyAttestation(input.attestation);
  if (!attestationAllows(attested)) {
    await recordViolation(
      attested.kind,
      { ...attested, reportedBuild: input.attestation.buildId },
      ctx,
      // Only a proven mismatch suspends. A missing/unknown build is loud but
      // must not brick a paid client's viewer over a stale deploy (§10).
      { suspend: attested.kind === "digest_mismatch" },
    );
    return { failure: fail(403, "ATTESTATION_INVALID") } as const;
  }

  return { licence, ctx } as const;
}

export async function activate(input: ActivateInput): Promise<IssuedLicence & { ok: true } | Failure> {
  const checked = await commonChecks(input);
  if ("failure" in checked) return checked.failure;
  const { licence, ctx } = checked;
  const db = await admin();
  const now = new Date();

  // Re-activation of a known device: prove possession of the server-minted secret.
  if (input.deviceSecret) {
    const hash = await sha256Hex(input.deviceSecret);
    const { data: rows } = await db
      .from("license_activations")
      .select("id, device_secret_hash, device_class, revoked_at")
      .eq("license_id", licence.id)
      .is("revoked_at", null);
    const match = (rows ?? []).find(
      (r) => r.device_secret_hash && timingSafeEqual(r.device_secret_hash, hash),
    );
    if (match) {
      if (match.device_class !== input.platform) return fail(409, "DEVICE_CLASS_MISMATCH");
      await db
        .from("license_activations")
        .update({
          last_seen_at: now.toISOString(),
          ip_address: input.ip,
          user_agent: input.userAgent ?? null,
          build_id: String(input.attestation.buildId ?? ""),
          asset_digest: String(input.attestation.assetDigest ?? ""),
          origin_host: input.originHost,
          fingerprint: input.fingerprintSignal ?? null,
          capability_tier: input.capabilityTier ?? null,
        })
        .eq("id", match.id);
      const issued = await issueToken(licence, match.id, input.platform);
      return { ok: true as const, ...issued, deviceId: match.id };
    }
    await recordViolation("device_secret_mismatch", { platform: input.platform }, ctx);
    return fail(403, "DEVICE_UNKNOWN");
  }

  // §4.4 — a released slot stays cold for 12h so a licence can't be round-robined.
  const { data: cooling } = await db
    .from("license_activations")
    .select("release_after")
    .eq("license_id", licence.id)
    .eq("device_class", input.platform)
    .not("release_after", "is", null)
    .gt("release_after", now.toISOString())
    .order("release_after", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (cooling?.release_after) {
    await recordViolation("release_cooldown", { until: cooling.release_after }, ctx);
    return fail(423, "RELEASE_COOLDOWN");
  }

  // §4.3 — the unique partial index is the enforcement; this insert is the check.
  const deviceSecret = randomSecret();
  const { data: created, error } = await db
    .from("license_activations")
    .insert({
      license_id: licence.id,
      device_class: input.platform,
      device_secret_hash: await sha256Hex(deviceSecret),
      fingerprint: input.fingerprintSignal ?? null,
      capability_tier: input.capabilityTier ?? null,
      label: input.label ?? null,
      deployment_domain: input.originHost,
      origin_host: input.originHost,
      build_id: String(input.attestation.buildId ?? ""),
      asset_digest: String(input.attestation.assetDigest ?? ""),
      ip_address: input.ip,
      user_agent: input.userAgent ?? null,
      last_seen_at: now.toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error || !created) {
    // 23505 = the one-live-device-per-class index fired, even under concurrency.
    if ((error as { code?: string } | null)?.code === "23505") {
      await recordViolation("device_limit", { platform: input.platform }, ctx);
      return fail(409, "DEVICE_LIMIT");
    }
    console.error("[licence] activation insert failed", error);
    return fail(500, "ACTIVATION_FAILED");
  }

  const issued = await issueToken(licence, created.id, input.platform);
  return { ok: true as const, ...issued, deviceId: created.id, deviceSecret };
}

/** Heartbeat / refresh. Requires the device secret — no slot allocation here. */
export async function refresh(input: ActivateInput): Promise<IssuedLicence & { ok: true } | Failure> {
  if (!input.deviceSecret) return fail(403, "DEVICE_UNKNOWN");
  const checked = await commonChecks(input);
  if ("failure" in checked) return checked.failure;
  const { licence, ctx } = checked;
  const db = await admin();

  const hash = await sha256Hex(input.deviceSecret);
  const { data: rows } = await db
    .from("license_activations")
    .select("id, device_secret_hash, device_class, revoked_at")
    .eq("license_id", licence.id)
    .is("revoked_at", null);
  const device = (rows ?? []).find(
    (r) => r.device_secret_hash && timingSafeEqual(r.device_secret_hash, hash),
  );
  if (!device) {
    await recordViolation("device_secret_mismatch", { platform: input.platform }, ctx);
    return fail(403, "DEVICE_UNKNOWN");
  }

  await db
    .from("license_activations")
    .update({
      last_seen_at: new Date().toISOString(),
      ip_address: input.ip,
      build_id: String(input.attestation.buildId ?? ""),
      asset_digest: String(input.attestation.assetDigest ?? ""),
      origin_host: input.originHost,
      capability_tier: input.capabilityTier ?? null,
    })
    .eq("id", device.id);

  const issued = await issueToken(licence, device.id, device.device_class as DeviceClass);
  return { ok: true as const, ...issued, deviceId: device.id };
}

/**
 * §4.4 — self-service release. The caller must hold the device secret, so a
 * stranger with only the licence key cannot evict a live device.
 */
export async function releaseDevice(licenceKey: string, deviceSecret: string) {
  const licence = await loadLicence(licenceKey);
  if (!licence) return fail(404, "INVALID_LICENCE");
  const db = await admin();
  const hash = await sha256Hex(deviceSecret);
  const { data: rows } = await db
    .from("license_activations")
    .select("id, device_secret_hash")
    .eq("license_id", licence.id)
    .is("revoked_at", null);
  const device = (rows ?? []).find(
    (r) => r.device_secret_hash && timingSafeEqual(r.device_secret_hash, hash),
  );
  if (!device) return fail(403, "DEVICE_UNKNOWN");

  const now = new Date();
  const releaseAfter = new Date(now.getTime() + RELEASE_COOLDOWN_HOURS * 3600_000);
  await db
    .from("license_activations")
    .update({
      revoked_at: now.toISOString(),
      released_at: now.toISOString(),
      release_after: releaseAfter.toISOString(),
    })
    .eq("id", device.id);
  return { ok: true as const, releaseAfter: releaseAfter.toISOString() };
}

/** Admin override — clears the cooldown immediately (§4.4). */
export async function adminForceRelease(activationId: string) {
  const db = await admin();
  const now = new Date().toISOString();
  await db
    .from("license_activations")
    .update({ revoked_at: now, released_at: now, release_after: null })
    .eq("id", activationId);
  return { ok: true as const };
}

export const __internals = { verifyAttestation, attestationAllows, originAllowed };
