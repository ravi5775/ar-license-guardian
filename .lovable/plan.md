
# AR Photo Platform — Blueprint v3

Solo, near-zero investment, B2B project delivery. One deploy per client, client owns all infra. **The legal contract is the enforcement mechanism; the technical layer is a casual-clone deterrent and a breach evidence trail.** Stated plainly here so nothing downstream implies otherwise.

## 1. Business Model (locked)

- One-time license fee per client, optional monthly retainer.
- Client owns all infra accounts and pays their own bills.
- You build → hand over → optional maintenance.
- Not in v1: end-user DRM, biometric AR, multi-tenant, bulk tooling, transfer UI.

## 2. Stack + Honest Cost

| Layer | Service | Client cost at launch | Notes |
|---|---|---|---|
| Frontend + API | **Cloudflare Pages + Workers** (client account) | $0 | Commercial-legal free tier |
| Database + Auth | **Supabase Pro** (client account) | **$25/mo from day 1** | Free tier auto-pauses; unacceptable for paid product |
| Media storage | **Cloudflare R2** (client account) | $0 up to 10 GB, zero egress | |
| AR runtime | **MindAR + AR.js** (free, open-source) | $0 | **Decision locked. No 8th Wall.** Trade-off: slightly weaker tracking on edge cases; acceptable for wedding/event photo scenes |
| Email | **Resend** | $0 → $20/mo when needed | |
| Edge / DDoS / DNS | **Cloudflare Free** | $0 | |
| Uptime + errors | **Better Stack Free + Sentry Developer** | $0 | |
| Domain | Registrar of client's choice | **~$12/yr** | Was missing from v2 |
| Payments (if client sells access) | **Stripe / Razorpay** | 2.9% + 30¢ per txn | Client's processor, not yours |
| Your activation service | **Cloudflare Worker + D1** (YOUR account) | $0 for thousands of clients | |

**Honest client cost at launch: ~$25/mo + ~$12/yr domain.** Everything else genuinely free-tier and commercial-legal. If media processing ever exceeds Workers' free CPU budget, next tier is $5/mo — noted here so no client is surprised.

## 3. Architecture

```text
Client's domain (Cloudflare DNS, free)
        │
        ▼
  Cloudflare Pages (TanStack Start)
        ├── Marketing pages (public)
        ├── /api/public/*   webhooks, license heartbeat
        ├── /api/*          authenticated APIs
        └── /_authenticated app + admin
        │
        ├──► Supabase Pro (Postgres + Auth)
        └──► Cloudflare R2 (photos, videos, AR scenes)

Your side (one Worker for ALL clients):
  activation.yourdomain.com  →  Cloudflare Worker + D1 registry
```

## 4. Licensing (honestly framed)

**What this actually does:**
1. Deters casual duplication ("I'll deploy this for my cousin too").
2. Creates auditable evidence of breach for the contract.

**What it does not do:** stop a client who reads their own repo. It can't — they own the code, the infra, and the env vars by design. The contract is 100% of the real enforcement. Legal spend is sized accordingly (see §7).

### Instance fingerprint

Hash of: deployment domain + Supabase `project_ref` + Cloudflare Pages project ID + `CLIENT_LICENSE_KEY`.

### Activation flow

1. You pre-register license key in D1 before handover.
2. First boot → app POSTs `{license_key, fingerprint}` to your Worker.
3. First fingerprint per license **auto-approves and locks**. Duplicates → reject + email you.
4. Worker returns ES256-signed JWT (private key offline, in your password manager).
5. App caches JWT and verifies signature locally on every boot.

### Enforcement timeline (one number, in the contract, matches the code)

- **14-day offline grace** on cached JWT.
- **Revocation takes effect within 14 days** of next check-in.
- Maximum runtime after revocation: 14 days.

### Vendor-unreachable path (fixed — no self-issued bypass)

The v2 pre-issued permanent JWT is removed. Instead:

- Worker exposes a `/vendor-check` endpoint that logs every ping from every client instance.
- If a client's Worker check-ins fail for **90 consecutive days** (vendor unreachable), the Worker auto-issues an extended offline token on the client's next successful check-in attempt via a signed fallback path published to a small always-on GitHub Pages mirror (static, hosted free, updated automatically by the Worker on a schedule).
- If both the Worker AND the GitHub mirror have been silent for 90+ days, a documented emergency procedure lets the client apply for a community-mirrored fallback certificate.
- Result: client cannot self-issue a bypass on day one, but is genuinely protected if you disappear.

### Legitimate re-activation flow (added to RUNBOOK.md)

Client-initiated domain change, Supabase project rebuild, or Cloudflare account migration:

1. Client emails you (template provided).
2. You manually clear the old fingerprint in D1 (30-second SQL update).
3. Next boot on new infra auto-approves as a fresh first-fingerprint event.
4. SLA on this: 2 business days.

Documented before first client ships, so it never becomes a bad support surprise.

### Kill switch scope

Non-payment of setup fee, proven ToS breach (duplicate fingerprint event), or contractually defined trigger. Not for casual disputes.

## 5. Handover Package

1. Deployed URLs on client's Cloudflare Pages + Supabase Pro.
2. **Private GitHub repo transferred to client's org.** Client sees the license code — this is fine, because per §4 the technical layer was never the enforcement mechanism.
3. Admin account with **mandatory TOTP at first login**, no skip.
4. Full env vars, DB, storage, R2 access.
5. `HANDOVER.md`, `RUNBOOK.md` (includes re-activation flow), `LICENSE_AGREEMENT.pdf`, `DPA.pdf`.
6. 30-day post-handover bug-fix window.
7. Optional retainer: $99–299/mo.

## 6. Build Order (9–10 weeks solo)

| Week | Deliverable |
|---|---|
| 1 | Marketing site (custom design, Framer Motion) |
| 2 | Supabase schema + Auth + mandatory TOTP |
| 3 | Upload flow → R2 → AR scene + QR generation |
| 4–5 | **AR playback with MindAR + AR.js** (2 weeks: iOS Safari, camera perms, marker calibration) |
| 6 | Admin CRUD |
| 7 | Activation Worker + D1 + auto-approve-first-fingerprint |
| 8 | Vendor-unreachable fallback path + revocation flow + heartbeat + re-activation SOP |
| 9 | HANDOVER.md, RUNBOOK.md, backups, monitoring, DPA + License Agreement finalized |
| 10 | Buffer / first client deploy / polish |

**v1.1 fallback:** if weeks 7–8 slip, ship without the Worker for the first 2–3 clients. Legal contract does the work meanwhile.

## 7. Legal (primary protection — sized accordingly)

- **Source License Agreement** — non-exclusive, non-transferable, single-deployment, 5× liquidated damages, explicitly names the fingerprint as evidence mechanism. Budget: ~$500–1,000 for a lawyer draft, reused per client.
- **Pre-handover DPA** — covers the build/test window where you touch real identifiable-person photos. GDPR boilerplate, ~$200 one-off. Auto-terminates at handover.
- Post-handover: client is sole controller + processor.
- ToS + Privacy Policy templates shipped in the app.
- Explicit "no biometric processing" clause.

**Total one-off legal spend: ~$700–1,200.** Reused across every client. This is where the actual protection lives — do not under-invest here.

## 8. Pricing

- License + deploy: $2–5k one-time.
- Setup fee: flat.
- Retainer: $99–299/mo optional.

## 9. What changed from v2

| v2 issue | v3 fix |
|---|---|
| Escrow envelope = self-issued day-one bypass | Removed. Replaced with Worker-verified 90-day silence trigger + GitHub Pages mirror fallback. |
| Repo transfer + fingerprint framed as protection | Reframed up front (§4): contract = enforcement, technical layer = deterrent + evidence. |
| 8th Wall listed but not costed | Decision locked: MindAR + AR.js (free). 8th Wall removed. |
| Domain, Stripe fees, Workers paid tier omitted | All listed in §2. |
| No documented re-activation path | RUNBOOK.md re-activation flow + 2-day SLA. |
| "10/10" self-grade | Dropped. Two known trade-offs documented in §10. |

## 10. Known trade-offs (documented, not hidden)

- Determined client with dev skills can strip the license check. Contract is the remedy.
- Single-tenant per client. Revisit multi-tenant beyond ~50 clients.
- MindAR/AR.js has weaker tracking than 8th Wall on some surfaces; acceptable for target use case.
- You operate one small Worker (~5 min/mo). Vendor-unreachable fallback covers your absence up to 90 days without giving clients a self-issued bypass.
- The GitHub Pages mirror is a moving part you own. Documented in your own RUNBOOK.

---

**Approve and I'll start Week 1 (marketing site + design system) on this project.**
