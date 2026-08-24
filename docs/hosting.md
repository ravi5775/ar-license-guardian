# Aether AR — Hosting Guide

How to host the **admin platform** and the **client app** on separate branches,
what each costs, and the exact steps for Cloudflare Pages + R2.

---

## 1. What gets hosted where

| Branch | What it is | Who runs it | Where it lives | DB | Storage |
|---|---|---|---|---|---|
| `main` | Admin platform + licence issuer + AR app | You | Cloudflare Workers/Pages | Supabase (or Neon) | Your R2 bucket |
| `self-hosted` | Same as `main`, containerised | You or an on-prem enterprise client | Docker on a VPS (Hetzner/Coolify) | Postgres 16 container | R2 |
| `client-app` | AR app + licence **client** only | The customer | Cloudflare Pages (their account) | none (stateless) | Their own R2 |

The licence **issuer** must never exist on `client-app`. If the customer hosts
the validator, every control is theatre. `scripts/strip-client-app.sh` performs
the deletions; merges are strictly one-way (`main → self-hosted`, `main → client-app`).

---

## 2. Initial Admin Bootstrap

Platform administrators are provisioned using a secure CLI script, never through committed files or static environment variables:

```bash
# Run on the admin deployment (main or self-hosted):
SUPABASE_URL=https://<project>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
node scripts/bootstrap-admin.mjs --email=admin@your-domain.com
```

Rules:

1. The script is **idempotent**: it verifies no admin exists before creating one, preventing unauthorized elevation.
2. It generates a **32-character cryptographically random password** and prints it **once** to stdout.
3. On first login, the admin is forced to change their password and complete TOTP enrolment.
4. Never store the generated password in `.env` or any repository file.
5. If you lose access, follow `docs/break-glass.md`.

Every subsequent account created by signup is given `viewer` role with `pending` status and requires **manual admin approval** (`/dashboard/approvals`). Nobody self-promotes: role writes are blocked by RLS and database triggers.

---

## 3. Cloudflare Pages — step by step

Pages' free tier permits commercial use (Vercel Hobby does not). Use it for both
your admin site and each client deployment.

### 3.1 Create the project

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the repo, then pick the branch:
   - admin site → `main`
   - a client deployment → `client-app`
3. Build settings:
   - Build command: `bun run build`
   - Output directory: `dist`
   - Node/Bun: leave default (the repo pins Bun via `bunfig.toml`)

### 3.2 Environment variables (Settings → Environment variables)

Admin site (`main`):

```
RUNTIME=edge
DB_DRIVER=neon              # or supabase-backed postgres
RATELIMIT_DRIVER=upstash
LICENCE_ROLE=issuer
DATABASE_URL=...
R2_ACCOUNT_ID=...           R2_BUCKET=media
R2_ACCESS_KEY_ID=...        R2_SECRET=...
R2_PUBLIC_BASE_URL=https://media.your-domain.com
LICENCE_PRIVATE_KEY_JWK=... RELEASE_MANIFEST_SECRET=...
RESEND_API_KEY=...          ALERT_TO_EMAIL=...
STORAGE_ALERTS_CRON_SECRET=...
```

Client deployment (`client-app`):

```
RUNTIME=edge
DB_DRIVER=none
RATELIMIT_DRIVER=memory
LICENCE_ROLE=client
VITE_LICENCE_API_URL=https://api.your-domain.com
VITE_LICENCE_KEY=<per-client key you issue>
VITE_LICENCE_PUBLIC_KEY=<Ed25519 public key — public by design>
VITE_BUILD_ID=<set by CI>
```

Mark every non-`VITE_` value as **encrypted**. `VITE_`-prefixed values ship to the
browser — never put a secret behind that prefix.

### 3.3 Domains

- `your-domain.com` → admin Pages project (Custom domains → Set up a domain)
- `api.your-domain.com` → licence Worker (`vendor-worker/`, `bunx wrangler deploy`)
- `media.your-domain.com` → R2 public bucket binding (section 4)
- Client instances get their own domain in **their** Cloudflare account.

Enable Cloudflare **Bot Fight Mode** and a rate-limiting rule on
`/api/public/licence/*` (e.g. 10 req/min/IP).

---

## 4. R2 storage

### 4.1 Bucket

1. Cloudflare → **R2** → **Create bucket** → `aether-media`.
2. Keep it **private**. Public listing of client photos is a data-protection incident.
3. Settings → **CORS policy**, allow only your origins:

```json
[{ "AllowedOrigins": ["https://your-domain.com"],
   "AllowedMethods": ["GET", "PUT"],
   "AllowedHeaders": ["*"],
   "MaxAgeSeconds": 3600 }]
```

4. Lifecycle rule: expire `tmp/` after 1 day, keep `backups/` 30 days.

### 4.2 Credentials

R2 → **Manage API tokens** → Create token.

- Admin instance: scoped to `aether-media`, Object Read & Write.
- Client instance (model B, if you host their media): one token per client, scoped
  to `bucket=media` **and** `prefix=clients/{clientId}/`. Never the account key.
- Preferred is **model A**: the client uses their own R2 account. Their free 10 GB,
  $0 egress, and you never hold their media — which also removes you from most of
  the data-protection surface.

### 4.3 Upload path

The R2 secret never reaches a browser:

```
browser → your server route → presigned PUT → direct to R2
```

Downloads of restricted media go through the one-time nonce route
(`/api/public/m/$nonce`), not long-lived signed URLs.

### 4.4 Public media domain

R2 bucket → **Settings** → **Public access** → Connect a custom domain →
`media.your-domain.com`. Use this **only** for non-sensitive assets (marketing
images, vendored AR runtime). Client photos stay private.

---

## 5. Self-hosted branch (VPS)

For clients who insist on their own server, or your own private instance.

```sh
git checkout self-hosted
cp deploy/self-hosted/.env.example.selfhosted .env   # fill it in
docker compose -f deploy/self-hosted/docker-compose.yml up -d
```

- Image is published to GHCR by `.github/workflows/deploy-self-hosted.yml`.
- Coolify pulls on push, so a client deploy is one webhook.
- Nginx config and TLS: `deploy/self-hosted/nginx.conf` + Let's Encrypt.
- Postgres 16 container with a nightly `pg_dump → R2` job (`scripts/backup-to-r2.sh`)
  and 14-day local retention.
- Recommended box: Hetzner CX22 (2 vCPU / 4 GB, ~€4/mo) — comfortable for a single
  client's traffic.

---

## 6. Hosting plans and cost

Prices are indicative monthly figures.

### Plan A — Zero-cost start (your admin instance, pre-revenue)

| Component | Service | Tier | Cost |
|---|---|---|---|
| Frontend + SSR | Cloudflare Pages/Workers | Free (commercial OK) | ₹0 |
| Database | Supabase | Free | ₹0 |
| Storage | Cloudflare R2 | Free 10 GB, $0 egress | ₹0 |
| Licence issuer | Cloudflare Worker + D1 | Free | ₹0 |
| Email | Resend | Free 3k/mo | ₹0 |
| Rate limiting | Upstash Redis | Free 10k cmd/day | ₹0 |

Caveat: Supabase Free pauses after 7 days of inactivity and has no PITR. Fine for
demos, not for a paying client's production data.

### Plan B — Production admin (recommended once you have clients)

| Component | Tier | Cost |
|---|---|---|
| Cloudflare Pages/Workers | Free → Workers Paid $5 if you exceed limits | ~₹0–450 |
| Supabase Pro | daily backups, no pausing | $25 (~₹2,200) |
| R2 | ~50 GB stored | ~$0.75 (~₹70) |
| Resend | Free tier usually enough | ₹0 |
| Domain | .com annual | ~₹1,000/yr |

**≈ ₹2,300–2,800/month** all-in. At ₹30,000 per client one-time, one client covers
roughly a year of platform hosting.

### Plan C — Per-client deployment (client pays)

| Component | Tier | Client's cost |
|---|---|---|
| Cloudflare Pages | Free | ₹0 |
| R2 (their account) | Free 10 GB | ₹0 |
| Domain | theirs | ~₹1,000/yr |

Effectively ₹0/month for the client at typical album volume. This is the model to
sell: one-time ₹30,000 setup, zero recurring infrastructure, they own their data.

### Plan D — Enterprise self-hosted

| Component | Cost |
|---|---|
| Hetzner CX22 VPS | ~€4 (~₹380) |
| Backups to R2 | ~₹50 |
| Managed updates (you) | your AMC rate |

---

## 7. Deployment checklist

Before handing an instance to a client:

- [ ] Branch is `client-app`; `scripts/strip-client-app.sh` has run and the issuer
      routes are absent
- [ ] `LICENCE_ROLE=client`, `DB_DRIVER=none`
- [ ] Platform admin provisioned via `scripts/bootstrap-admin.mjs`, MFA enrolled
- [ ] No hardcoded admin credentials in environment files
- [ ] Licence key issued and bound (one mobile + one desktop activation)
- [ ] Signed release manifest POSTed to the admin server so heartbeats validate
- [ ] R2 bucket private, CORS locked to their domain
- [ ] Custom domain + TLS live, Bot Fight Mode on
- [ ] Backup cron verified by a real restore, not just a green log line
- [ ] `HANDOVER.md`, `LICENSE_AGREEMENT.md`, `DPA.md` signed and delivered

Related reading: `docs/branching.md`, `docs/licence-enforcement.md`,
`docs/anti-resale.md`, `docs/disaster-recovery.md`, `docs/break-glass.md`.
