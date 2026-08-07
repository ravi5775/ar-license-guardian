# Branching & deployment — 3 branches, 1 codebase

| | `main` (admin · edge/$0) | `self-hosted` (admin · private server) | `client-app` (shipped to customers) |
|---|---|---|---|
| Who runs it | You | You / on-prem enterprise | Customer |
| Contains | AR app + licence server + admin dashboard | same | AR app + licence **client** only |
| Runtime | Cloudflare Workers | Node/Bun in Docker | CF Pages / Vercel / Node |
| DB | Neon | Postgres 16 container | none (stateless) |
| Media | R2 (your bucket) | R2 | R2 via their own account (model A) |
| Secrets held | master R2 key, `LICENCE_PRIVATE_KEY_JWK` | same | licence key + Ed25519 **public** key only |

## Merge direction — strictly one-way

```text
main ──> self-hosted
  └────> client-app
```

Nothing merges back. Features land on `main` only. `client-app` is `main` minus
`src/routes/_authenticated/**`, `src/routes/api/public/licence/**`,
`src/lib/adapters/db.server.ts` and `src/lib/adapters/licence.server.ts` —
deletions only, so merges stay trivial (`scripts/strip-client-app.sh`).

**Critical:** the licence issuer must never exist on `client-app`. If the
customer hosts the validator, they own the validator and every control is theatre.

## Keep the diff in files that never change

Per-branch differences are confined to:

- `vite.config.ts`
- `wrangler.toml` (main) / `deploy/self-hosted/docker-compose.yml`
- the four adapter modules' **env vars** — not their code

If a branch-specific change ever touches a component, that is a mistake.

## The four adapters

| Module | Interface | main | self-hosted | client-app |
|---|---|---|---|---|
| `src/lib/adapters/db.server.ts` | `sql/queryOne/queryMany` | Neon HTTP | `pg` pool | absent |
| `src/lib/adapters/storage.server.ts` | `put/get/presign` | R2 (SigV4, Web Crypto) | identical | identical, customer's R2 |
| `src/lib/adapters/ratelimit.server.ts` | `check(key, limit, window)` | Upstash HTTP | Redis container | memory |
| `src/lib/adapters/licence.server.ts` | `activate/refresh/releaseDevice` | issuer | issuer | **absent** → `licence-runtime.ts` |

Storage uses a hand-rolled SigV4 signer on Web Crypto — no SDK, no native
modules, byte-identical on Workers and Node.

## Rules that keep the branches from forking

- **Neon vs Postgres 16 drift.** Plain SQL migrations only. No extension that
  one has and the other doesn't. Test every migration against both.
- **No server-side ffmpeg.** Tempting on self-hosted; it forks the branches.
  Transcoding stays client-side (`ffmpeg.wasm`).
- **Stateless JWTs only.** No in-memory or server-side session store — the edge
  branch has no such state and it wouldn't port.
- **Backups on both.** Same `pg_dump → R2` cron script, different
  `DATABASE_URL`. Neon PITR is paid-tier only; don't rely on it.
- **R2 credentials on client hardware.** Model A (their own R2 account) is
  preferred: their free 10 GB, $0 egress, you never hold their media. If you use
  model B, issue one token per client scoped to `bucket=media` and
  `prefix=clients/{clientId}/` — never the account-level key.
- **The R2 secret never reaches the browser.** browser → their server route →
  presigned PUT → direct to R2.

## CI

- `main` → Wrangler deploy (`.github/workflows/deploy-main.yml`)
- `self-hosted` → Docker image to GHCR (`deploy-self-hosted.yml`); Coolify pulls
  on push, so a client deploy is one webhook
- `client-app` → build + sign asset manifest + publish, and POST the signed
  manifest to the admin server so heartbeats can be validated
  (`release-client-app.yml`)

Add `staging` off `main` later if you want a free preview environment.
