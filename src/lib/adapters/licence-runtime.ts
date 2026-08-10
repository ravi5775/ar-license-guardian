/**
 * Licence adapter — CLIENT side. This is the ONLY licence module that exists on
 * the `client-app` branch. It can verify and refresh; it can never issue.
 *
 * Configuration a customer touches:
 *   VITE_LICENCE_API_URL      your admin server
 *   VITE_LICENCE_KEY          the key you sold them
 *   VITE_LICENCE_PUBLIC_KEY   Ed25519 public JWK, baked at build time
 */
const STORAGE_TOKEN = "aether.licence.token";
const STORAGE_INSTALL = "aether.install.uuid";
const STORAGE_LAST_OK = "aether.licence.lastOk";
/** Server-minted device identity. The fingerprint is only a support signal. */
const STORAGE_DEVICE_SECRET = "aether.licence.deviceSecret";
const REFRESH_EVERY_MS = 12 * 60 * 60 * 1000; // 12h
const DEFAULT_GRACE_HOURS = 72;

export interface LicencePayload {
  sub: string;
  dep?: string;
  did?: string;
  jti?: string;
  device?: string;
  platform: "mobile" | "desktop";
  plan: string;
  features: string[];
  grace?: number;
  iat: number;
  exp: number;
}

export interface LicenceState {
  status: "valid" | "grace" | "invalid" | "unconfigured";
  payload: LicencePayload | null;
  error?: string;
  graceEndsAt?: number;
}

function envVar(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name];
}

export function isLicenceEnforced() {
  return Boolean(envVar("VITE_LICENCE_API_URL") && envVar("VITE_LICENCE_KEY"));
}

export function deviceClass(): "mobile" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ? "mobile" : "desktop";
}

function installUuid() {
  let id = localStorage.getItem(STORAGE_INSTALL);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_INSTALL, id);
  }
  return id;
}

async function sha256Hex(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Fingerprints are spoofable — treat them as friction, not proof. The real
 * teeth are that assets only presign against a valid server-side licence.
 */
export async function deviceFingerprint() {
  const parts = [
    navigator.userAgent,
    navigator.language,
    String(screen.width),
    String(screen.height),
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? 0),
    installUuid(),
  ];
  return sha256Hex(parts.join("|"));
}

function decode(token: string): LicencePayload | null {
  try {
    const body = token.split(".")[1];
    if (!body) return null;
    const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as LicencePayload;
  } catch {
    return null;
  }
}

function b64ToBytes(b64: string) {
  const bin = atob(b64.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifySignature(token: string): Promise<boolean> {
  const jwkRaw = envVar("VITE_LICENCE_PUBLIC_KEY");
  if (!jwkRaw) return false;
  const [header, body, sig] = token.split(".");
  if (!header || !body || !sig) return false;
  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      JSON.parse(jwkRaw) as JsonWebKey,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return crypto.subtle.verify(
      "Ed25519",
      key,
      b64ToBytes(sig),
      new TextEncoder().encode(`${header}.${body}`),
    );
  } catch {
    return false;
  }
}

interface LicenceApiResult {
  token: string;
  plan: string;
  features: string[];
  graceHours?: number;
  deviceId?: string;
  deviceSecret?: string;
}

async function callLicenceApi(
  path: string,
  body: Record<string, unknown>,
): Promise<LicenceApiResult> {
  const base = envVar("VITE_LICENCE_API_URL")!.replace(/\/+$/, "");
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json["ok"] !== true) {
    throw new Error(String(json["error"] ?? `licence_api_${res.status}`));
  }
  return json as unknown as LicenceApiResult;
}

async function attest() {
  const { buildAttestation } = await import("./integrity-runtime");
  return buildAttestation();
}

function deviceSecret() {
  return localStorage.getItem(STORAGE_DEVICE_SECRET);
}

/** Rough capability hint so the AR runtime can pick a perf tier server-side. */
function capabilityTier(): string {
  const cores = navigator.hardwareConcurrency ?? 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
  if (cores <= 4 || mem <= 3) return "lite";
  if (cores >= 8 && mem >= 8) return "high";
  return "standard";
}

/** Activate or refresh, returning the current enforcement state. */
export async function ensureLicence(): Promise<LicenceState> {
  if (!isLicenceEnforced()) return { status: "unconfigured", payload: null };

  const cached = localStorage.getItem(STORAGE_TOKEN);
  const cachedPayload = cached ? decode(cached) : null;
  const now = Math.floor(Date.now() / 1000);
  const stillFresh =
    cachedPayload && cachedPayload.exp - now > 24 * 3600 - REFRESH_EVERY_MS / 1000;

  if (cached && stillFresh && (await verifySignature(cached))) {
    localStorage.setItem(STORAGE_LAST_OK, String(Date.now()));
    return { status: "valid", payload: cachedPayload };
  }

  const secret = deviceSecret();
  try {
    const attestation = await attest();
    // Refresh only once the server has minted a device identity for us.
    const path = secret
      ? "/api/public/licence/refresh"
      : "/api/public/licence/activate";
    const result = await callLicenceApi(path, {
      licenceKey: envVar("VITE_LICENCE_KEY"),
      platform: deviceClass(),
      deviceFingerprint: await deviceFingerprint(),
      capabilityTier: capabilityTier(),
      ...(secret ? { deviceSecret: secret } : {}),
      ...attestation,
    });
    if (!(await verifySignature(result.token))) {
      return { status: "invalid", payload: null, error: "BAD_SIGNATURE" };
    }
    if (result.deviceSecret) {
      localStorage.setItem(STORAGE_DEVICE_SECRET, result.deviceSecret);
    }
    localStorage.setItem(STORAGE_TOKEN, result.token);
    localStorage.setItem(STORAGE_LAST_OK, String(Date.now()));
    return { status: "valid", payload: decode(result.token) };
  } catch (e) {
    const error = e instanceof Error ? e.message : "licence_unreachable";
    const hardFail = [
      "DEVICE_LIMIT",
      "DEVICE_UNKNOWN",
      "DEVICE_CLASS_MISMATCH",
      "ATTESTATION_INVALID",
      "ORIGIN_NOT_ALLOWED",
      "LICENCE_SUSPENDED",
      "LICENCE_REVOKED",
      "LICENCE_EXPIRED",
      "INVALID_LICENCE",
    ];
    if (hardFail.includes(error)) {
      localStorage.removeItem(STORAGE_TOKEN);
      return { status: "invalid", payload: null, error };
    }

    // Offline grace is anchored to the SIGNED token's `iat`, not to a local
    // "last ok" timestamp — otherwise the customer extends their own grace
    // window just by rewriting localStorage.
    if (cachedPayload && (await verifySignature(cached!))) {
      const graceHours = cachedPayload.grace ?? DEFAULT_GRACE_HOURS;
      const graceEndsAt = (cachedPayload.iat + graceHours * 3600) * 1000;
      if (Date.now() < graceEndsAt) {
        return { status: "grace", payload: cachedPayload, error, graceEndsAt };
      }
    }
    return { status: "invalid", payload: null, error };
  }
}

/** Hand the device slot back so another machine can activate (§4.4). */
export async function releaseThisDevice() {
  const secret = deviceSecret();
  if (!secret) return { ok: false, error: "NO_DEVICE" as const };
  try {
    const base = envVar("VITE_LICENCE_API_URL")!.replace(/\/+$/, "");
    const res = await fetch(`${base}/api/public/licence/release`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ licenceKey: envVar("VITE_LICENCE_KEY"), deviceSecret: secret }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok || json["ok"] !== true) {
      return { ok: false as const, error: String(json["error"] ?? `licence_api_${res.status}`) };
    }
    localStorage.removeItem(STORAGE_DEVICE_SECRET);
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_LAST_OK);
    return { ok: true as const, releaseAfter: String(json["releaseAfter"] ?? "") };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "release_failed" };
  }
}

/** Background refresh loop — call once from the app root. */
export function startLicenceHeartbeat() {
  if (!isLicenceEnforced()) return () => {};
  void ensureLicence();
  const id = setInterval(() => void ensureLicence(), REFRESH_EVERY_MS);
  return () => clearInterval(id);
}

export function currentToken() {
  return localStorage.getItem(STORAGE_TOKEN);
}

