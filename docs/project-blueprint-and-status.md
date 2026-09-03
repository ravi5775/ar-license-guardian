# Aether AR — Blueprint, Status & Drawbacks

Last updated: 2026-09-03. Single reference for what the product is, what is actually
verified today, and what is still open. Nothing here is marked verified unless a tool
produced evidence for it.

## 1. What the product is

A white-label WebAR platform sold to Indian-market clients as a **one-time fee**
(₹30k–₹50k) source delivery. The client hosts it on their own Cloudflare Pages + R2 +
Postgres and pays their own running costs. Anti-resale is enforced by deployment-instance
licensing, not by DRM on end users.

| Layer | Choice |
| --- | --- |
| App | TanStack Start v1 (React 19, Vite 7), edge/Worker runtime |
| Data | Supabase Postgres with RLS; adapter layer also supports Neon and plain Postgres |
| Storage | Private R2/Supabase storage, signed URLs only, one-time nonce redemption |
| AR (marker) | Self-hosted MindAR + A-Frame, no third-party CDN |
| AR (markerless) | WebXR hit-test on Android/Chrome, USDZ Quick Look fallback on iOS |
| Licensing | Ed25519-signed licence tokens, device/instance slots, 72h grace, presign gating |

### Branches

- `main` — issuer/vendor build (licence issuing, admin tooling).
- `self-hosted` — same code, different runtime/DB/rate-limit/licence env.
- `client-app` — produced by `scripts/strip-client-app.sh`, verified by
  `scripts/verify-client-branch.mjs`. Customer routes kept: Overview, Projects,
  AR Experiences, Albums, Analytics, Marker Testing, Room Catalogs.

## 2. Feature status

| Area | Status |
| --- | --- |
| Auth, admin approval gate, TOTP step-up | Built |
| Per-owner RLS on experiences/albums/projects/catalogs | Built, regression-tested |
| PIN + signed QR token content access | Built |
| Private media delivery, one-time nonce redemption | Built |
| Licence activation/refresh/release/status/manifest APIs | Built |
| Presign gating tied to licence state | Built, on by default for client builds |
| Marker AR + multi-target albums | Built |
| Room AR (markerless) catalogs + `/room/$catalog` | Built (pilot scope) |
| Analytics + scan/placement events | Built |
| Audit harness P00–P20 | Built; see section 4 |
| Disaster-recovery restore proof | Script exists, not executed against real backup |

## 3. Fixed in this pass

- **Catalog item edit created duplicates.** `saveCatalogItem` used a Zod schema without
  `id`, so the id was stripped before the upsert and every save inserted a new row.
  It now branches: with an `id` it does an RLS-scoped `UPDATE` (a row belonging to
  another account matches nothing and returns a clear error), without an `id` it inserts.
- **P17 bundle stage** now analyses `dist/client`, and budgets application JS
  (default 3 MB) separately from the self-hosted vendored AR runtime, which is
  reported as its own metric instead of masking app bloat.
- **P00 metric emission** produced malformed JSON for `largeFiles`.
- **P19 contract alignment** failure was real: `LICENSE_AGREEMENT.md` had no one-time-fee
  clause. Added, and P19 now passes.
- `.github/workflows/audit-stages.yml` (seven dependency-ordered job groups) and
  `scripts/audit/schemas/*.schema.json` written.

## 4. Audit status (local run, this commit)

Contract: exit 0 = PASS, 1 = FAIL, 2 = NOT_VERIFIED. A missing tool or credential is
always NOT_VERIFIED — never a fabricated PASS. 21 stages aggregate; P20 is the
aggregator and is excluded from its own denominator.

| Stage | Status | Note |
| --- | --- | --- |
| P00 Repository Integrity | PASS | |
| P01 Build & Static Quality | PASS | 0 eslint errors, typecheck clean |
| P02–P08 Smoke / lifecycle / load | NOT RUN | need `BASE_URL`; P04–P08 also need `AUDIT_ALLOW_HEAVY_LOAD=1` |
| P09, P09b, P10 Database & RLS | NOT RUN | local-only DB credentials by policy |
| P11 Security & Abuse | PASS | |
| P12, P13 Clone detection, presign | NOT RUN | need staging |
| P14 Cloudflare Pages gate | NOT RUN | needs CF token, local-only |
| P15 Disaster recovery | NOT RUN | needs disposable DB |
| P16 Delivery Package | PASS | |
| P17 Bundle | PASS | app JS within budget; vendor AR runtime ~5.2 MB, lazy on AR routes |
| P18 Supply Chain | NOT_VERIFIED | `osv-scanner` not installed |
| P19 Contract Alignment | PASS | |

Current aggregate: 6 PASS, 0 FAIL, 1 NOT_VERIFIED, 14 NOT RUN → 28%, verdict FAIL
purely because most stages have not been executed. CI caps at CONDITIONAL_PASS by
design (see `docs/audit-ci-scope.md`).

## 5. Drawbacks and open risks

**Commercial / licensing**
1. Anti-resale is deterrent-grade, not tamper-proof: a determined buyer with the source
   can strip licence checks. Contract and watermarking are the real backstop.
2. Support and updates are separately priced but not yet mechanised (no entitlement check
   on updates).
3. Git history of the delivery branch still contains issuer code — deliver squashed,
   per-customer repos only.

**Operational**
4. Disaster recovery has never been proven end-to-end on a real backup.
5. No enforced bandwidth/egress ceiling on the client side beyond accounting; a viral
   album can generate an unexpected R2 bill for the customer.
6. Free-tier Postgres pausing and cold starts are unmitigated for the smallest deployments.

**Technical**
7. Vendored AR runtime is ~5.2 MB. Lazy-loaded, but first AR load on a slow 4G
   connection is heavy.
8. Room AR is a pilot: one item at a time, no occlusion, no saved layouts, iOS placement
   quality is Apple's Quick Look and cannot be tuned.
9. Room AR needs GLB **and** USDZ per SKU — the content pipeline, not the code, is the
   bottleneck (see `docs/room-ar-content.md`).
10. The catalog dashboard lists items via the public `listCatalogItems` reader, so
    inactive items are invisible to their own owner in the editor.
11. 140 eslint warnings remain (mostly `any` in catalog/AR glue code).
12. No end-to-end browser test covers the room-AR placement flow.

## 6. Next actions, in order

1. Point the audit at a staging deployment: set `BASE_URL`, run P02/P03, then authorise
   P04–P08 with `AUDIT_ALLOW_HEAVY_LOAD=1`.
2. Run P09/P09b/P10/P14/P15 locally with the credentials that never enter CI.
3. Install `osv-scanner` and clear P18.
4. Execute a real DR restore and attach the evidence to P15.
5. Give the catalog dashboard an owner-scoped item reader so inactive items are editable.
6. Add an e2e test for the room-AR catalog edit flow to lock in the duplicate-item fix.
