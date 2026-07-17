# Security

## Reporting a vulnerability

Email `security@[yourdomain]` with details. Do not open a public GitHub issue.

We aim to acknowledge within 2 business days.

## Controls in this application

- **Authentication:** Supabase Auth (email + Google OAuth). Passwords use HIBP leak check.
- **Two-factor:** TOTP mandatory for all admin accounts (see `/mfa`).
- **Authorization:** Postgres RLS on every table. Role checks via `has_role()` security-definer function; no client-side role storage.
- **Rate limiting:** Public license activation endpoint throttled per-IP and per-license-key via Postgres sliding window.
- **Audit log:** Every license/activation change is recorded in `audit_log` with actor, action, and metadata.
- **Duplicate-fingerprint alerts:** Rejected activations trigger an email to the vendor + client contact via Resend.
- **Secrets:** Service role key and other server-only secrets live in the hosting platform's environment (Cloudflare Pages / Vercel). Never committed.
- **CORS:** Public license endpoint uses permissive CORS by design (external clients call it); all other endpoints are same-origin.
- **Transport:** HTTPS enforced by Cloudflare / hosting platform.

## Known accepted risks

- Publishable Supabase key is in the client bundle (by design — RLS enforces access).
- License-check code is in the client's repo (per contract, technical DRM is a deterrent; the Source License Agreement is the enforcement mechanism).
- MindAR loads from CDN (`jsdelivr`). SRI hashes are not pinned; a jsdelivr compromise could inject JS into the AR viewer route.

## Not present

- No biometric processing.
- No end-user PII in the deployment fingerprint.
- No storage of unencrypted user passwords.
