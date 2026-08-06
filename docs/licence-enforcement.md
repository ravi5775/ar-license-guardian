# Licence enforcement

Honest framing first: a determined attacker with the client bundle can strip the
gate — that is true of every JS product. What these controls buy you is that
**casual resale is dead**, because a stripped build can't call your R2 or your
models endpoint. Put the value behind the server, not behind the check.

## 1. Activation + device binding (one mobile, one desktop)

On first run the client POSTs to `/api/public/licence/activate`:

```json
{ "licenceKey": "...", "deviceFingerprint": "...", "platform": "mobile" }
```

- `licenses.allowed_mobile` / `allowed_desktop` default to `1`.
- Slot free → bind. Slot occupied by a different fingerprint → `409 DEVICE_LIMIT`.
- The customer releases the old device from your dashboard (`releaseDevice`).
  Self-service release should carry a 24h cooldown to stop seat-sharing.
- Fingerprint = SHA-256 of hardware/UA hints + an install UUID persisted in
  `localStorage`. Spoofable — friction, not proof.

## 2. Signed short-lived licence token

Activation returns an **Ed25519-signed JWT**:

```json
{ "sub": "<key>", "device": "<fp>", "platform": "mobile", "plan": "pro",
  "features": ["ar","albums"], "exp": "+24h", "grace": 72 }
```

The client verifies it with the public key baked into its bundle
(`VITE_LICENCE_PUBLIC_KEY`) and refuses to render the AR viewer without a valid,
unexpired token. Refresh every 12h; fail-closed after the 72h grace window, so a
customer who firewalls your server gets three days offline then a hard stop.

## 3. Tamper detection → email to admin

1. **Build integrity.** CI hashes every built JS asset, combines them into one
   digest, signs it, and stores it in `release_manifests`
   (`scripts/sign-manifest.mjs`).
2. **Heartbeat attestation.** Every refresh sends `buildId`, the digest the
   client computed from its *own loaded chunks*, and the origin host.
3. **Server-side verdict.** Mismatch → row in `license_violations`, licence
   auto-suspended, email sent **from your server**. Never from the client — a
   tampered client just deletes that line. Absence of a heartbeat is itself the
   signal.

Also flagged: origin host not in `licenses.allowed_origins`, heartbeats from more
fingerprints than allowed, and a heartbeat gap longer than the grace window.

## 4. Where the real teeth are

Media presigns only against a valid licence token. Tampered or suspended licence
→ no presign → no video. That works whether the bucket is yours or theirs.

If you need protection beyond deterrence, move a small but essential compute
step server-side (model decryption key, marker→pose solve params) so a cracked
client is a broken client.

## Configuration

Admin branches (`main`, `self-hosted`):

```
LICENCE_ROLE=issuer
LICENCE_PRIVATE_KEY_JWK={...}      # scripts/generate-licence-keypair.mjs
RELEASE_MANIFEST_SECRET=...
RESEND_API_KEY=...  ALERT_TO_EMAIL=...
```

Customer deployment (`client-app`) — the only things they configure:

```
VITE_LICENCE_API_URL=https://licence.yourdomain.com
VITE_LICENCE_KEY=AETH-....
VITE_LICENCE_PUBLIC_KEY={"kty":"OKP",...}   # baked at build time by you
VITE_BUILD_ID=<commit sha>
R2_ACCOUNT_ID= R2_BUCKET= R2_ACCESS_KEY_ID= R2_SECRET=   # their own R2
```
