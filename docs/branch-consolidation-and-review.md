# Branch consolidation, cleanup, code review & rating

Date: 2026-08-29 · Repo: Aether AR

---

## 1. What I already did in this repo

Deleted (they were tracked and shipped to customers for no reason):

- `.agents/skills/**`, `.claude/skills/**`, `.pi/skills/**`, `.trae/skills/**` — editor/agent
  skill drafts, ~192 KB of prompt text unrelated to the product
- `hardening-implementation-report.md` — internal working note, superseded by `docs/`
- `package-lock.json` — npm lockfile in a Bun project; two lockfiles = non-reproducible installs
- `tsconfig.tsbuildinfo` — build artefact, now gitignored

Added to `.gitignore`: `tsconfig.tsbuildinfo`, `package-lock.json`.

**Left in place on purpose:**

- `src/integrations/lovable/**`, `src/lib/lovable-error-reporting.ts`, `@lovable.dev/*` packages
  and `vite.config.ts` — these are the build/runtime platform, not branding. Removing them breaks
  the build. They are invisible to end users.
- The `og:image` URL in `src/routes/__root.tsx` still points at an R2 object whose *filename*
  contains `lovable.app`. It is your own R2 bucket and the file name is never shown to a visitor,
  but if you want it clean, re-upload the social card under a neutral key and swap the two URLs.

---

## 2. Branch consolidation — run these yourself

This repo currently has only `main`. The three-branch model lives in your own GitHub remote, so
these are commands for your machine, not something the app can do.

### 2.1 See what exists

```bash
git fetch --all --prune
git branch -a --sort=-committerdate
git log --oneline --graph --all --decorate | head -40
```

### 2.2 Establish the three branches

```bash
git checkout main && git pull

# self-hosted: main + Docker/Node env only
git checkout -B self-hosted main
git push -u origin self-hosted

# client-app: main minus the issuer layer
git checkout -B client-app main
./scripts/strip-client-app.sh
git add -A && git commit -m "chore: strip issuer layer for client-app"
git push -u origin client-app
```

### 2.3 Merge anything worth keeping, then delete the rest

For every other branch, decide once:

```bash
# Is there anything on it that main doesn't have?
git log --oneline main..<branch>

# If yes -> merge into main (never merge INTO client-app from anywhere but main)
git checkout main && git merge --no-ff <branch> && git push

# Then delete, local + remote
git branch -D <branch>
git push origin --delete <branch>
```

### 2.4 Lock the topology so it cannot drift

On GitHub → Settings → Branches, protect `main`, `self-hosted`, `client-app`:
require PR + status checks, block force-push and deletion. Then in Settings → General enable
"Automatically delete head branches" so feature branches disappear after merge.

Merge direction stays strictly one-way — this is already documented in `docs/branching.md`:

```text
main ──> self-hosted
  └────> client-app
```

### 2.5 Refresh the client branch on every release

```bash
git checkout client-app
git merge main --no-ff
./scripts/strip-client-app.sh
node scripts/verify-client-branch.mjs   # asserts issuer code gone, 6 client features present
git add -A && git commit -m "release: sync client-app with main"
```

---

## 3. Prompts to paste back to me (in this order)

Each is self-contained; run one per turn so the diff stays reviewable.

**Prompt A — dead code & dependency sweep**
> Sweep the repo for dead weight: unused exports, unimported components, packages in
> package.json that nothing imports, duplicated helpers between `src/lib/r2.server.ts` and
> `src/lib/storage.server.ts`, and any route or doc that no longer has a caller. Delete what is
> genuinely unused, keep anything referenced by the strip script or CI, and show me the list of
> removals with the reason for each. Then run lint, typecheck and the unit tests.

**Prompt B — collapse the two storage modules**
> `src/lib/r2.server.ts` is a re-export shim over `storage.server.ts`. Migrate every importer to
> `storage.server.ts` and delete the shim. Do the same audit for `src/lib/db.server.ts` vs
> `src/lib/adapters/db.server.ts` — one of them should be the only entry point.

**Prompt C — docs consolidation**
> `docs/` has 13 files with overlapping content (`next-phase-prompt.md`,
> `seller-hardening-prompts.md`, `status-audit-2026-08-21.md`, `production-readiness.md`).
> Fold the still-true parts into `docs/production-readiness.md` and `docs/branching.md`, delete
> the stale planning docs, and update every internal link. Keep `hosting.md`, `onboarding.md`,
> `disaster-recovery.md`, `break-glass.md`, `anti-resale.md`, `licence-enforcement.md`,
> `api-reference.md`, `device-matrix.md` as they are the operational set.

**Prompt D — test coverage on the parts that can lose me money**
> Add unit tests for: licence activation slot exhaustion + cooldown, presign gate refusal when
> licence state is invalid, uploader-guard path scoping for a non-admin editor, and the approval
> gate redirect matrix (no session / pending / rejected / approved / admin). Use the existing
> vitest setup and don't hit the network.

**Prompt E — client delivery dry run**
> Simulate a client delivery end to end: run `scripts/strip-client-app.sh` into a temp tree,
> build it with `LICENCE_ROLE=client DB_DRIVER=none`, run `verify-client-branch.mjs`, and report
> anything that breaks or any issuer file that survives. Do not modify the main tree.

**Prompt F — social/branding polish**
> Replace the `og:image` R2 object with a neutral filename, update `__root.tsx`, and audit every
> user-visible string, meta tag and footer for anything that names a vendor, platform or internal
> tooling.

---

## 4. Code review

### Strong

- **Adapter boundary is real, not decorative.** `src/lib/adapters/{db,storage,ratelimit,licence,
  deployment}.server.ts` means the three branches differ by env, not by code. `env.server.ts`
  defaults `licenceRole()` to `client` — least privilege by default, which is the right call.
- **Data access discipline.** UI never calls `supabase.from(...)`; everything goes through
  `*.functions.ts` server functions, and an ESLint rule enforces it. This is the single biggest
  reason the codebase is sellable.
- **Layered access control.** RLS scoped to `owner_id`, a separate `user_roles` table, bcrypt PIN
  gate, SHA-256 QR tokens, signed short-TTL media URLs, presign gating tied to licence state,
  and `uploader-guard.server.ts` re-scoping editor upload paths.
- **Vendored AR runtime.** MindAR/A-Frame served same-origin with recorded SHA-384 sums keeps CSP
  at `script-src 'self'` and removes a CDN outage from the failure surface.
- **Operational maturity is unusual for this size:** DR runbook + verify script, break-glass doc,
  egress accounting, kill switch, per-branch CI.

### Weak

1. **Duplicate module pairs.** `r2.server.ts`/`storage.server.ts` and `db.server.ts` vs
   `adapters/db.server.ts` — two names for one thing invites a future contributor to import the
   wrong one from a client build. (Prompt B.)
2. **The strip script is the security boundary and it is a bash `rm` list.** One forgotten
   `rm` in a future refactor ships the issuer. `verify-client-branch.mjs` mitigates it, but it
   should assert on an explicit *allowlist* of shipped paths, not a denylist of removed ones.
3. **Docs sprawl.** 13 files, several of them frozen planning artefacts. Anyone onboarding cannot
   tell which is current. (Prompt C.)
4. **Test coverage is security-shaped, not behaviour-shaped.** Good tests for headers, rate limits
   and RLS; almost none for licence slot logic, gate redirects, or upload scoping. (Prompt D.)
5. **`_authenticated/route.tsx` runs `ssr: false` with a 60s role cache.** Correct for latency,
   but it means the first paint of every dashboard load is client-side; a slow phone shows a blank
   frame. Consider a lightweight skeleton at the layout level.
6. **No automated client-delivery rehearsal in CI.** `release-client-app.yml` builds, but nothing
   proves a freshly stripped tree still boots. (Prompt E.)
7. **Branch topology is documented but unenforced** — no protection rules, so the whole model
   depends on discipline. (§2.4.)

### No blocking security defects found in this pass

RLS, grants, role separation, secret handling and the public API surface all look correct for the
stated threat model (an unmotivated reseller, not a determined attacker with the source — which is
the honest ceiling for any shipped-source product, and `docs/anti-resale.md` already says so).

---

## 5. Rating

| Aspect | Score | Note |
| --- | ---: | --- |
| Architecture & branch model | 9.0 | Adapters + one-way merges; only the enforcement is manual |
| Security posture | 9.0 | RLS, roles, signed URLs, presign gating, hashed PINs, vendored AR |
| Licensing / anti-resale | 8.0 | Ed25519 + fingerprints + grace periods; ceiling is inherent to shipped source |
| Code quality & consistency | 8.0 | Clean layering; duplicate modules and a few long route files |
| Data-access discipline | 9.5 | Lint-enforced server-function boundary — best-in-class here |
| Frontend / UX | 8.0 | Strong landing craft; dashboard first paint and mobile density lag it |
| AR/VR engine | 8.0 | Tier-capped, self-hosted, fallbacks; real-device accuracy still unproven |
| Testing & CI | 7.0 | Security tests solid, behavioural coverage thin, no delivery rehearsal |
| Documentation | 7.5 | Deep operational docs, undermined by stale planning files |
| Operational readiness (DR, monitoring) | 8.0 | Runbooks + verify scripts exist; restore proof still manual |
| Commercial packaging | 8.5 | Pricing, contracts, handover, onboarding wizard all present |
| **Overall** | **8.3 / 10** | Sellable today; 9.5 after prompts A–E |

### The three things standing between 8.3 and 9.5

1. Turn the client-strip from a denylist into an allowlist, and rehearse a delivery in CI.
2. Collapse the duplicate storage/db modules and prune the stale docs.
3. Add behavioural tests for licence slots, the approval gate, and upload scoping.
