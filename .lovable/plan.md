## Scope: ship the remaining Blueprint v3 work

Selling for ₹30k/client means every gap on that list must close before first handover. Splitting into what I can build in this app vs. what needs external setup or your action.

---

### A. Build in this app (I do it now, in one batch)

1. **Storage bucket + upload flow**
   - Create private `ar-media` bucket (Lovable Cloud storage; R2 stays as a future swap).
   - Add `media_path`, `marker_path`, `marker_type` columns to `ar_experiences`.
   - New "Create / Edit Experience" UI: drag-drop marker image + overlay video/image, signed-URL upload, preview.

2. **Real MindAR marker tracking**
   - Add `mind-ar` + `three` deps.
   - Rewrite `/ar/$slug` to use MindAR image-tracking with the uploaded `.mind` marker (or auto-compile from uploaded JPG via MindAR's browser compiler on upload).
   - Overlay plays video/image locked to marker; graceful fallback for no-camera / iOS Safari permission prompt.

3. **QR code per experience**
   - `qrcode` dep; generate on demand in the dashboard, download as PNG/SVG, plus a "print sheet" view (marker + QR side-by-side).

4. **Mandatory TOTP for admins**
   - Enroll flow on first admin dashboard visit (Supabase MFA API).
   - Block admin routes until `aal2`; keep viewers untouched.

5. **Admin bootstrap**
   - Migration: first user to sign up is auto-promoted to `admin` (one-shot trigger that no-ops after the first admin exists).

6. **Rate-limit `/api/public/license/activate`**
   - Postgres-backed sliding window (10 req / IP / min, 30 req / license_key / hour). Documented as ad-hoc (no framework primitive yet).

7. **Duplicate-fingerprint email alerts**
   - Resend integration via server fn; email you + client contact on every rejected activation. Requires `RESEND_API_KEY` secret (I'll request it).

8. **Handover docs in repo**
   - `HANDOVER.md`, `RUNBOOK.md` (incl. re-activation SOP), `LICENSE_AGREEMENT.md` (placeholder for lawyer draft), `DPA.md` (placeholder), `SECURITY.md`.

9. **Sentry wiring**
   - `@sentry/react` client init behind `VITE_SENTRY_DSN`; no-op when unset so it doesn't block your first deploy.

---

### B. Not built in this app — your action / external

These belong on your Cloudflare account, not inside the client's app. I'll write the code + docs, you deploy once and reuse across all clients.

10. **External activation Worker + D1** — I'll create `/vendor-worker/` in this repo: `wrangler.toml`, Worker source, D1 schema, deploy script, ES256 keygen script. You run `wrangler deploy` on your own CF account. App gets a `VITE_ACTIVATION_URL` env pointing at it.

11. **Vendor-unreachable 90-day fallback + GitHub Pages mirror** — included in `/vendor-worker/`: scheduled Worker cron publishes signed fallback tokens to a GH Pages repo you own. Setup steps in RUNBOOK.

12. **Better Stack uptime** — 5-minute manual setup (I'll write the checklist; can't do it via API without your account).

13. **Legal review (₹60–100k INR = your $700–1,200)** — placeholder docs shipped; you get them lawyer-reviewed once, reuse per client. Non-negotiable before first sale.

---

### Order of operations

1. You approve this plan.
2. I run one Supabase migration (storage bucket columns, first-admin trigger, rate-limit table, activation attempts table).
3. I install deps (`mind-ar`, `three`, `qrcode`, `@sentry/react`, `resend`) and ship sections A1–A9 in parallel file writes.
4. I scaffold `/vendor-worker/` (section B10–B11) with a README you follow once.
5. Sign up at `/auth` → first-admin trigger promotes you → enroll TOTP → you're in.

### Technical notes

- MindAR compile-on-upload runs client-side in the admin's browser (no server GPU needed).
- Rate-limit uses `pg_cron`-free approach: a `rate_limit_hits` table + `check_and_record_hit(key, window_seconds, max)` SQL function returning `boolean`.
- First-admin trigger: `BEFORE INSERT ON user_roles` — if `NOT EXISTS (SELECT 1 FROM user_roles WHERE role='admin')` and this insert is the current user's first row, override role to `admin`.
- TOTP gate lives in `_authenticated/route.tsx` client-side check: if `has_role(admin)` and `session.aal !== 'aal2'`, redirect to `/mfa`.
- Resend called from a server fn triggered inside `activate.ts`; failures logged, never block the activation response.

### Not doing (out of scope for ₹30k tier)

- Multi-tenant. One deploy per client, per blueprint §10.
- End-user DRM, biometric AR, transfer UI, bulk client tooling.
- Migrating to R2 now — Lovable Cloud storage works; swap later if a client's media bill demands it.

Approve and I'll ship sections A1–A9 + scaffold B10–B11 in the next turn.