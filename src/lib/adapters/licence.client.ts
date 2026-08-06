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
const REFRESH_EVERY_MS = 12 * 60 * 60 * 1000; // 12h
const DEFAULT_GRACE_HOURS = 72;

export interface LicencePayload {
  sub: string;
  device: string;
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

async function callLicenceApi(path: string, body: Record<string, unknown>) {
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
  return json as { token: string; plan: string; features: string[] };
}

async function attest() {
  const { buildAttestation } = await import("./integrity.client");
  return buildAttestation();
}

/** Activate or refresh, returning the current enforcement state. */
export async function ensureLicence(): Promise<LicenceState> {
  if (!isLicenceEnforced()) return { status: "unconfigured", payload: null };

  const cached = localStorage.getItem(STORAGE_TOKEN);
  const cachedPayload = cached ? decode(cached) : null;
  const now = Math.floor(Date.now() / 1000);
  const stillFresh =
    cachedPayload && cachedPayload.exp - now > (24 * 3600 - REFRESH_EVERY_MS / 1000);

  if (cached && stillFresh && (await verifySignature(cached))) {
    localStorage.setItem(STORAGE_LAST_OK, String(Date.now()));
    return { status: "valid", payload: cachedPayload };
  }

  try {
    const fingerprint = await deviceFingerprint();
    const attestation = await attest();
    const result = await callLicenceApi(cached ? "/api/public/licence/refresh" : "/api/public/licence/activate", {
      licenceKey: envVar("VITE_LICENCE_KEY"),
      deviceFingerprint: fingerprint,
      platform: deviceClass(),
      originHost: location.host,
      ...attestation,
    });
    if (!(await verifySignature(result.token))) {
      return { status: "invalid", payload: null, error: "BAD_SIGNATURE" };
    }
    localStorage.setItem(STORAGE_TOKEN, result.token);
    localStorage.setItem(STORAGE_LAST_OK, String(Date.now()));
    return { status: "valid", payload: decode(result.token) };
  } catch (e) {
    // Offline grace: the customer gets `grace` hours before a hard stop.
    const lastOk = Number(localStorage.getItem(STORAGE_LAST_OK) ?? 0);
    const graceMs = (cachedPayload?.grace ?? DEFAULT_GRACE_HOURS) * 3600 * 1000;
    const error = e instanceof Error ? e.message : "licence_unreachable";
    const hardFail = ["DEVICE_LIMIT", "BUILD_TAMPERED", "ORIGIN_NOT_ALLOWED", "LICENCE_SUSPENDED", "LICENCE_REVOKED", "INVALID_LICENCE"];
    if (hardFail.includes(error)) {
      localStorage.removeItem(STORAGE_TOKEN);
      return { status: "invalid", payload: null, error };
    }
    if (cachedPayload && lastOk && Date.now() - lastOk < graceMs) {
      return { status: "grace", payload: cachedPayload, error, graceEndsAt: lastOk + graceMs };
    }
    return { status: "invalid", payload: null, error };
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
