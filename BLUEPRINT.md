# Aether AR End-to-End Blueprint

**Status:** Pre-production reference architecture
**Version:** 7.0
**Last reviewed:** September 2026
**Owner:** Aether AR

## 1. Purpose and Product Contract

Aether AR is a white-label web platform that lets a customer attach video and
3D content to printed photos, cards, albums, catalog items, and QR codes. A
guest scans a code, opens a mobile web experience, grants camera access when
needed, and views the published content through WebAR or a direct-video
fallback.

The commercial offer is a deployed customer instance with optional branding,
training, and maintenance. The customer owns its content and operating costs.
Aether AR owns the product source, release process, licensing authority, and
security obligations described in this document.

### Product boundaries

- **Guest:** consumes published AR experiences without an account.
- **Customer operator:** manages content, catalogs, albums, QR codes, and
   analytics from the authenticated dashboard.
- **Customer administrator:** manages users, approvals, MFA, and operational
   settings.
- **Vendor operator:** provisions customers, signs releases, manages licenses,
   monitors abuse, and handles revocation.

The authoritative implementation stack is TanStack Start, React, TypeScript,
Supabase Auth/Postgres/Storage, Cloudflare deployment services, R2-compatible
media storage, MindAR/A-Frame, and signed license manifests. Any document that
describes another stack is historical and must be updated or removed.

## 2. System Architecture

```text
Guest browser
   -> customer web deployment
       -> public experience/catalog routes
       -> authenticated dashboard and server functions
       -> customer database and media storage
       -> vendor license authority

Vendor release pipeline
   -> signed client bundle
   -> signed release manifest
   -> customer deployment
```

### Ownership boundaries

| Boundary | Responsibility |
|---|---|
| Vendor authority | License records, build manifests, signing keys, revocation, abuse controls |
| Customer deployment | Users, projects, experiences, catalogs, media, scans, analytics |
| Browser client | Rendering, camera lifecycle, local token state, graceful fallback |
| Database policies | Tenant isolation and row-level authorization |
| Storage gateway | Short-lived signed upload/download URLs and asset authorization |

The customer deployment must not contain vendor private keys, service-role
credentials, or unrestricted storage credentials. Runtime configuration must be
loaded in an edge-compatible way rather than captured accidentally at module
initialization.

## 3. End-to-End Journeys

### 3.1 Customer provisioning

1. Vendor creates a customer record and license policy.
2. Vendor provisions the customer repository, deployment, database, storage,
    domain, and environment configuration.
3. Database migrations and RLS policies are applied.
4. A first administrator is created and required to enroll MFA.
5. Vendor registers the customer ID, build ID, release hash, and asset digest.
6. Automated smoke tests verify login, dashboard access, upload signing,
    public delivery, license activation, and revocation behavior.
7. Vendor hands over the deployment URL, admin instructions, operating limits,
    backup policy, and support contacts.

### 3.2 Content publishing

1. Operator creates an experience, album, or catalog.
2. Operator uploads validated GLB, USDZ, video, thumbnail, and marker assets.
3. The server scopes upload paths to the authorized tenant and returns a
    short-lived signed upload URL.
4. Metadata is validated, ownership is recorded, and the item remains inactive
    until complete.
5. Operator previews the content, publishes it, and generates a QR code.
6. Public routes expose active content only.

### 3.3 Guest playback

1. Guest scans a QR code or opens a public URL.
2. The route resolves the active experience, album, or catalog item.
3. The client verifies its signed build manifest and activates the license.
4. The server authorizes the device/build and issues short-lived media URLs.
5. The guest uses MindAR/WebAR when supported, or direct video/fallback camera
    mode when tracking or browser support is unavailable.
6. Playback and scan events are recorded without exposing private customer data.

### 3.4 License lifecycle

1. Vendor issues a license with customer identity, allowed build policy, limits,
    status, and expiry.
2. Release automation signs a manifest containing customer ID, build ID, release
    hash, and asset digest.
3. Client activation validates the license, device fingerprint, origin, build,
    and manifest.
4. Refresh extends a valid session subject to rate limits and policy.
5. Suspension or revocation prevents new activation and new protected media
    delivery.
6. Existing browser state is allowed to expire according to the documented
    grace policy; no undocumented permanent offline entitlement exists.

## 4. Application Modules

- Public AR experience, album, scan, and catalog routes.
- Auth, approval, role management, and mandatory administrator MFA.
- Dashboard for experiences, albums, catalogs, assets, QR codes, activations,
   analytics, diagnostics, and audit history.
- Catalog item editing that updates existing rows in place and preserves active
   and inactive visibility for authorized owners.
- Server functions for tenant-scoped CRUD, upload signing, event logging, and
   license-gated media delivery.
- Vendor worker and scripts for provisioning, key generation, manifest signing,
   release verification, backup, restore, and deployment smoke testing.

## 5. Data and Authorization Model

Core entities include profiles, user roles, design catalogs, catalog items,
experiences, albums, media metadata, activations, scan events, audit events,
licenses, and release manifests.

Required rules:

- Every customer-owned row has an owner or tenant boundary.
- RLS is enabled on every customer table and tested against both owner and
   cross-tenant access.
- Public reads return active, intentionally published content only.
- Vendor license data is never directly readable by customer browsers.
- Upload and download paths are tenant-scoped and time-limited.
- Deletes and status changes are audited.
- Service-role access is limited to server-side jobs and never shipped to the
   browser.

## 6. Security and Privacy Controls

- Strict security headers and CSP appropriate for camera, WebAR, media, and
   approved storage origins.
- Supabase Auth with approval checks, role separation, and TOTP MFA for admins.
- Server-side authorization on every mutation; UI hiding is not authorization.
- Rate limits and abuse detection on activation, refresh, public lookup, and
   signed URL endpoints.
- Ed25519-signed manifests and license tokens with default-deny verification.
- Short-lived signed media URLs, device/session binding, and revocation checks.
- Input validation for slugs, metadata, asset types, dimensions, and filenames.
- Append-only audit records for authentication, publishing, licensing, and
   administrative actions.
- Data minimization, retention limits, DPA coverage, and documented deletion
   procedures.

## 7. Release and Deployment Pipeline

Every customer release follows this sequence:

1. Start from a clean, reproducible checkout.
2. Install locked dependencies and validate required environment variables.
3. Run typecheck, lint, unit tests, security tests, RLS tests, and Playwright
    tests.
4. Build with customer ID, build ID, release hash, and asset digest injected.
5. Verify the client bundle contains no issuer secrets or forbidden server code.
6. Generate and sign the release manifest.
7. Publish the immutable artifact and manifest.
8. Run smoke tests for authentication, activation, refresh, upload signing,
    public delivery, revocation, and rollback.
9. Record release metadata and retain the previous known-good artifact.

Required deployment variables must be documented and checked before build.
Missing signing keys, customer identity, release identity, or manifest data are
hard failures, never warnings.

## 8. Operations and Recovery

- Structured logs for auth, license, upload, media, and public-route failures.
- Alerts for activation spikes, presign denials, quota exhaustion, auth abuse,
   storage failures, and signature/configuration errors.
- Daily encrypted backups with retention and access review.
- Scheduled restore verification with measured RTO and RPO.
- Key rotation, emergency revocation, compromised-device, and customer-offline
   runbooks.
- Staged deployments, health checks, rollback instructions, and incident review.
- Customer handover includes ownership, billing, domains, secrets, backups,
   support boundaries, and upgrade responsibilities.

## 9. Verification Plan

### Automated gates

- TypeScript compilation and lint.
- Unit and security regression tests.
- Mandatory RLS tests with a real isolated database.
- API contract tests for activation, manifest, presigning, and revocation.
- Browser tests for login, MFA, publishing, catalog editing, inactive-item
   recovery, QR navigation, and media access.
- Clean client build and secret-scanning verification.

### Device and deployment gates

- iOS Safari and Android Chrome camera permission flows.
- WebAR tracking, direct-video fallback, autoplay, fullscreen, and lifecycle.
- Offline, reconnect, token expiry, and revoked-license behavior.
- Fresh customer provisioning from empty infrastructure.
- Backup restore and rollback from a failed release.

No release is production-ready when any mandatory gate is skipped. A test that
depends on unavailable credentials must be reported as not run, not counted as
passing.

## 10. Current Status and Priorities

### Working foundation

- TanStack Start application, public AR routes, dashboard, authentication,
   catalog/album/experience flows, storage signing, license runtime, security
   headers, and substantial security regression coverage.
- Customer-owned catalog editing and active/inactive item workflows are covered
   by focused E2E tests, pending configured Supabase credentials.

### P0 before commercial release

- Select and enforce one deployment topology across code and documentation.
- Fix release-time build identity and manifest injection.
- Make manifest verification fail closed.
- Remove edge-unsafe module-scope secret reads.
- Make RLS and end-to-end deployment tests mandatory in CI.
- Prove one clean customer deployment from provisioning through revocation.

### P1 before scaling beyond pilot customers

- Complete measured restore and rollback drills.
- Finish real-device AR and offline behavior testing.
- Add tenant-level usage limits, alerting, and support diagnostics.
- Complete attorney review of license, privacy, DPA, and handover documents.
- Automate customer provisioning and release promotion.

### P2 product expansion

- White-label theme configuration.
- Multi-target analytics and richer catalog workflows.
- Reseller tools, mobile wrappers, and additional AR authoring features.

## 11. Definition of Done

Aether AR is ready for a paid customer only when a new tenant can be provisioned
from documented inputs, an administrator can securely publish content, a guest
can consume it on supported devices, license revocation works, backups restore,
rollback succeeds, and all mandatory automated gates pass in a clean
environment.

Until then, the project is a strong pre-production platform, not a fully proven
commercial handover system.
# Aether AR — Commercial Blueprint
## Zero-Investment → ₹30 Lakh/Year AR Photo Platform

---

## 1. Executive Summary

**Product:** Aether AR is a white-label-ready AR photo platform. Clients (event photographers, print shops, gift stores, wedding agencies in India) buy a fully deployed instance for a **one-time fee of ₹30,000**. They then own the deployment, pay their own infra bills, and operate it independently.

**Founder Model:** We build once, sell the same codebase repeatedly, and charge for setup/customization. No recurring revenue per client unless they opt into a maintenance retainer.

**Current Stack:** TanStack Start (React 19 + SSR), Cloudflare Pages/Workers, Supabase (Auth + Postgres + Storage), MindAR + A-Frame, R2/S3-compatible storage.

**Live Demo:** https://aetherphoto.shop

---

## 2. Business Model

### 2.1 Pricing
| Tier | Price | What the client gets |
|------|-------|----------------------|
| **Base License** | ₹30,000 one-time | Deployed instance, admin dashboard, AR viewer, QR generator, license activation |
| **Customization** | ₹5,000–₹20,000 | Custom domain, branded UI, extra pages, custom marker design |
| **Annual Maintenance** | ₹6,000–₹12,000/year (optional) | Updates, security patches, priority support |
| **Training/Onboarding** | ₹3,000 | 1-hour Zoom + documentation handover |

### 2.2 Anti-Resale Protection
- Each sold instance is **fingerprinted** to the client's deployment (domain + Vercel/Cloudflare project ID + Supabase project ref).
- A **vendor-worker** (Cloudflare Worker + D1) acts as an independent license authority.
- If the client tries to clone/resell the project, the license check fails on the new domain/project fingerprint.
- **90-day vendor-unreachable fallback:** If our license server is down for 90 days, the instance self-activates so the client is never locked out.

### 2.3 Why This Pricing Works in India
- Competitors (8th Wall, Zappar, Onirix) charge $50–$500/month per experience.
- A one-time ₹30k (~$360) is 6–18 months of competitor pricing, but clients own it forever.
- Target: 10 clients/month → ₹36L/year revenue with near-zero marginal cost.

---

## 3. Technical Architecture

### 3.1 Frontend
- **Framework:** TanStack Start v1 (React 19, file-based routing, SSR/SSG)
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **State:** TanStack Query for server state, React hooks for UI state
- **AR Engine:** MindAR + A-Frame (open-source, no per-use fees)
- **QR Scanning:** @zxing/browser (in-app scanner, no external app needed)

### 3.2 Backend
- **Auth & Database:** Supabase (Postgres + Row-Level Security)
- **Server Logic:** TanStack `createServerFn` (edge-compatible server functions)
- **Public API:** `/api/public/license/activate` for device/instance activation
- **External Authority:** `vendor-worker/` Cloudflare Worker + D1 for license validation

### 3.3 Storage
- **AR Media:** Supabase Storage bucket `ar-media` (or R2 for cost savings)
- **Marker Files:** `.mind` marker files uploaded by admin
- **Static Assets:** Cloudflare Pages / Vercel CDN

### 3.4 Security Layers
- **CSP + Security Headers:** Strict Content-Security-Policy, X-Frame-Options, HSTS
- **Rate Limiting:** Progressive rate limits per IP and per fingerprint on license API
- **TOTP MFA:** Mandatory for admin accounts
- **RLS:** Every table has Row-Level Security; admin checks via `user_roles` table
- **Bot Detection:** Honeypot + timing analysis on public license endpoint

---

## 4. Database Schema

### 4.1 Core Tables
```
profiles (id, email, full_name, created_at)
user_roles (id, user_id, role)  -- separate table, never on profiles
ar_experiences (id, slug, title, cover_image_url, media_url, marker_mind_path, owner_id, is_active)
licenses (id, license_key, client_name, fingerprint, max_activations, is_active, expires_at)
license_activations (id, license_key, fingerprint, ip_address, activated_at)
audit_log (id, user_id, action, metadata, created_at)
rate_limit_hits (id, key, window, count, created_at)
```

### 4.2 Security Rules
- `profiles`: users read only their own row; admins read all
- `user_roles`: only service_role can write; authenticated users can read own roles via security-definer helper
- `ar_experiences`: admins CRUD; public read only active experiences
- `licenses`: service_role only; no direct client access
- `audit_log`: append-only by authenticated users; admins read all

---

## 5. User Flows

### 5.1 End-Customer Flow (AR Experience)
1. Customer receives a printed photo/card with a QR code.
2. Scans QR with any camera app OR uses the in-app scanner at `/scan`.
3. Browser opens `/ar/<slug>?mode=video`.
4. **Direct mode:** Video plays immediately (no AR tracking required).
5. **AR mode:** Customer points camera at the printed marker; video overlays on the photo.
6. Double-tap video for fullscreen; playback controls always visible.

### 5.2 Client Admin Flow
1. Client signs up at `/auth`.
2. First user is manually promoted to admin (or auto-promoted in dev mode).
3. Admin completes TOTP MFA setup at `/mfa`.
4. Dashboard access: `/dashboard`
   - Overview: stats, recent activations
   - AR Experiences: create/edit/delete experiences, upload cover + media + .mind marker
   - Licenses: issue license keys
   - Activations: view device/instance activations
   - Audit Log: security event log
5. Creates experience → generates QR code → downloads for print.

### 5.3 Super-Admin/Vendor Flow
1. Access vendor-worker dashboard (separate Cloudflare Worker).
2. Issue license keys tied to client domain/fingerprint.
3. Monitor activations and abuse signals.
4. Trigger 90-day fallback if vendor server unreachable.

---

## 6. Deployment Strategy

### 6.1 Zero-Investment Stack
| Layer | Service | Free Tier Limit | Cost at Scale |
|-------|---------|-----------------|---------------|
| Frontend | Cloudflare Pages | Unlimited requests, 500 builds/mo | Free |
| Functions | Cloudflare Workers | 100k requests/day | $5/10M requests |
| Database | Supabase Free | 500MB, 2M Edge Function invocations | $25/mo Pro |
| Storage | Cloudflare R2 Free | 10GB/month | $0.015/GB |
| Email | Resend Free | 100 emails/day | $0.10/1k emails |
| DNS | Cloudflare | Free | Free |

### 6.2 Per-Client Deployment
1. Fork/clone the base repo into a private GitHub repo for the client.
2. Create new Cloudflare Pages project + Supabase project for the client.
3. Set environment variables: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VENDOR_LICENSE_SECRET`.
4. Deploy frontend to Cloudflare Pages.
5. Run database migrations in Supabase.
6. Configure custom domain (e.g., `client.aetherphoto.shop`).
7. Issue license key via vendor-worker.
8. Hand over admin credentials + documentation.

### 6.3 Why Not Vercel Hobby
- Vercel Hobby Terms prohibit commercial use and reselling.
- Cloudflare Pages + Workers is commercially legal on the free tier.
- Supabase Free pauses after 7 days of inactivity; use Pro ($25/mo) for production clients or schedule a ping.

---

## 7. Security & Compliance

### 7.1 Already Implemented
- Strict CSP + security headers middleware
- Rate limiting on public license API
- TOTP MFA enforcement for admins
- RLS on all tables
- Separate `user_roles` table (no role column on users)
- Audit logging for sensitive actions
- XSS-safe AR scene construction
- Camera permission handling + cleanup

### 7.2 Legal Documents
- `LICENSE_AGREEMENT.md` — client license terms
- `DPA.md` — data processing addendum
- `SECURITY.md` — security policy
- `HANDOVER.md` — client handover checklist
- `RUNBOOK.md` — operational runbook

### 7.3 Recommended Legal Spend
- ₹70,000–₹1,20,000 for an Indian attorney to review/customize agreements.
- Register trademark for "Aether AR" / "Aether Photo" if scaling beyond 10 clients.

---

## 8. Current Feature Status

### 8.1 Shipped ✅
- Marketing landing page with custom favicon + no Lovable branding
- Google OAuth + email auth
- Admin dashboard with role-based navigation
- AR Experience CRUD with media upload
- QR code generation per experience
- In-app QR scanner (`/scan`)
- AR viewer with MindAR tracking + direct video mode
- Double-tap fullscreen + playback controls
- License activation API with abuse protection
- TOTP MFA for admins
- Security headers + CSP
- Error boundaries + loading states

### 8.2 In Progress / Next Polish
- Real-world marker tracking accuracy tuning
- iOS Safari autoplay stress-testing
- Dashboard mobile responsiveness
- Client onboarding wizard
- Automated per-client deployment script

### 8.3 Future Roadmap
- AI-generated marker images
- Multi-target tracking (one QR, multiple videos)
- Analytics dashboard (views, scans, plays)
- White-label theming engine
- Mobile app wrapper (Capacitor)
- Reseller/affiliate portal

---

## 9. Go-to-Market Plan

### 9.1 Target Customer in India
- Wedding photographers offering "AR wedding albums"
- Event agencies for corporate invites
- Print shops selling AR photo frames
- Educational institutes for AR certificates
- Real estate brokers for AR property cards

### 9.2 Sales Motion
1. **Demo:** Show `aetherphoto.shop` live.
2. **Pilot:** Offer 1 free experience to close the first client.
3. **Case Study:** Use first client as testimonial.
4. **Outbound:** Instagram DMs + WhatsApp to photographers/print shops.
5. **Inbound:** YouTube shorts showing "scan photo, video plays".

### 9.3 First-90-Days Goal
- Close 5 paying clients → ₹1,50,000 revenue
- Build 3 strong case studies
- Refine onboarding so a non-technical client can launch in 30 minutes

---

## 10. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Client resells codebase | High | Instance fingerprinting + vendor-worker license checks |
| Supabase free tier pauses | Medium | Use Pro for paid clients; schedule keep-alive ping |
| AR tracking fails on low-end phones | Medium | Direct video mode bypasses AR; progressive enhancement |
| iOS Safari autoplay blocks | Medium | `muted` + `playsinline` + user-gesture pre-play |
| Google OAuth app verification | Low | Use Supabase managed OAuth; verify app if scaling |
| Legal disputes | Medium | Attorney-drafted agreements; clear handover docs |
| Cloudflare free limits | Low | Workers 100k/day sufficient for early clients |

---

## 11. Key Metrics to Track

- **CAC (Customer Acquisition Cost):** target < ₹5,000
- **Gross Margin:** target > 90% (codebase is reusable)
- **Time-to-Deploy:** target < 2 hours per client
- **NPS:** target > 50 from first 10 clients
- **Activation Success Rate:** % of QR scans that successfully play video
- **Support Tickets per Client:** target < 2 in first month

---

## 12. One-Page Build Checklist

- [x] Core web app (TanStack Start + Tailwind)
- [x] Auth + MFA
- [x] Admin dashboard
- [x] AR engine (MindAR + fallback)
- [x] QR generation + in-app scanner
- [x] License API + vendor-worker
- [x] Security hardening
- [x] Custom domain + favicon
- [x] Multi-target album schema (`albums`, `ar_experiences.album_id/target_index`)
- [x] Admin album compiler page (`/dashboard/albums/new`, MindAR OfflineCompiler, 20-photo cap)
- [x] `/ar/album/$slug` multi-target viewer (one QR per album, per-target video)
- [x] QR generation updated for albums
- [x] Branch B self-hosted config scaffolds (`deploy/self-hosted/`)
- [ ] Branch B auth module (bcrypt + JWT + TOTP) — manual build
- [ ] Branch B R2 upload flow — manual build
- [ ] Automated client provisioning script
- [ ] Real-world marker accuracy testing
- [ ] Attorney-reviewed agreements
- [ ] First 5 paying clients

---

**Document Version:** 6.0  
**Last Updated:** July 2026  
**Owner:** Aether AR Project  
**Next Review:** After first 5 client deployments
