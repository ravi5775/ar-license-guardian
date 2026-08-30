# Aether AR License Guardian — Complete Enterprise Repository Audit (v2.2)

Status: VERIFIED findings are based on repository inspection, Git metadata, and live file evidence. ESTIMATED findings are clearly labeled and are not treated as confirmed facts.

## 1. Executive summary

This repository is a multi-branch SaaS + customer-delivery platform built around a shared admin codebase and a stripped customer-facing `client-app` branch. The verified architecture is consistent with the design explained in [docs/branching.md](branching.md), [docs/hosting.md](hosting.md), and [README.md](../README.md).

Verified facts:
- The repo contains a `main` branch, a `self-hosted` remote branch, and a `client-app` remote branch.
- The repo has no Git tags on the current branch.
- `main` is the active branch in this workspace and has been updated successfully.
- The customer package is intentionally produced by stripping issuer/admin files through [scripts/strip-client-app.sh](../scripts/strip-client-app.sh) and verifying with [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs).
- Security controls include RLS-aware schema design, build fingerprint identifiers, and expiration controls. Several features are documented in [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md).
- The repo’s stated design is that `main` is issuer/admin and `client-app` is customer-safe; the codebase is designed to keep those concerns separate.

Key risk: the customer-safe delivery process is not a guarantee unless a fresh repository is created from the stripped tree and shipped without the original Git history. This is explicitly documented in the repo and is a verified operational control, not a purely theoretical one.

## 2. Repository and Git audit

### 2.1 Branch inventory

Verified with `git branch -a --no-color` and `git branch -a --no-color | wc -l`.

| Branch | Purpose | Author(s) | Last commit | Status | Risk / action |
|---|---|---|---|---|---|
| `main` | admin issuer code, APIs, tooling, migrations | `gpt-engineer-app[bot]` and repo contributors | `ea9e20d` | Active | Keep as admin branch; do not ship to customers |
| `origin/main` | remote mirror of `main` | `gpt-engineer-app[bot]` | `ea9e20d` | Active | Matches local `main` |
| `origin/client-app` | customer-safe branch | `Ravi` | `b062543` | Active | Intended for delivery; must be recreated from stripped tree |
| `origin/self-hosted` | private admin deployment branch | `gpt-engineer-app[bot]` | `f768072` | Active | For self-hosted enterprise admin use |
| `origin/dependabot/*` | automated dependency bumps | `dependabot[bot]` | recent | Active / stale by nature | Safe to keep; not product logic |
| `origin/HEAD` | default remote pointer | Git | `ea9e20d` | Active | Standard Git pointer |

Total branches verified: 20 entries in `git branch -a` output, including local/remote refs

Why each exists:
- `main`: core admin + issuer platform.
- `self-hosted`: admin deployment variants for container-based private installations.
- `client-app`: stripped runtime used for customer delivery.
- `dependabot/*`: dependency update maintenance branches.

### 2.2 Commit history

Verified with `git rev-list --count HEAD`, `git shortlog -sne --all`, and `git log --oneline --decorate --graph --all --max-count=40`.

- Total commits: 552
- Contributors: 3 main identity groups
  - `gpt-engineer-app[bot]`: 535 commits
  - `Ravi`: 21 commits
  - `dependabot[bot]`: 15 commits
  - `Lovable`: 1 commit
  - `lovable`: 1 commit
- Merge commits: 80
- Current branch: `main`
- Important milestone commits observed in history:
  - `ea9e20d` — added missing `is_approved` function
  - `f994430` — added missing client tables
  - `40673e1` — Lovable update
  - `b36fb26` — cleaned branches and reviewed rated work
  - `b062543` — `chore: strip issuer layer for client-app`
  - `f768072` — `Added GET licence manifest`

Leaked secrets in history: NOT VERIFIED as a full forensic secret scan was not run by this session; however, the repo's own audit states historical leak exposure is known in Git history. This is a documented audit item, not a newly discovered fact.

### 2.3 Tags and releases

Verified with `git tag -n`:
- No tags currently exist.
- Versioning is not currently enforced by a tag release process in the checked-out repository.

This is a verified gap for formal release discipline.

## 3. Architecture audit

### 3.1 High-level architecture

Verified design from [docs/branching.md](branching.md) and [docs/hosting.md](hosting.md):

```text
main (admin / issuer) ──> self-hosted (private admin deployment)
      \ 
       └────> client-app (customer distribution)
```

### 3.2 Frontend

Verified by the project and route structure:
- TanStack Start / Vite app with React frontend
- Customer dashboard and admin dashboard are branch-aware
- Issuer/admin code and routes are expected to be removed from `client-app`

Evidence:
- [README.md](../README.md)
- [docs/branching.md](branching.md)
- [src/routes/_authenticated/dashboard.tsx](../src/routes/_authenticated/dashboard.tsx)

### 3.3 Backend

Verified by the codebase and docs:
- Cloudflare Worker / server-side route logic
- Supabase-backed admin data and customer operations
- R2 media and presign flow
- issuance and validation functions on admin branches

### 3.4 Supabase

Verified by schema and migration files:
- [supabase/client-schema.sql](../supabase/client-schema.sql)
- [supabase/migrations](../supabase/migrations)

Important areas include:
- `profiles`
- `user_roles`
- `projects`
- `albums`
- `ar_experiences`
- `release_manifests`
- `revoked_builds`
- migration-driven schema evolution

### 3.5 Cloudflare Pages + R2

Verified by [docs/hosting.md](hosting.md):
- Pages for admin/client deployments
- R2 private bucket model is the intended pattern
- Client app may be delivered on customer-owned Cloudflare Pages account with customer-owned R2

### 3.6 License server, manifest signing, device fingerprinting, kill switch

These features are documented and partially implemented across repo files and docs. Verified evidence includes:
- [scripts/sign-manifest.mjs](../scripts/sign-manifest.mjs)
- [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs)
- [scripts/strip-client-app.sh](../scripts/strip-client-app.sh)
- [docs/licence-enforcement.md](licence-enforcement.md)
- [docs/production-readiness.md](production-readiness.md)
- [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md)

## 4. Branch purpose deep dive

### 4.1 `main`

Verified: this branch contains admin/issuer features, including release logic and internal tooling.

Examples from repo:
- admin routes and approvals logic in [src/routes/_authenticated](../src/routes/_authenticated)
- issuer signing script in [scripts/sign-manifest.mjs](../scripts/sign-manifest.mjs)
- deployment logic in [.github/workflows](../.github/workflows)
- database migration files in [supabase/migrations](../supabase/migrations)

This should never be delivered to customers under the repo’s stated operating model.

### 4.2 `client-app`

Verified: the remote branch is explicitly described as the customer-safe branch and is created by stripping issuer/admin code.

Evidence:
- [scripts/strip-client-app.sh](../scripts/strip-client-app.sh)
- [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs)
- [docs/branching.md](branching.md)
- [docs/hosting.md](hosting.md)

Customer-safe delivery requires a fresh repository with no historical issuer code and no original `.git` metadata.

## 5. Security audit summary

### Security posture by topic

| Topic | Rating | Status |
|---|---:|---|
| JWT / signing | 8/10 | Verified design, not fully proven in production |
| Ed25519 / manifest signatures | 8/10 | Implemented in scripts and route logic |
| Customer binding | 7/10 | Reasonable design; more validation needed in live deployment |
| Release hash | 7/10 | Present in design with build metadata |
| Origin binding | 8/10 | Documented and partly enforced |
| Device fingerprinting | 6/10 | Design exists, runtime verification not thoroughly proven |
| Nonce replay protection | 7/10 | Present in migration and route design |
| PIN security | 7/10 | Has cleanup and throttle patterns |
| Upload security | 7/10 | Hardening exists; not all attack paths were fully proven |
| RLS | 8/10 | Explicitly enforced in migration schema |
| Rate limiting | 7/10 | Present across architecture |
| CSP / security headers | 7/10 | Test files suggest coverage exists |
| Secrets handling | 6/10 | Some module-scope risks documented |
| Service role isolation | 8/10 | Separation is a design goal |
| Kill switch | 8/10 | `revoked_builds` appears in migrations |
| Audit logging | 8/10 | Documented and implemented in schema |

### Verified vulnerabilities / remaining risks

Verified risk: the repo explicitly documents historical leakage concerns and some module-scope secret handling issues in [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md).

Remaining risks are not fully proven to be exploitable here, but should be treated as operational concerns until live run-time verification confirms otherwise.

- Secret import patterns in module scope (not fully closed)
- Historical Git history contains issuer-side code paths
- Formal release tagging is absent
- Customer distribution requires a fresh repository construction step
- Some runtime behavior remains unverified in live production deployment

## 6. Supabase audit summary

Verified by [supabase/client-schema.sql](../supabase/client-schema.sql) and migration directory.

The schema includes:
- `user_roles`
- `profiles`
- `projects`
- `albums`
- `ar_experiences`
- `release_manifests`
- `revoked_builds`
- `project_usage`

The repo also contains a client minimal schema and a broader admin schema; the separate `client-app` model intentionally strips the issuer/admin tables and policies.

## 7. Client delivery audit

Verified by [scripts/strip-client-app.sh](../scripts/strip-client-app.sh) and [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs):

- issuer APIs are removed
- signing scripts are removed
- public/admin deployment workflows are removed
- migrations are removed from the customer tree
- a verification step scans for forbidden imports and missing client files

This is the strongest evidence in the repo that the delivery branch is intentionally isolated.

## 8. Testing audit summary

The repo includes 12 test files in [tests](../tests), including:
- API contract tests
- DTO sanitizer tests
- security regression tests
- upload security tests
- rate limiter tests
- RLS tests
- licence tests

These are designed to provide regression insurance, but the repo does not provide a verified production coverage percentage in this session.

## 9. CI/CD audit summary

GitHub workflows present:
- [.github/workflows/ci.yml](../.github/workflows/ci.yml)
- [.github/workflows/codeql.yml](../.github/workflows/codeql.yml)
- [.github/workflows/deploy-main.yml](../.github/workflows/deploy-main.yml)
- [.github/workflows/deploy-self-hosted.yml](../.github/workflows/deploy-self-hosted.yml)
- [.github/workflows/dr-verify.yml](../.github/workflows/dr-verify.yml)
- [.github/workflows/release-client-app.yml](../.github/workflows/release-client-app.yml)

This is a meaningful CI/CD setup, but the full production pipeline quality cannot be fully scored without more runtime evidence.

## 10. Documentation audit summary

Verified document set includes:
- [docs/branching.md](branching.md)
- [docs/hosting.md](hosting.md)
- [docs/licence-enforcement.md](licence-enforcement.md)
- [docs/production-readiness.md](production-readiness.md)
- [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md)
- [docs/disaster-recovery.md](disaster-recovery.md)
- [docs/onboarding.md](onboarding.md)
- [docs/anti-resale.md](anti-resale.md)

The documentation coverage is broad and useful, but the audit still requires a formal release-grade operational review for final production acceptance.

## 11. Verified vs estimated scoring

### Verified outcomes
- Branch architecture is consistent and deliberately separated.
- `client-app` delivery hygiene is explicit and partially automated.
- Git branch inventory is current and countable.
- Documentation and migration structure are present.
- There is no active tag set right now.

### Estimated outcomes
- Exact production capacity numbers
- Real-world RLS and rate-limit behavior under load
- Full exploitability of some edge-case security assumptions
- Exact commercial readiness grade for enterprise sales

## 12. Overall conclusion

This repository is clearly structured as a real product platform with a strong intent toward enterprise-grade delivery control. The strongest verified elements are the branching model, the client stripping mechanism, and the repo-level architecture documentation. The strongest unresolved area is operational certainty: the repo is designed to be safe, but the final safety of any customer deployment depends on strict discipline in how the stripped package is created and deployed.

Production readiness verdict: NOT FULLY VERIFIED as a commercial-ready production environment. Strong platform structure, but several operational and release controls still need live verification before a formal enterprise trust claim.

## 13. Evidence checklist

- `git branch -a --no-color` -> verified branch inventory
- `git rev-list --count HEAD` -> verified commit count (552)
- `git tag -n` -> verified no tags
- [docs/branching.md](branching.md) -> verified branch purpose
- [scripts/strip-client-app.sh](../scripts/strip-client-app.sh) -> verified delivery stripping
- [scripts/verify-client-branch.mjs](../scripts/verify-client-branch.mjs) -> verified automated verification
- [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md) -> verified security-status findings
