# Vendor Activation Worker

**Deploy this once, on YOUR Cloudflare account. Reuse across all clients.**

This is the external license-activation service that lives independently of any
client's deployment. Its job:

1. Register the first fingerprint per license key (auto-approve + lock).
2. Reject any subsequent fingerprint → log + email vendor.
3. Sign short-lived ES256 JWTs the client apps cache for 14 days offline.
4. Every hour, publish a signed "vendor-alive" heartbeat to the GitHub Pages
   mirror. If the Worker misses 90 days of heartbeats, the mirror auto-issues
   an extended-offline fallback token.

## One-time setup (do this ONCE, before your first client)

### 1. Cloudflare Worker + D1

```bash
cd vendor-worker
bun install
npx wrangler login
npx wrangler d1 create aether-licenses
# copy the database_id into wrangler.toml
npx wrangler d1 execute aether-licenses --file=./schema.sql
```

### 2. Generate ES256 signing key

```bash
node scripts/generate-keypair.mjs
# writes public.jwk and private.jwk
# store private.jwk in your password manager, NEVER commit
# copy public.jwk contents into src/public-key.json (this IS committed;
# clients need it to verify JWTs offline)
```

### 3. Set secrets

```bash
npx wrangler secret put PRIVATE_KEY_JWK    # paste private.jwk contents
npx wrangler secret put GITHUB_PAT         # for the mirror
npx wrangler secret put RESEND_API_KEY     # for duplicate alerts
npx wrangler secret put ALERT_TO_EMAIL     # your own inbox
```

### 4. Deploy

```bash
npx wrangler deploy
```

Note the URL, e.g. `https://aether-activation.yourname.workers.dev`. Give
each client this URL as `VITE_ACTIVATION_URL`.

### 5. GitHub Pages mirror (vendor-unreachable fallback)

Create a public GitHub repo `aether-activation-mirror`, enable Pages on the
`main` branch. The Worker's cron pushes signed heartbeat + fallback tokens
into it on a schedule.

## Per-client operations

### Pre-register a new license

Before shipping the app to a client, insert their license into D1:

```bash
npx wrangler d1 execute aether-licenses --command \
  "INSERT INTO licenses (key, client_name, client_email, plan, max_fingerprints)
   VALUES ('AETH-XXXX-YYYY-ZZZZ-WWWW', 'Client Co', 'ops@client.com', 'pro', 1);"
```

### Clear a fingerprint (legitimate re-activation)

```bash
npx wrangler d1 execute aether-licenses --command \
  "DELETE FROM activations WHERE license_key = 'AETH-XXXX-YYYY-ZZZZ-WWWW';"
```

Their next boot on new infrastructure will auto-approve.

### Revoke a license

```bash
npx wrangler d1 execute aether-licenses --command \
  "UPDATE licenses SET status = 'revoked' WHERE key = 'AETH-XXXX-YYYY-ZZZZ-WWWW';"
```

Takes effect within 14 days on the client (cache TTL).

## Health check

```
GET /health   → 200 OK, JSON { ok: true, ts }
```

Point Better Stack at this.
