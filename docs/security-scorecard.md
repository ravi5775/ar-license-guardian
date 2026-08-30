# Security Scorecard

## Verified security subsystems

| Topic | Score | Evidence |
|---|---:|---|
| JWT / signing | 8 | Design and scripts indicate use of signed tokens and key management |
| Ed25519 manifest signing | 8 | [scripts/sign-manifest.mjs](../scripts/sign-manifest.mjs) |
| Origin binding | 8 | [docs/status-audit-2026-08-21.md](status-audit-2026-08-21.md) and migration design |
| RLS | 8 | [supabase/client-schema.sql](../supabase/client-schema.sql) |
| Kill switch | 8 | `revoked_builds` migration files |
| Audit logging | 8 | schema and admin dashboards |
| Secret handling | 6 | repo audit explicitly flags some lingering module-scope practices |
| Customer delivery safety | 8 | [scripts/strip-client-app.sh](../scripts/strip-client-app.sh) |

## High-risk findings

1. Historical Git exposure remains a risk if the customer branch is not reconstructed from a fresh repo.
2. Some secret reads are still documented as module-scope risks in the repo’s own working audit.
3. The final real-world exploitability of certain edge controls is not proven against a live environment in this session.

## False positives or not-yet-proven claims

- "Fully production secure" is not verified.
- "Completely leak-free in all commits" is not verified.
- "Customer package is 100% safe in every environment" is not verified.

## Overall security grade

B

Reason: good design intent and guardrails, but final assurance requires operational hardening and deployment validation.
