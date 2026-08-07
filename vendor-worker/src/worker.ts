// Vendor-side activation Worker. Deploys to Cloudflare Workers.

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
// NOT part of the client app. See ./README.md.

interface Env {
  DB: D1Database;
  PRIVATE_KEY_JWK: string;
  RESEND_API_KEY?: string;
  ALERT_TO_EMAIL?: string;
  GITHUB_PAT?: string;
}

const JWT_TTL_SEC = 60 * 60 * 24 * 14; // 14 days offline grace

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

async function signJwt(payload: object, privateKeyJwk: JsonWebKey) {
  const key = await crypto.subtle.importKey(
    "jwk",
    privateKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const header = { alg: "ES256", typ: "JWT" };
  const enc = (s: string) => btoa(s).replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  const h = enc(JSON.stringify(header));
  const p = enc(JSON.stringify(payload));
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, data));
  const s = enc(String.fromCharCode(...sig));
  return `${h}.${p}.${s}`;
}

async function handleActivate(req: Request, env: Env) {
  const body = (await req.json()) as {
    license_key?: string;
    fingerprint?: string;
    deployment_domain?: string;
  };
  if (!body.license_key || !body.fingerprint) return json({ ok: false, error: "bad_request" }, 400);

  const ip = req.headers.get("cf-connecting-ip") ?? "unknown";
  const ua = req.headers.get("user-agent") ?? null;

  const lic = await env.DB.prepare("SELECT * FROM licenses WHERE key = ?")
    .bind(body.license_key)
    .first<any>();

  if (!lic) return json({ ok: false, error: "invalid_license" }, 404);
  if (lic.status !== "active") return json({ ok: false, error: `license_${lic.status}` }, 403);
  if (lic.expires_at && lic.expires_at < Math.floor(Date.now() / 1000))
    return json({ ok: false, error: "license_expired" }, 403);

  const existing = await env.DB.prepare(
    "SELECT * FROM activations WHERE license_key = ? AND fingerprint = ?",
  )
    .bind(body.license_key, body.fingerprint)
    .first<any>();

  if (!existing) {
    const count = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM activations WHERE license_key = ?",
    )
      .bind(body.license_key)
      .first<any>();

    if ((count?.c ?? 0) >= lic.max_fingerprints) {
      await env.DB.prepare(
        "INSERT INTO rejections (license_key, attempted_fingerprint, attempted_domain, ip) VALUES (?, ?, ?, ?)",
      )
        .bind(body.license_key, body.fingerprint, body.deployment_domain ?? null, ip)
        .run();
      // Fire-and-forget email
      if (env.RESEND_API_KEY && env.ALERT_TO_EMAIL) {
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${env.RESEND_API_KEY}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from: "Aether Activation <onboarding@resend.dev>",
            to: [env.ALERT_TO_EMAIL],
            subject: `⚠️ Duplicate license activation — ${body.license_key}`,
            html: `<p>License <b>${esc(body.license_key)}</b> (${esc(lic.client_name)}) attempted from a new fingerprint.</p>
                   <p>Domain: ${esc(body.deployment_domain ?? "unknown")}<br/>IP: ${esc(ip)}<br/>Fingerprint: <code>${esc(body.fingerprint)}</code></p>`,
          }),
        }).catch(() => {});
      }
      return json({ ok: false, error: "fingerprint_locked" }, 403);
    }
    await env.DB.prepare(
      "INSERT INTO activations (license_key, fingerprint, deployment_domain, ip, user_agent) VALUES (?, ?, ?, ?, ?)",
    )
      .bind(body.license_key, body.fingerprint, body.deployment_domain ?? null, ip, ua)
      .run();
  } else {
    await env.DB.prepare(
      "UPDATE activations SET last_seen_at = unixepoch(), ip = ?, user_agent = ? WHERE id = ?",
    )
      .bind(ip, ua, existing.id)
      .run();
  }

  const privateKey = JSON.parse(env.PRIVATE_KEY_JWK) as JsonWebKey;
  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt(
    {
      sub: body.license_key,
      fp: body.fingerprint,
      plan: lic.plan,
      iat: now,
      exp: now + JWT_TTL_SEC,
    },
    privateKey,
  );

  return json({ ok: true, token, plan: lic.plan, ttl: JWT_TTL_SEC });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return json({ ok: true });
    if (url.pathname === "/health") return json({ ok: true, ts: Date.now() });
    if (url.pathname === "/activate" && req.method === "POST") {
      try {
        return await handleActivate(req, env);
      } catch (e) {
        return json({ ok: false, error: e instanceof Error ? e.message : "error" }, 500);
      }
    }
    return json({ ok: false, error: "not_found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Publish a hourly heartbeat to the GitHub Pages mirror.
    if (!env.GITHUB_PAT) return;
    const privateKey = JSON.parse(env.PRIVATE_KEY_JWK) as JsonWebKey;
    const now = Math.floor(Date.now() / 1000);
    const heartbeat = await signJwt(
      { type: "heartbeat", iat: now, exp: now + 60 * 60 * 24 * 100 },
      privateKey,
    );
    // Push to gh-mirror repo — implementation left to vendor to wire up
    // (see README.md for the mirror repo layout).
    console.log("heartbeat", heartbeat.slice(0, 40));
  },
};
