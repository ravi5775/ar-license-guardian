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
- [ ] Automated client provisioning script
- [ ] Real-world marker accuracy testing
- [ ] Attorney-reviewed agreements
- [ ] First 5 paying clients

---

**Document Version:** 4.0  
**Last Updated:** July 2026  
**Owner:** Aether AR Project  
**Next Review:** After first 5 client deployments
