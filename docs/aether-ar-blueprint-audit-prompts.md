# Aether AR Blueprint Audit Prompts

These prompts audit the repository against the authoritative [BLUEPRINT.md](../BLUEPRINT.md). They generate evidence-backed audit logs; they do not redesign the system or assume that a documented feature is implemented. The complete pack produces 60 audit logs, including 10 infrastructure and DevSecOps reports.

## Audit Log Contract

Every generated log must be written under `docs/audit-logs/` and use this structure:

```markdown
# <Audit title>

## Status
PASS / PARTIAL / FAIL / NOT IMPLEMENTED

## Blueprint Requirement
Quote the exact requirement from `BLUEPRINT.md`.

## Repository Evidence
- Files inspected:
- Functions inspected:
- Routes inspected:
- Migrations inspected:
- Tests inspected:
- Workflows/scripts inspected:

## Findings
Only verified findings. Distinguish implemented, partial, missing, and unverified behavior.

## Risk
Critical / High / Medium / Low

## Fix Required
Exact file or workflow changes required.

## Suggested Commit
feat: ...
fix: ...
docs: ...
test: ...
```

Use `NOT IMPLEMENTED` when no implementation evidence exists. Use `PARTIAL` when only part of a requirement is proven. Never count skipped tests or unavailable credentials as passing evidence.

## Phase 1: Blueprint Compliance

### 01. Master Blueprint Compliance

Audit the repository section by section against `BLUEPRINT.md`: product boundaries, architecture, provisioning, publishing, guest playback, licensing, application modules, data model, security, release, operations, verification, current status, and Definition of Done. Generate `docs/audit-logs/01-blueprint-compliance.md`. Mark every requirement PASS, PARTIAL, FAIL, or NOT IMPLEMENTED with exact evidence.

### 02. Customer Provisioning

Audit the Section 3.1 provisioning journey. Verify customer creation, license creation, deployment/database/storage setup, admin bootstrap, MFA enrollment, smoke tests, and handover documentation. Inspect migrations, scripts, workflows, and runbooks. Generate `docs/audit-logs/02-customer-provisioning.md`.

### 03. Guest Playback

Trace QR or public URL entry through route resolution, license activation, manifest verification, signed media URLs, MindAR, direct-video fallback, and analytics. Generate `docs/audit-logs/03-guest-playback.md`.

### 04. Content Publishing

Audit asset upload signing, MIME and metadata validation, tenant-scoped paths, inactive-to-published state transitions, preview, QR generation, and public active-only visibility. Generate `docs/audit-logs/04-content-publishing.md`.

### 05. License Lifecycle

Audit manifest generation, Ed25519 signing, build hash, device fingerprint, activation, refresh, suspension, revocation, expiry, and documented grace behavior. Trace both client and server paths. Generate `docs/audit-logs/05-license-lifecycle.md`.

### 06. Product Boundaries

Audit authorization separation between Guest, Customer Operator, Customer Administrator, and Vendor Operator. Identify unauthorized routes, server functions, database policies, and storage paths. Generate `docs/audit-logs/06-product-boundaries.md`.

### 07. Module Inventory

Inventory public routes, dashboard, auth, MFA, albums, catalogs, QR, audit history, diagnostics, vendor worker, and operational scripts. Map each module to `BLUEPRINT.md` and report missing or partial modules. Generate `docs/audit-logs/07-module-inventory.md`.

### 08. Data Model

Compare migrations and application queries with the blueprint entities: profiles, roles, catalogs, catalog items, albums, experiences, media, activations, scan events, audit events, licenses, and release manifests. Generate `docs/audit-logs/08-data-model.md`.

### 09. Definition of Done

Audit every Definition of Done requirement. Produce a checklist with exact evidence, status, risk, and missing acceptance tests. Generate `docs/audit-logs/09-definition-of-done.md`.

### 10. Current Status

Verify the Working Foundation, P0, P1, and P2 items in Section 10 against the repository. Do not upgrade a status without implementation or test evidence. Generate `docs/audit-logs/10-current-status.md`.

## Phase 2: Security

### 11. Security Controls

Audit CSP, security headers, HSTS, authentication, MFA, signed URLs, manifest signatures, rate limits, audit logging, revocation, and session/device binding. Generate `docs/audit-logs/11-security-controls.md`.

### 12. Secrets

Find every environment variable and secret read. Classify each as runtime-safe, module-scope, client-exposed, or server-only. Report exact files and unsafe exposure paths. Generate `docs/audit-logs/12-secrets-audit.md`.

### 13. RLS

Audit every Supabase table for RLS enablement, policies, owner isolation, public reads, admin access, and service-role usage. Include positive and negative authorization evidence. Generate `docs/audit-logs/13-rls-audit.md`.

### 14. Upload Security

Audit MIME validation, size validation, filename/path traversal defenses, tenant path isolation, signed URL expiry, overwrite behavior, and unauthorized upload attempts. Generate `docs/audit-logs/14-upload-security.md`.

### 15. Manifest Verification

Audit signed manifest creation and verification. Explicitly test missing keys, malformed signatures, wrong customer/build/hash, expired manifests, and unavailable authority. Identify every fail-open path. Generate `docs/audit-logs/15-manifest-verification.md`.

### 16. Token and JWT Security

Audit token expiration, refresh, replay resistance, origin binding, storage, logout/invalidation, clock skew, and server-side verification. Generate `docs/audit-logs/16-jwt-audit.md`.

### 17. Device Fingerprinting

Trace device fingerprint generation, storage, validation, rotation, privacy handling, and spoofing resistance. Generate `docs/audit-logs/17-device-fingerprint.md`.

### 18. Revocation

Audit revoked-build and revoked-license behavior for activation denial, media denial, token expiry, grace handling, offline transitions, and reconnect. Generate `docs/audit-logs/18-revocation.md`.

### 19. Audit Log Integrity

Audit append-only behavior, actor attribution, timestamps, sensitive actions, tamper resistance, retention, and administrator visibility. Generate `docs/audit-logs/19-audit-log-integrity.md`.

### 20. OWASP Review

Audit the repository against OWASP Top 10. Report only evidence-backed vulnerabilities, affected paths, exploit preconditions, risk, and exact remediation. Generate `docs/audit-logs/20-owasp-audit.md`.

## Phase 3: Release Pipeline

### 21. Release Pipeline

Audit the Section 7 sequence from clean checkout through artifact retention. Verify every stage exists and is enforced. Generate `docs/audit-logs/21-release-pipeline.md`.

### 22. Client Bundle

Audit the generated client bundle for issuer code, private keys, service-role credentials, forbidden imports, and server-only modules. Generate `docs/audit-logs/22-client-bundle.md`.

### 23. Manifest Generation

Audit `scripts/sign-manifest.mjs` and related code. Verify customer ID, build ID, release hash, asset digest, timestamps, expiry, signature, and output format. Generate `docs/audit-logs/23-manifest-generation.md`.

### 24. Build Identity

Audit injection and validation of customer ID, build ID, release hash, and asset digest across local, CI, and deployment builds. Generate `docs/audit-logs/24-build-identity.md`.

### 25. Environment Variables

Inventory required, optional, unused, and missing variables across application code, scripts, workflows, and deployment documentation. Identify client exposure. Generate `docs/audit-logs/25-env-audit.md`.

### 26. Smoke Tests

Audit deployment smoke tests for authentication, activation, refresh, uploads, public playback, revocation, and rollback. Distinguish implemented checks from placeholders. Generate `docs/audit-logs/26-smoke-tests.md`.

### 27. Rollback

Audit immutable artifact retention, deployment history, rollback commands, database compatibility, and rollback verification. Generate `docs/audit-logs/27-rollback.md`.

### 28. Release Workflows

Audit GitHub Actions release workflows for triggers, permissions, environment protection, dependency pinning, artifact integrity, and failure handling. Generate `docs/audit-logs/28-release-workflows.md`.

### 29. Deployment Secrets

Audit GitHub Actions and deployment secret usage. Verify secrets are not logged, passed into client bundles, or exposed through artifacts. Generate `docs/audit-logs/29-deployment-secrets.md`.

### 30. Release Readiness

Generate a final release readiness report. Mark PASS only when the complete Section 7 sequence and required evidence are present. Generate `docs/audit-logs/30-release-readiness.md`.

## Phase 4: Test Evidence

### 31. Test Inventory

Inventory every test under `tests/`, `e2e/`, and other configured test directories. Map each test to a blueprint requirement and identify untested behavior. Generate `docs/audit-logs/31-test-inventory.md`.

### 32. RLS Tests

Audit RLS tests for owner success, cross-tenant denial, admin behavior, public active-only reads, inactive denial, and service-role boundaries. Generate `docs/audit-logs/32-rls-tests.md`.

### 33. API Contract Tests

Audit activation, manifest, upload, presigning, refresh, and revocation contract tests. Include malformed input, unauthorized access, expiry, and error response assertions. Generate `docs/audit-logs/33-api-contract-tests.md`.

### 34. Playwright Coverage

Audit browser coverage against the blueprint gates: login, MFA, publishing, catalog editing, inactive-item recovery, QR navigation, media access, and failure states. Generate `docs/audit-logs/34-playwright-audit.md`.

### 35. Security Regression Tests

Map security regression tests to each Section 6 control. Identify controls with no executable evidence. Generate `docs/audit-logs/35-security-regression.md`.

### 36. Coverage

Generate a coverage report and list uncovered security, authorization, licensing, release, and storage code. Do not treat line coverage alone as behavioral proof. Generate `docs/audit-logs/36-coverage.md`.

### 37. Upload Tests

Audit upload tests for MIME, size, path traversal, tenant isolation, expiry, overwrite, malformed metadata, and unauthorized access. Generate `docs/audit-logs/37-upload-tests.md`.

### 38. Rate Limit Tests

Audit rate-limit tests for activation, refresh, public lookup, presigning, IP abuse, device abuse, and reset-window behavior. Generate `docs/audit-logs/38-rate-limit-tests.md`.

### 39. License Runtime Tests

Audit client/server tests for activation, refresh, expiry, revocation, malformed tokens, wrong build identity, offline behavior, and reconnect. Generate `docs/audit-logs/39-license-runtime-tests.md`.

### 40. Mandatory Gates

Audit every mandatory gate in Section 9. PASS only when an executable test or verified deployment record exists. Generate `docs/audit-logs/40-mandatory-gates.md`.

## Phase 5: Operations

### 41. Logging

Audit structured logging for authentication, licensing, uploads, media, public routes, failures, actor identity, timestamps, and correlation IDs. Generate `docs/audit-logs/41-logging.md`.

### 42. Alerting

Audit alert conditions for activation spikes, presign denials, quota exhaustion, auth abuse, storage failures, and signature/configuration errors. Generate `docs/audit-logs/42-alerting.md`.

### 43. Backups

Audit backup scripts and configuration for encryption, scope, retention, access control, scheduling, integrity, and restore prerequisites. Generate `docs/audit-logs/43-backups.md`.

### 44. Restore

Audit restore workflow, isolation, validation, measured RTO/RPO, data loss handling, and documented operator commands. Generate `docs/audit-logs/44-restore.md`.

### 45. Incident Response

Audit incident response documentation for triage, containment, license revocation, credential rotation, customer communication, evidence preservation, and post-incident review. Generate `docs/audit-logs/45-incident-response.md`.

### 46. Key Rotation

Audit signing-key generation, storage, rotation, overlap, manifest migration, revocation, emergency replacement, and verification. Generate `docs/audit-logs/46-key-rotation.md`.

### 47. Customer Handover

Audit handover documentation for domains, billing, secrets, backups, ownership, support boundaries, upgrade process, and operational limits. Generate `docs/audit-logs/47-customer-handover.md`.

### 48. Support Boundaries

Audit ownership and escalation boundaries between vendor, customer administrator, hosting provider, storage provider, and license authority. Generate `docs/audit-logs/48-support-boundaries.md`.

### 49. Operational Readiness

Audit the operational readiness checklist against executable evidence, not claims in reports. Generate `docs/audit-logs/49-operational-readiness.md`.

### 50. Production Readiness

Generate the final production-readiness audit against the Definition of Done. PASS only when provisioning, publishing, guest use, revocation, backup restore, rollback, and mandatory gates are all proven. Generate `docs/audit-logs/50-production-readiness.md`.

## Phase 6: Infrastructure and DevSecOps

### 51. GitHub Rulesets and Branch Protection

Audit GitHub rulesets, branch protection, required checks, review requirements, bypass permissions, and deployment environments. Generate `docs/audit-logs/51-github-rulesets-branch-protection.md`.

### 52. SBOM and Dependency Inventory

Audit dependency manifests, lockfiles, vulnerability scanning, SBOM generation, severity thresholds, and release artifact retention. Generate `docs/audit-logs/52-sbom-dependency-inventory.md`.

### 53. Secrets Scan

Audit Gitleaks/TruffleHog or equivalent repository and generated-bundle secret scanning. Verify baseline handling, redaction, PR blocking, and release enforcement. Generate `docs/audit-logs/53-secrets-scan.md`.

### 54. Supply Chain Provenance

Audit SLSA provenance, Cosign signing, artifact attestations, verification, and retention. Generate `docs/audit-logs/54-supply-chain-provenance.md`.

### 55. Docker and Self-hosted Security

Audit self-hosted Dockerfiles, compose files, image pinning, non-root execution, capabilities, network exposure, volumes, backups, and image scanning. Generate `docs/audit-logs/55-docker-self-hosted-security.md`.

### 56. Cloudflare Pages Security

Audit Pages and Worker deployment configuration, preview protection, environment separation, WAF/rate limits, headers, domains, and rollback evidence. Generate `docs/audit-logs/56-cloudflare-pages-security.md`.

### 57. R2 Bucket Permissions

Audit R2 bucket policies, public access, CORS, lifecycle rules, credential scope, tenant paths, and signed URL behavior. Generate `docs/audit-logs/57-r2-permissions.md`.

### 58. Performance Benchmarks

Audit Lighthouse, k6, mobile performance, AR startup, activation, presigning, and public playback benchmarks. Generate `docs/audit-logs/58-performance-benchmarks.md`.

### 59. Observability

Audit logs, metrics, traces, correlation IDs, dashboards, SLOs, alert routing, redaction, and validation drills. Generate `docs/audit-logs/59-observability.md`.

### 60. Executive Report

Generate a CTO/CISO report summarizing evidence, implementation status, runtime gaps, P0 conditions, and the production decision. Generate `docs/audit-logs/60-executive-report.md` and `docs/audit-logs/EXECUTIVE-CTO-CISO-REPORT.md`.

## Automatic Generator Prompt

Use this prompt in an agent that can inspect and write the repository:

```text
# Aether AR Blueprint v7.0 Audit Log Generator

You are auditing the repository, not redesigning it.

Use the root BLUEPRINT.md as the single source of truth. Generate all 60 audit
logs described in docs/aether-ar-blueprint-audit-prompts.md under
/docs/audit-logs/.

For every log:
- Quote the exact matching requirement from BLUEPRINT.md.
- Inspect implementation, routes, functions, migrations, tests, workflows, and scripts as applicable.
- Record exact evidence and distinguish verified, partial, missing, and unverified behavior.
- Use PASS, PARTIAL, FAIL, or NOT IMPLEMENTED.
- FAIL is allowed only when repository evidence proves a requirement is broken or absent.
- If implementation exists but execution requires unavailable credentials, tooling, or provider access, use PARTIAL and state "Runtime verification pending".
- Use NOT IMPLEMENTED only when no implementation evidence exists anywhere in the repository.
- Never invent features or infer success from documentation alone.
- Treat skipped tests, unavailable credentials, and unexecuted deployment steps as not proven.
- Include risk, exact fix files, and a suggested commit for every partial or failed requirement.

Also generate /docs/audit-logs/AUDIT_INDEX.md containing:
- Counts of PASS, PARTIAL, FAIL, and NOT IMPLEMENTED logs.
- Blueprint compliance percentage, with the calculation explained.
- P0, P1, and P2 issues copied exactly from BLUEPRINT.md Section 10.
- A list of evidence gaps and skipped checks.
- The audit date, commit SHA, and tools/commands used.
- Repository Implementation %, Runtime Verification %, and Production Readiness % as separate metrics.
- A link to the CTO/CISO executive report.

Do not modify application code while generating the audit logs. If an issue is
found, document it only and propose the smallest exact fix.
```

## Audit Operating Rules

- Run against a clean commit and record the commit SHA.
- Keep generated logs separate from implementation changes.
- Re-run failed or partial logs after each remediation batch.
- Never claim production readiness from static inspection alone.
- Review generated findings before using them as release evidence.
