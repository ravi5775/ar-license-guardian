# Aether AR — API Reference (existing endpoints)

Everything the platform exposes today, in two layers:

1. **Public HTTP routes** (`src/routes/api/public/*`) — stable URLs, callable by
   external clients, CI, cron and customer deployments. These are the only ones
   you need to keep byte-stable when migrating hosting.
2. **Server functions** (`createServerFn` in `src/lib/*.functions.ts`) — typed
   RPC used by the dashboard only. They are served over an internal
   `/_serverFn/...` transport that TanStack Start generates; treat them as
   internal API, not as a contract.

Base URLs:

| Deployment | Base |
|---|---|
| Local dev | `http://localhost:8080` |
| Preview | `https://project--<id>-dev.lovable.app` |
| Production (Cloudflare Pages) | `https://<your-domain>` |

---

## 1. Public HTTP API

All licence routes send CORS headers derived from the request origin
(`src/lib/licence-http.ts`), respond `application/json`, and use
`{ ok: boolean, ... }` bodies. Errors are `{ ok: false, error: "CODE" }`.

### 1.1 `POST /api/public/licence/activate`
Binds a device slot to a licence key and returns a signed licence token.
Also handles `OPTIONS` (preflight).

```jsonc
{
  "licenceKey": "string (10-200)",
  "platform": "mobile" | "desktop",
  "buildId": "string?",            // build fingerprint baked by CI
  "assetDigest": "string?",        // hash of shipped assets
  "deviceFingerprint": "string?",  // support signal only, not identity
  "deviceSecret": "string?",       // omit on first activation; server mints it
  "capabilityTier": "string?",
  "label": "string?"
}
```

- Origin is **server-derived from headers**, never from the body.
- Rate limits (fail **closed**): 10/min per IP, 20/hour per licence key.
- Errors: `BAD_REQUEST` (400), `RATE_LIMITED` / `RATE_LIMITER_DOWN` (429),
  plus licence errors from the issuer (`INVALID_KEY`, `SLOT_LIMIT`,
  `ORIGIN_NOT_ALLOWED`, `REVOKED`, ...).

### 1.2 `POST /api/public/licence/refresh`
Heartbeat. Re-issues the short-lived token; drives the offline grace window.
Also handles `OPTIONS`.

```jsonc
{
  "licenceKey": "string",
  "platform": "mobile" | "desktop",
  "deviceSecret": "string (16-200)",   // required here
  "buildId": "string?",
  "assetDigest": "string?",
  "deviceFingerprint": "string?",
  "capabilityTier": "string?"
}
```

Response: `{ ok, token, plan, features, expiresIn, graceHours, deviceId, limiterDegraded }`.
Rate limit: 60/hour per device secret, fail **open** (a limiter outage must not
black out live viewers) — the response reports `limiterDegraded: true`.

### 1.3 `POST /api/public/licence/release`
Self-service device release; frees the slot after a 12h cooldown. Requires the
device secret, so a licence key alone cannot evict someone else's device.

```jsonc
{ "licenceKey": "string", "deviceSecret": "string (16-200)" }
```

Response: `{ ok: true, releaseAfter }`. Rate limit 5/hour per IP, fail closed.

### 1.4 `GET /api/public/licence/status`
Read-only diagnostics for the customer. Key via `?key=` or `x-licence-key`
header. Returns plan, expiry, status and active slot count — no IDs or keys.
Rate limit 30/min, fail open. `MISSING_LICENCE_KEY` → 400.

### 1.5 `POST` / `GET /api/public/licence/manifest`
**POST** — CI on the `client-app` branch posts the signed release manifest after
a build, so heartbeats from that release validate.

```jsonc
{
  "buildId": "string",
  "customerId": "string?",       // default "universal"
  "assetDigest": "string",
  "releaseHash": "string?",
  "signature": "string",         // Ed25519 over buildId|customerId|releaseHash
  "files": [{ "path": "...", "hash": "..." }],
  "branch": "client-app"
}
```

Auth: shared secret `RELEASE_MANIFEST_SECRET` **and** Ed25519 signature
verification against `LICENCE_PUBLIC_KEY_JWK`.

**GET** — `?buildId=<id>&customerId=<id|universal>`. Unauthenticated read-only
verification so a client can compare the manifest it is running against the one
the vendor published. Returns
`{ ok, manifest: { buildId, customerId, assetDigest, signature, files, branch, publishedAt } }`,
`404 NOT_FOUND` when unknown, `400 BAD_REQUEST` on a malformed `buildId`.
Rate limit 30/min, fail open. No secrets are returned.

### 1.6 `POST /api/public/hooks/storage-alerts`
Nightly cron. Auth via `x-cron-secret` or `Authorization: Bearer <secret>`
compared constant-time against `STORAGE_ALERTS_CRON_SECRET`. Rate limit 10/min,
fail closed. At ≥80% of quota it stamps `profiles.storage_alert_sent_at` and
writes an `audit_log` row with action `storage.quota_warning` (metadata:
`used_bytes`, `quota_bytes`, `percent`); when usage drops back under 80% the
stamp is cleared so the next crossing alerts again. Returns
`{ ok: true, notified, cleared }`.

### 1.7 `GET /api/public/m/$nonce`
One-time nonce redemption for restricted media. Redirects to a short-lived
signed R2 URL, then burns the nonce. This is the only download path for private
media — no long-lived signed URLs are handed out.

### 1.8 `ALL /api/public/license/activate` *(deprecated)*
American-spelling legacy path. Every method returns **410 Gone**. Keep it
deployed so old clients get a clear error rather than a 404.

### 1.9 `GET /sitemap.xml`
Not under `/api/`, but a public server route (`src/routes/sitemap[.]xml.ts`).
Serves a **static** list of marketing/landing routes (`/`, use-case pages,
`/gallery`) against `BASE_URL`, cached one hour. It does **not** enumerate
published experiences or albums — those are intentionally excluded so private
or PIN-gated slugs never leak into search indexes.

---

## 2. Internal server functions (dashboard RPC)

Auth model: `requireSupabaseAuth` = signed-in user, RLS applies as that user.
Unmarked = public (no bearer required).

| Module | Function | Method | Auth |
|---|---|---|---|
| `session.functions.ts` | `getSessionContext` | GET | auth |
| `deployment.functions.ts` | `getDeploymentProfile` | GET | public |
| `access.functions.ts` | `submitAccessPin` | POST | public |
| | `getShareCredentials`, `setAccessMode`, `regeneratePin` | POST | auth |
| `admin.functions.ts` | `assertAdmin`, `getBandwidthUsageSummary` | GET | auth (admin) |
| `albums.functions.ts` | `listMyAlbums` | GET | auth |
| | `createAlbum`, `deleteAlbum`, `setAlbumGalleryVisibility`, `setAlbumPublished` | POST | auth |
| | `getPublicAlbum`, `listPublicAlbums` | GET | public |
| `experiences.functions.ts` | `listMyExperiences`, `getMyRoles` | GET | auth |
| | `createExperience`, `updateExperience`, `deleteExperience` | POST | auth |
| | `signMediaUpload` | POST | auth + upload rate limit |
| | `enforceMediaSize`, `signMyExperienceAssets` | POST | auth |
| | `getPublicExperience` | GET | public |
| `gallery.functions.ts` | `listPublicExperiences` | GET | public |
| `projects.functions.ts` | `listProjects` | GET | auth |
| | `createProject`, `renameProject`, `deleteProject`, `assignToProject` | POST | auth |
| `licenses.functions.ts` | `listLicenses`, `listActivations`, `listAuditLog` | GET | auth (admin) |
| | `createLicense`, `revokeActivation`, `setLicenseStatus`, `forceReleaseActivation` | POST | auth (admin, step-up) |
| `approvals.functions.ts` | `listAccounts`, `getMyAccount` | GET | auth |
| | `decideAccount` | POST | auth (admin) |
| `analytics.functions.ts` | `logScanEvent` | POST | public (IP + session rate limited) |
| | `getAnalytics` | GET | auth |
| `diagnostics.functions.ts` | `logGateEvent` | POST | public (rate limited) |
| | `listGateEvents`, `listDeviceTelemetry` | GET | auth (admin) |
| `marker-tests.functions.ts` | `listMarkerTests` | GET | auth |
| | `recordMarkerTest`, `deleteMarkerTest` | POST | auth |

---

## 3. What each endpoint needs at runtime

| Endpoint group | Required env |
|---|---|
| licence activate / refresh / release / status | `DATABASE_URL` or Supabase vars, `LICENCE_ROLE=issuer`, `LICENCE_PRIVATE_KEY_JWK`, `RATELIMIT_DRIVER` + Upstash/Redis vars |
| licence manifest | `RELEASE_MANIFEST_SECRET`, `LICENCE_PUBLIC_KEY_JWK` |
| storage-alerts hook | `STORAGE_ALERTS_CRON_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`, service role |
| `/api/public/m/$nonce`, uploads | `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET`, optional `R2_PUBLIC_BASE_URL` |
| dashboard RPC | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

Client-app deployments (`LICENCE_ROLE=client`, `DB_DRIVER=none`) must ship
**none** of the licence issuer routes — `scripts/strip-client-app.sh` removes
them and `scripts/verify-client-branch.mjs` fails CI if any survive.

---

## 4. Smoke-testing after a Cloudflare migration

```bash
BASE=https://your-domain.com

curl -s "$BASE/api/public/licence/status?key=$LICENCE_KEY" | jq
curl -s -X POST "$BASE/api/public/licence/activate" \
  -H 'content-type: application/json' \
  -d '{"licenceKey":"'"$LICENCE_KEY"'","platform":"desktop"}' | jq
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/public/license/activate"  # expect 410
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$BASE/api/public/hooks/storage-alerts" # expect 401
```

`scripts/post-deploy-smoke.mjs` and `scripts/audit-live-endpoints.mjs` automate
this against a live base URL.
