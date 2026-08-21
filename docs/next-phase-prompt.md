# Next-phase hardening prompt (copy-paste into the AI)

Use this verbatim. It assumes the current repo state: TanStack Start on Cloudflare,
Supabase-backed Lovable Cloud, adapter layer under `src/lib/adapters/`, three
branches (`main`, `self-hosted`, `client-app`).

---

## Guardrails (apply to every task below)

- Do not weaken RLS, do not add `anon` SELECT policies, do not remove the approval gate.
- Do not add `supabase.from(...)` to `src/routes/**` or `src/components/**`; use a
  server function in `src/lib/*.functions.ts`.
- Every new `public` table needs `GRANT` + `ENABLE ROW LEVEL SECURITY` + policies in
  the same migration.
- Never log, echo, or return service-role keys, licence private keys, or device secrets.
- Keep `scripts/strip-client-app.sh` valid: nothing the client branch needs may live in
  a file that script deletes.
- After each numbered task: run typecheck + lint, then stop and report what changed and
  what you could not verify.

## 1. Prove disaster recovery, do not just document it

Write `scripts/verify-restore.sh` that restores the newest R2 backup into a scratch
Postgres, runs a row-count and RLS-policy diff against production schema, and exits
non-zero on drift. Add a weekly `.github/workflows/dr-verify.yml` that runs it and
opens an issue on failure. Update `docs/disaster-recovery.md` with the real, measured
RTO/RPO produced by one actual run.

## 2. Close the licence-enforcement gaps

- Add a server-side kill-switch check: every 24h token issue must re-read `licenses.status`
  (already done) *and* refuse issuance when `release_manifests` has no signed row for the
  reported `buildId` — today an unknown build is a violation but the customer can keep
  running on a cached token for 72h. Add a `revoked_builds` table and make the grace window
  collapse to 0 for a revoked build.
- Add `GET /api/public/licence/status` returning non-sensitive state (plan, expiry, device
  slots used) so a client can self-diagnose without contacting support.
- Add a Vitest suite `tests/licence.test.ts` covering: missing attestation, digest mismatch,
  device-limit race (two concurrent activations), release cooldown, and secret mismatch.

## 3. Bandwidth and cost caps (currently only storage is capped)

Add per-project monthly egress accounting on presign issuance (`presign-gate.server.ts`),
a `project_usage` table with a monthly rollup, a soft-warn email at 80%, and a hard stop
at 100% that returns `QUOTA_EXCEEDED` instead of a signed URL. Surface usage in the admin
dashboard.

## 4. Real-device AR verification

Add `docs/device-matrix.md` with a scripted manual test plan (iOS Safari 17/18, Android
Chrome, low-end Android) covering: camera permission denial, context-lost recovery,
album multi-target, PIN gate, and offline grace. Add a `/dashboard/diagnostics` panel
that records client-reported AR capability tier and failure reason so field failures are
visible without asking the customer.

## 5. Client-branch delivery hygiene

- Add a `bun run verify:client` script that runs `scripts/strip-client-app.sh` on a temp
  worktree, then builds and boots it, failing if any issuer-side import survives.
- Add a first-run setup wizard route for the client branch that validates their env
  (R2 creds, licence key, Supabase URL) and reports exactly which variable is wrong.
- Generate `CLIENT_README.md` on release with only the client-relevant subset of the docs.

## 6. Commercial protection

- Add a signed `DELIVERY_MANIFEST.json` at release time listing file digests, so a resold
  copy can be proven to originate from a specific customer's build.
- Add per-customer watermarking of the build ID into the compiled bundle.
- Update `LICENSE_AGREEMENT.md` with the actual enforcement behaviour described in
  `docs/licence-enforcement.md` so the contract matches the code.

## 7. Final report

Produce `docs/production-readiness.md`: a table of every subsystem (auth, RLS, licensing,
storage, AR runtime, CI, DR, docs) with status ready / partial / missing, the evidence for
each claim, and the residual risks a buyer must accept.
