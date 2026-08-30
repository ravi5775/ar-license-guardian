# 02-architecture-01 — System context and deployment topology

## Executive summary

This repository’s architecture is intentionally split across three deployment contexts while keeping a single codebase and a single branch-aware execution model. The strongest evidence is the explicit branch contract in [../../docs/branching.md](../../docs/branching.md), the deployment profile logic in [../../src/lib/adapters/deployment.server.ts](../../src/lib/adapters/deployment.server.ts), and the env-driven adapter layer in [../../src/lib/adapters/env.server.ts](../../src/lib/adapters/env.server.ts).

The repo is designed to support:

- `main` as the managed admin/issuer deployment
- `self-hosted` as the private admin deployment on Node/Postgres
- `client-app` as the stateless customer-facing distribution with no issuer logic

This is a coherent architecture for a controlled commercial SaaS and customer delivery model. It is not a classic “one app, one deploy” repo; it is a deliberately segmented runtime architecture with branch-specific environment contracts and strict fallback rules that intentionally block accidental admin deployment on customer builds.

The main risk is operational rather than structural: the repo documents the intended topology well, but it does not contain live Cloudflare or production-environment evidence proving the branch-specific services are actually configured in production. The architecture is strong, the controls are documented, and the code-level logic is consistent; the missing verification is live deployment state and branch protection enforcement.

## Evidence table

| Check | Evidence | Status |
|---|---|---|
| Branch model and deployment split | [../../docs/branching.md](../../docs/branching.md) | VERIFIED |
| Runtime selection | [../../src/lib/adapters/env.server.ts](../../src/lib/adapters/env.server.ts) | VERIFIED |
| Deployment classification | [../../src/lib/adapters/deployment.server.ts](../../src/lib/adapters/deployment.server.ts) | VERIFIED |
| Database adapter abstraction | [../../src/lib/adapters/db.server.ts](../../src/lib/adapters/db.server.ts) | VERIFIED |
| Rate-limit abstraction | [../../src/lib/adapters/ratelimit.server.ts](../../src/lib/adapters/ratelimit.server.ts) | VERIFIED |
| Security headers and request middleware | [../../src/start.ts](../../src/start.ts) | VERIFIED |
| Managed worker config | [../../vendor-worker/wrangler.toml](../../vendor-worker/wrangler.toml) | VERIFIED |
| Self-hosted deployment config | [../../deploy/self-hosted/docker-compose.yml](../../deploy/self-hosted/docker-compose.yml) | VERIFIED |
| Build metadata injection | [../../vite.config.ts](../../vite.config.ts) | VERIFIED |
| Hosting setup and operations | [../../docs/hosting.md](../../docs/hosting.md) | VERIFIED |
| Live tests | `bun test` | VERIFIED: 160 pass, 0 fail |

## Verified findings

1. The repo enforces a three-way topology by configuration, not by duplicated app logic.
   - Evidence: [../../src/lib/adapters/env.server.ts](../../src/lib/adapters/env.server.ts) defines the role and runtime decision points for `main`, `self-hosted`, and `client-app`.
   - The code expresses the intended branch model directly in comments and implementation:
     - `main` → `RUNTIME=edge`, `DB_DRIVER=neon`, `LICENCE_ROLE=issuer`
     - `self-hosted` → `RUNTIME=node`, `DB_DRIVER=postgres`, `LICENCE_ROLE=issuer`
     - `client-app` → `DB_DRIVER=none`, `LICENCE_ROLE=client`

2. The application derives deployment profile logic from environment state rather than hardcoded branch checks.
   - Evidence: [../../src/lib/adapters/deployment.server.ts](../../src/lib/adapters/deployment.server.ts) exports `deploymentProfile()` and computes `kind` using `licenceRole()` and `dbDriver()`.
   - The code purposely treats customer builds as `client-app` when `LICENCE_ROLE=client` or `DB_DRIVER=none`, making accidental admin exposure a fail-safe default.

3. The client/customer branch is designed to be stateless and stripped of issuer logic.
   - Evidence: [../../docs/branching.md](../../docs/branching.md) states that `client-app` is `main` with the issuer/admin modules removed, and [../../src/lib/adapters/db.server.ts](../../src/lib/adapters/db.server.ts) throws if a client build attempts to query the DB.
   - This is a strong design choice against accidental server logic exposure in customer bundles.

4. The architecture keeps the codepath stable while hiding deployment-specific differences behind adapters.
   - Evidence: [../../src/lib/adapters/db.server.ts](../../src/lib/adapters/db.server.ts), [../../src/lib/adapters/ratelimit.server.ts](../../src/lib/adapters/ratelimit.server.ts), and [../../src/lib/adapters/env.server.ts](../../src/lib/adapters/env.server.ts) all isolate runtime-specific implementation choices behind one interface.
   - This reduces branch drift and preserves a single source of truth for business logic.

5. The app applies strong security headers and request-level protection uniformly.
   - Evidence: [../../src/start.ts](../../src/start.ts) sets a strict CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `HSTS`, `Permissions-Policy`, and an error wrapper.
   - This is important because the architecture mixes edge, SSR, and customer-facing runtime surfaces.

6. The repository includes explicit hosting and operational guidance beyond the core app code.
   - Evidence: [../../docs/hosting.md](../../docs/hosting.md) documents Cloudflare Pages, R2, self-hosted Docker, and cost tiers.
   - This makes the topology practical and auditable rather than just conceptual.

7. The repo’s test suite is currently green.
   - Evidence: `bun test` completed with `EXIT_CODE:0` and `160 pass / 0 fail`.
   - This provides fresh evidence that the branch-aware runtime logic and core security controls are passing the repository’s defined checks.

## Risk rating

Medium

Reason:
- The architecture is intentional, documented, and internally consistent.
- The main risk is not a broken topology; it is operational drift: the repo documents the ideal state, but it does not verify actual live Cloudflare, R2, worker, or branch-protection settings from production.
- The design relies heavily on environment configuration correctness and disciplined release flow, which must be enforced externally.

## Recommended fix

1. Add a deployment validation checklist in CI to enforce `main`, `self-hosted`, and `client-app` environment contracts before release.
2. Add branch protection rules for `main`, `self-hosted`, and `client-app` to enforce the intended one-way merge policy.
3. Add a runtime smoke test that fails when a `client-app` build is accidentally started with `LICENCE_ROLE=issuer` or `DB_DRIVER!=none`.
4. Add a deployment manifest or config audit to verify that Cloudflare Pages, Workers, and R2 settings match the documented host model.
5. Document and automate the release tag/manifest process so customer builds can be traced from CI to deployment with signed provenance.

## Suggested commit message

`chore: formalize deployment topology guardrails and branch-safe runtime checks`

## Production readiness impact

Moderate.

The system is well-structured for controlled enterprise deployment, but real production readiness depends on operational enforcement of the branch model and environment policing outside the repo. The architecture itself is strong enough for controlled commissioning, but the live hosting configuration still needs external verification before a procurement-grade conclusion can be drawn.

## Verification commands

```bash
bun test
git branch -a --no-color
git log --oneline --decorate --graph --all --max-count=20
find . -maxdepth 3 -type f | sort
```

## Missing evidence / NOT VERIFIED

- No live Cloudflare Pages/Workers/R2 configuration was inspected from the actual production provider.
- No GitHub branch protection rule set was verified in the remote repository.
- No live deployment manifest or signed release artifact history was inspected for the current production environment.
- No actual self-hosted Docker/composed runtime was started and validated in this session.
- No customer production domain configuration or access logs were examined.

## Final assessment

This repository demonstrates a disciplined and deliberate system architecture rather than a generic app structure. The branch-based deployment topology is coherent, the runtime selection logic is explicit, and the platform is designed to keep admin and customer responsibilities separate. The strongest evidence is the combination of [../../docs/branching.md](../../docs/branching.md), [../../src/lib/adapters/deployment.server.ts](../../src/lib/adapters/deployment.server.ts), [../../src/lib/adapters/env.server.ts](../../src/lib/adapters/env.server.ts), and the passing Bun test suite.

The architecture is suitable for enterprise procurement review as a controlled deployment model, but not yet complete as a live operational proof. The remaining gap is not in the code design; it is in the verification of the actual hosted environment and enforced branch policy outside of the repo itself.
