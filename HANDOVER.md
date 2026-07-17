# Handover Package — Aether AR

Congratulations on your new AR photo platform. Everything you need to run it lives in this repository and in a small handful of external accounts, all owned by you.

## 1. What you own after handover

| Asset | Where | Owned by |
|---|---|---|
| Source code | Private GitHub repo transferred to your org | You |
| Frontend hosting | Cloudflare Pages / Vercel (your account) | You |
| Database + auth + storage | Lovable Cloud (Supabase) project (your account) | You |
| Domain + DNS | Your registrar + Cloudflare DNS | You |
| Email sending | Resend account (optional) | You |
| Error monitoring | Sentry account (optional) | You |
| Uptime monitoring | Better Stack (optional) | You |
| License activation service | Cloudflare Worker + D1 in **the vendor's** account | Vendor |

Only the last row stays on the vendor's infrastructure. See `RUNBOOK.md` for what happens if the vendor is unreachable.

## 2. First-boot checklist

1. Deploy the frontend (see below).
2. Visit your site at `/auth` and sign up with the admin email. The **first person to sign up is automatically promoted to admin.**
3. On first admin login you'll be redirected to `/mfa` — enroll TOTP with Google Authenticator, 1Password, Authy, etc. TOTP is **mandatory** for admins.
4. Enter your license key in the environment variable `LICENSE_KEY`. Redeploy.
5. Verify the license activation shows up in your vendor's activation dashboard.

## 3. Environment variables

Set in Cloudflare Pages / Vercel:

```
VITE_SUPABASE_URL=              # from Lovable Cloud → Backend
VITE_SUPABASE_PUBLISHABLE_KEY=  # from Lovable Cloud → Backend
LICENSE_KEY=                    # from your vendor
VITE_ACTIVATION_URL=            # e.g. https://activation.vendor.example
VITE_SENTRY_DSN=                # optional
RESEND_API_KEY=                 # optional — enables alert emails
ALERT_TO_EMAIL=                 # where to send security alerts
ALERT_FROM_EMAIL=               # verified sender, e.g. "Aether <alerts@yourdomain.com>"
```

## 4. Deployment

### Frontend (Cloudflare Pages — recommended, commercial-legal free tier)

```
bun install
bun run build
```

Point Cloudflare Pages at this repo, build command `bun run build`, output `.output/public`.

### Database

Lovable Cloud provisions the Postgres + Auth + Storage automatically. Import your project into your own Lovable account before handover completes.

## 5. Roles

- **admin** — can issue licenses, manage activations, view audit log, upload AR experiences.
- **viewer** — regular signed-in user; can view the gallery.

New signups get `viewer` by default (except the very first one). To promote another user to admin, insert into `user_roles` via Cloud → Query.

## 6. What is NOT in scope

- End-user DRM
- Biometric/face-tracking AR
- Multi-tenant tooling
- Bulk client tooling

See `LICENSE_AGREEMENT.md` and `DPA.md`.

## 7. Support

Setup fee includes 30 days of post-handover bug fixes. See vendor's optional retainer offer for ongoing support.
