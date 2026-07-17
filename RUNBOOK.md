# Runbook — Aether AR

Day-to-day operations for the person maintaining this deployment.

## 1. Common tasks

### Add a new admin

Sign the person up at `/auth`. Then in Lovable Cloud → Query:

```sql
insert into public.user_roles (user_id, role)
  values ('<their auth.uid>', 'admin');
```

They'll be forced through TOTP enrollment on their next dashboard visit.

### Rotate an admin's TOTP (lost device)

```sql
-- inspect
select id, factor_type, status from auth.mfa_factors where user_id = '<uid>';
-- delete all TOTP factors for that user
delete from auth.mfa_factors where user_id = '<uid>' and factor_type = 'totp';
```

They'll be forced through re-enrollment on next login.

### Publish a new AR experience

1. Dashboard → AR Experiences → New experience.
2. Upload marker image (JPG/PNG) and overlay media (MP4/JPG/PNG).
3. **Optional but recommended:** compile the marker image to a `.mind` file using
   the MindAR compiler at https://hiukim.github.io/mind-ar-js-doc/tools/compile
   and upload it as the marker instead. Without a `.mind` file, the viewer
   falls back to "preview mode" (no tracking).
4. Toggle Published → Save.
5. Click QR to download / print the marker sheet.

## 2. License re-activation SOP

The technical layer allows one deployment fingerprint per license. If a
legitimate client changes infrastructure (new domain, rebuilt Supabase
project, new Cloudflare account), duplicate-fingerprint email alerts will
fire.

**When a client requests re-activation:**

1. Client emails you using the template in `HANDOVER.md`.
2. Verify it's the account holder — reply to their known email address.
3. In the activation Worker's D1 database:

```sql
delete from license_activations where license_id = '<id>';
```

4. Have client redeploy. New fingerprint auto-approves.

**SLA:** 2 business days.

## 3. Vendor-unreachable path

If the activation Worker at `VITE_ACTIVATION_URL` is unreachable, the app
falls back to a **cached JWT with a 14-day offline grace period**.

If the vendor is unreachable for **90 consecutive days**:

1. The Worker's own missed-heartbeat monitor auto-publishes an extended
   offline token to the GitHub Pages mirror at
   `https://<vendor>.github.io/aether-activation-mirror/`.
2. The app periodically fetches that mirror and swaps in the fallback token.
3. If both the Worker and the mirror have been silent for 90+ days, apply
   for a community-mirrored fallback certificate — instructions at
   `https://github.com/<vendor>/aether-activation-mirror`.

## 4. Rate limit tuning

Public license activation endpoint is throttled at:

- 10 requests / minute / IP
- 30 requests / hour / license key

To tune, edit `src/routes/api/public/license/activate.ts` — the
`rateLimit()` calls at the top of `handleActivate` and `handleVerify`.

## 5. Backups

Lovable Cloud runs daily automated backups (Pro plan). To download a manual
export: **Cloud → Advanced settings → Export data.**

For AR media stored in the `ar-media` bucket, use the Storage export tool
or `supabase storage cp` weekly.

## 6. Monitoring checklist

- [ ] Sentry DSN set → runtime errors captured
- [ ] Better Stack heartbeat monitor pinging `/` every 5 minutes
- [ ] Better Stack heartbeat monitor pinging `VITE_ACTIVATION_URL/health` every 5 minutes
- [ ] Resend domain verified → duplicate-fingerprint alerts deliverable
- [ ] Weekly: check `/dashboard/activations` for anomalies
- [ ] Weekly: check `/dashboard/audit` for unauthorized changes

## 7. Emergency contacts

- Vendor support: [insert email]
- Cloudflare status: https://www.cloudflarestatus.com/
- Lovable Cloud status: check Cloud dashboard
