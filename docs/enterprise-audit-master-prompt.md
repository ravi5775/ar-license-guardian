# Aether AR License Guardian — Enterprise Audit Master Prompt

**Project:** `Aether AR / ar-license-guardian`  
**Audit date:** 2026-09-04  
**Mode:** zero-trust, evidence-first, no assumed PASS  
**Purpose:** repository, security, licensing, deployment, operations, performance, business-readiness, ethical-use, and customer-handover audit

> This file is an audit prompt and remediation blueprint. It is not evidence that every control has passed.

## 1. Auditor role

Act as the Aether AR Enterprise Principal Auditor, application security engineer, SRE, DevSecOps engineer, database security engineer, licensing cryptography reviewer, QA lead, and production-readiness reviewer.

Audit the complete repository from scratch. Do not trust previous reports, comments, TODOs, screenshots, README claims, or developer assertions.

Discover every realistic defect, security weakness, architectural inconsistency, operational failure, scalability problem, licensing bypass, privacy issue, deployment mistake, test gap, documentation mismatch, and customer-handover risk.

## 2. Mandatory audit rules

1. Evidence is required before `PASS`.
2. Distinguish `VERIFIED`, `PARTIALLY_VERIFIED`, `UNVERIFIED`, `FAIL`, and `NOT_APPLICABLE`.
3. Every passing item must identify the file, symbol, command, result, and artifact.
4. A skipped, mocked, or source-only test is not production proof.
5. Test positive and adversarial paths.
6. Test admin, client, and self-host build profiles separately.
7. Search for duplicate, legacy, dead, shadowed, alternate, and bypass paths.
8. Audit source, generated bundles, migrations, workflows, deployment files, dependencies, and history.
9. Never silently fix findings during the audit; remediation is a separate phase.
10. Never award 100/100 while a mandatory control is unverified.

## 3. Current architecture to verify

- TanStack Start, React, TypeScript, Tailwind, and Vite/Nitro.
- MindAR, A-Frame, Three.js, and QR-driven AR playback.
- Supabase/PostgreSQL with tenant isolation and RLS.
- Cloudflare R2 private media storage.
- Cloudflare edge and self-hosted Docker deployment profiles.
- Upstash, Redis, Postgres, or development-only memory rate limiting.
- Ed25519-signed licence manifests and device/build attestation.
- Admin, client, and self-host build profiles.

## 4. Preliminary risk position

The project must remain `CONDITIONAL` or `NOT_READY` until staging and external evidence prove the controls below:

- all profile builds and deployment paths;
- mandatory MFA and AAL2 authorization;
- tenant isolation and live RLS;
- private media URL enforcement;
- rate-limit budgets under burst;
- licence activation, duplicate, revocation, and grace behavior;
- vendor-worker/client API compatibility;
- full-history secret scanning and credential rotation;
- SRI or self-hosted AR dependency integrity;
- backup, restore, observability, incident response, and rollback;
- Android and iPhone AR behavior.

## 5. Verdict and score policy

| Verdict | Rule |
|---|---|
| `PASS` | All mandatory controls verified; no critical/high failures |
| `CONDITIONAL_PASS` | No critical failures; limited accepted findings remain |
| `FAIL` | Critical finding, bypass, secret exposure, unsafe production configuration, or tenant escape |
| `NOT_READY` | Core production evidence is missing |
| `BLOCKED` | Required repository, tool, or environment is unavailable |

Score ceilings:

- Critical finding: maximum 59/100.
- Unresolved high security, licence, or tenant finding: maximum 79/100.
- Missing live RLS: database score maximum 8/10.
- Missing restore test: disaster-recovery score maximum 5/10.
- Missing key-rotation proof: cryptography score maximum 8/10.
- Missing production observability: operations score maximum 6/10.
- Reachable legacy security endpoint: API/licence score maximum 7/10.

## 6. Mandatory audit phases

### P00 — Repository integrity

Verify status, branches, tags, remotes, untracked files, ignored files, generated files, lockfiles, package-manager consistency, submodules, unexpected binaries, source/bundle mismatch, branch divergence, and branch protection.

```powershell
git status --short
git branch -a
git log --oneline --decorate -20
git remote -v
git diff
git ls-files
```

### P01 — Build profiles and release

Verify:

- `bun run build:admin`
- `bun run build:client`
- `bun run build:selfhost`
- cross-platform execution;
- profile/environment consistency;
- profile-specific route and server-function enforcement;
- correct `.output` artifact paths;
- absence of issuer keys and vendor modules in client output;
- immutable release metadata and rollback references.

### P02 — Authentication and authorization

Verify:

- password and magic-link flows;
- Argon2id for new application-managed password hashes;
- bcrypt compatibility and immediate Argon2id rehash;
- breached-password screening;
- session revocation after password changes;
- verified MFA enrollment for every owner/admin;
- AAL2 on every privileged mutation;
- role storage only in `user_roles`;
- server-derived tenant identity;
- viewer, AAL1, unauthenticated, and cross-tenant negative tests.

### P03 — Database and RLS

Verify:

- `tenant_id` on every business table;
- RLS, policies, and explicit grants on every public table;
- active-tenant requirement for anonymous published reads;
- role and tenant checks in `USING` and `WITH CHECK`;
- append-only scan and audit tables;
- trigger-only audit insertion;
- deterministic audit hash chaining;
- historical scans surviving experience deletion.

### P04 — Storage and uploads

Verify:

- private buckets;
- short-lived signed PUT/GET URLs;
- no permanent public URL fallback;
- tenant-scoped object keys;
- extension, MIME, magic-byte, size, and SHA-256 validation;
- malware/content screening;
- atomic object/database deletion;
- revoked and expired URL behavior.

### P05 — API, abuse, and privacy

Verify:

| Operation | Budget | Key |
|---|---:|---|
| Activation | 5/hour | fingerprint + trusted IP |
| Heartbeat | 12/hour | tenant |
| Presigned upload | 60/hour | authenticated user |
| Public scan | 120/minute | trusted IP |
| Sign-in | 10/15 minutes | normalized email + trusted IP |

Verify `429` and `Retry-After`, trusted ingress headers, generic authentication errors, no secrets in URLs/logs, consent notices, retention, hashed user-agent handling, and appealable ethical-use decisions.

### P06 — Licensing and vendor worker

Verify:

- all five fingerprint inputs are mandatory;
- `400 incomplete_fingerprint`;
- `409 duplicate_activation`;
- Ed25519 signature validation;
- domain/project/release binding;
- 30-day signed grace during worker outage;
- update entitlement independent from runtime availability;
- revocation read-only mode and export access;
- worker authentication, rate limiting, CORS, heartbeat, revocation cache, and recovery;
- client and worker request/response contract compatibility.

### P07 — Supply chain and client isolation

Verify:

- exact dependency versions where security-sensitive;
- self-hosted or SRI-pinned AR libraries;
- CI checksum verification;
- approved browser `VITE_*` allowlist;
- no service-role, R2, signing, worker, or issuer code in client builds;
- full-history gitleaks;
- dependency, container, and licence scanning;
- rotation of any historically exposed credential.

### P08 — Operations and resilience

Verify:

- Cloudflare and Docker deployment paths;
- staging-before-production promotion;
- protected environments and approvals;
- health checks and graceful shutdown;
- logs, metrics, alerts, and traces;
- backup freshness;
- restore drill;
- disaster recovery;
- incident response;
- key rotation;
- rollback to an immutable build.

### P09 — Performance and capacity

Against staging only, run:

- k6 ramp from 0 to 200 VU;
- autocannon hot endpoints;
- database `EXPLAIN (ANALYZE, BUFFERS)`;
- RLS overhead comparison;
- 100 cold invocations;
- R2 throughput at 1/10/100 MB;
- heap baseline versus 1,000 requests;
- CPU profile and flamegraph.

### P10 — Documentation, ethics, and handover

Verify canonical documentation for:

- product operation;
- deployment and operations;
- security;
- licensing/legal terms;
- customer handover;
- privacy and data retention;
- acceptable use, prohibited use, consent, human review, appeals, and emergency suspension.

Do not auto-ban based only on opaque model scores. Version policy rules, minimize sensitive data, avoid protected-characteristic inference, preserve appeal evidence, and require human approval for permanent suspension or deletion.

## 7. Password algorithm policy

Use Argon2id for new password hashes with production-benchmarked parameters. A recommended starting point is 64 MiB memory, three iterations, parallelism one or two, a 32-byte output, and a random salt of at least 16 bytes.

Use bcrypt only for legacy compatibility, with cost 12 or higher after benchmarking. On successful bcrypt login, verify, issue the session, atomically rehash with Argon2id, and never downgrade an Argon2id hash.

Never store plaintext passwords, custom cryptographic formats, reusable password material, or passwords in audit logs.

## 8. Required evidence

Every phase must write raw output and a parsed result. Required artifacts include:

```text
artifacts/00-tooling.json
artifacts/s1-gitleaks.json
artifacts/s2-deps.json
artifacts/s3-env-scope.json
artifacts/s4-rls.json
artifacts/s6-ratelimit.json
artifacts/s7-client-isolation.json
artifacts/s8-fingerprint.json
artifacts/s9-sri.json
artifacts/s-audit-chain.json
```

If a tool, secret, staging target, or device is unavailable, record `NOT_VERIFIED` with the exact reason. Never create simulated measurements.

## 9. Required validation commands

```powershell
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun test
bun run build:admin
bun run build:client
bun run build:selfhost
bun run test:e2e
bun run verify:rls
bun run verify:audit-chain
bun run audit:v22
```

## 10. Required final report

Produce:

- executive summary;
- overall score and category scores;
- verdict and score-ceiling application;
- critical/high/medium/low/informational findings;
- exploit and bypass scenarios;
- architecture, API, upload, cryptography, secrets, RLS, Cloudflare, R2, Supabase, rate-limit, performance, observability, DR, incident-response, ethical-use, and handover reviews;
- missing tests and documentation;
- remediation roadmap with owners and dependencies;
- explicit `NOT_VERIFIED` section;
- production go/no-go decision.

The final report must not claim production readiness until all mandatory high-risk controls have external evidence and all critical/high findings are closed or formally accepted by the responsible owner.

