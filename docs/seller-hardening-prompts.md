# Aether AR — Seller Edition Hardening Prompt Pack

Copy each prompt **verbatim** into the agent, one at a time, in order. Wait for the
report at the end of each prompt before sending the next one. Every prompt is
self-contained: it states the context, the exact deliverable, and the stop condition.

Reference documents the agent must read:

- `Aether_AR_Seller_Edition_Tamper_Proof_Security_Guide.md` (threat model, files never delivered, attack matrix)
- `enterprise_architecture_report.md` (current architecture audit)

Skills to invoke: `agentskill-sh-learn` (to absorb the two documents before acting) and
`agentskill-sh-review-skill` (only when auditing/authoring skills, not app code).

---

## Prompt 0 — Load the guide into working knowledge

```text
Use the agentskill-sh-learn skill to read these two files end to end before doing anything else:
- Aether_AR_Seller_Edition_Tamper_Proof_Security_Guide.md
- enterprise_architecture_report.md

Produce a single markdown summary at docs/seller-guide-digest.md containing exactly:
1. The threat model table, unchanged.
2. The complete "Files Never Delivered" list, each entry annotated EXISTS or ABSENT after checking the repo.
3. The complete "Secrets Never Delivered" list, each annotated with every file path and line number where the variable NAME appears. Never print a secret value.
4. The attack matrix table, with an empty "Current status" column ready for Phase 3.

Do not change any application code in this prompt. Stop and report the digest.
```

---

# Phase 1 — Blockers before any sale

## Prompt 1 — Client-facing leak audit

```text
Read docs/seller-guide-digest.md.

Audit which issuer-only artefacts are currently reachable from a client-facing build.
For each of these, report the file path, whether it exists, and whether any file under
src/routes/** or src/components/** transitively imports it:
- src/lib/adapters/licence.server.ts
- src/routes/api/public/licence/**
- src/lib/licenses.functions.ts, admin.functions.ts, approvals.functions.ts
- src/routes/_authenticated/**
- scripts/sign-manifest.mjs
- .github/workflows/deploy-main.yml, deploy-self-hosted.yml
- vendor-worker/**
- supabase/migrations/** that only the issuer needs

Then verify scripts/strip-client-app.sh removes every EXISTS item, and list what it misses.
Output a table: artefact | exists | imported by client code | stripped by script | action needed.

Do not edit files yet. Stop and report.
```

## Prompt 2 — Secret exposure sweep (names only, never values)

```text
Sweep the repo for these secret names: SUPABASE_SERVICE_ROLE_KEY, LICENCE_PRIVATE_KEY_JWK,
RELEASE_MANIFEST_SECRET, DEFAULT_ADMIN_PASSWORD, DEFAULT_ADMIN_EMAIL, RESEND_API_KEY,
R2_SECRET, R2_ACCESS_KEY_ID, JWT_SECRET, VENDOR_LICENSE_SECRET.

For each: every file:line where the name appears, and classify the site as
(a) template/example only, (b) server-side read inside a handler, (c) module-scope read,
(d) client-reachable (imported from src/routes or src/components), (e) committed real value.

NEVER print a secret value — names and paths only.

Then:
- Fix every (c) by moving the read inside the handler.
- Fix every (d) by moving the read behind a server function or *.server.ts module.
- Report every (e) immediately and recommend rotation; do not attempt to rewrite git history.
- Confirm .gitignore covers .env, .env.*, !*.example, private.jwk, .dev.vars.

Stop and report what you changed with file paths.
```

## Prompt 3 — Per-customer repo generator

```text
Replace scripts/strip-client-app.sh with scripts/make-client-repo.sh that produces a
delivery-ready, per-customer repository. Requirements:

- Usage: ./scripts/make-client-repo.sh <customer-id> <output-dir>
- Copies the working tree, then deletes every artefact confirmed as issuer-only in Phase 1
  (issuer adapters, licence API routes, admin/approvals/licences server fns, _authenticated
  admin-only pages that the guide marks issuer-only, vendor-worker, admin CI workflows,
  issuer-only migrations, all docs/ files describing issuer internals).
- Writes a fresh .env.example with client-only variables and no issuer secrets.
- Runs `git init` in the output dir and creates exactly ONE commit: "Aether AR <customer-id> initial delivery". No prior history, no remotes.
- Fails loudly (exit 1) if, after stripping, `rg` still finds references to any removed module.
- Fails loudly if any .env with real values, private.jwk, or .dev.vars is present in the output.
- Prints a checklist of manual steps left for the installer.

Also update docs/branching.md to document this script as the only delivery path.
Stop and report the script contents summary and the fail-safe checks.
```

## Prompt 4 — Build fingerprinting

```text
Implement build-time fingerprinting per the guide's "Build Fingerprinting" section.

- Add VITE_BUILD_ID, VITE_CUSTOMER_ID, VITE_RELEASE_HASH to .env.example (client section).
- Create src/lib/build-info.ts exporting a typed, frozen buildInfo object read from
  import.meta.env, with a dev-only fallback and a hard warning when CUSTOMER_ID is missing.
- Include all three values in every licence activation, refresh, and heartbeat request body
  (src/lib/adapters/licence-runtime.ts) and validate them in the issuer handlers.
- On the issuer side, reject activation when customerId does not match the licence record's
  customer, and record buildId/releaseHash on the device row.
- Surface buildInfo in the admin diagnostics page so I can see which build a client runs.

Do not change RLS policies. Stop and report file paths changed.
```

## Prompt 5 — Deployment + domain binding

```text
Bind licences to Customer ID + Domain + Build ID + Device Secret per "Deployment Binding".

Issuer side:
- Add allowed_origins (text[]) and customer_id to the licence record via a migration, with
  GRANTs, RLS enable, and admin-only policies. Do not weaken existing policies.
- In the activation/refresh handlers, derive the origin from request headers only (never the
  body), and reject when the origin host is not in allowed_origins. Log the rejection to gate_events.
- Include customerId, domain, buildId in the signed Ed25519 token claims.

Client side:
- Verify the token's domain claim against window.location.host at runtime; on mismatch,
  fail closed with a clear "licence not valid for this domain" state.

Add an admin UI control to add/remove allowed origins for a licence, with an audit entry.
Stop and report.
```

## Prompt 6 — Production source maps off

```text
In vite.config.ts, disable source maps for production builds (build.sourcemap = false when
NODE_ENV/mode is production, keep them in dev). Also ensure the client build does not emit
.map files to dist and that any CI upload step does not publish them.
Confirm with a production build and list the dist files to prove no .map is emitted.
Stop and report.
```

## Prompt 7 — Shorten the offline grace window

```text
The licence currently allows a 72-hour offline grace period. Replace it with a shorter,
server-enforced window.

- Propose a value (I expect 12-24h) and justify it in 5 lines: usability during a client's
  event day vs. how long a cracked/offline copy stays usable.
- Implement it as a single server-side constant in src/lib/adapters/licence.server.ts,
  echoed to the client in the token claims (graceHours), so the client cannot extend it.
- Ensure the client refuses to use a cached token whose exp + graceHours has passed, and
  clears the cached token instead of silently degrading.
- Add a per-licence override column so I can grant a longer window to a specific customer
  for a specific event, admin-only, audited.

Stop and report the chosen value and the reasoning.
```

## Prompt 8 — Fresh bootstrap admin password per install

```text
Remove DEFAULT_ADMIN_PASSWORD as a shipped default.

- Delete the default admin password/email lines from all env templates and README/hosting docs.
- Add scripts/bootstrap-admin.mjs that: requires an email argument, generates a 32-char
  cryptographically random password, creates exactly one admin (idempotent - refuses if any
  admin already exists), prints the password ONCE to stdout, and forces a password change
  and TOTP enrolment on first login.
- Update docs/hosting.md installation steps to use the script.
- Confirm no code path can create an admin implicitly on first signup.

Stop and report.
```

---

# Phase 2 — High priority

## Prompt 9 — Ed25519 build attestation

```text
Implement the "Build Attestation" flow end to end.

- scripts/sign-manifest.mjs: hash every emitted JS bundle (SHA-384), build a canonical
  manifest {buildId, customerId, files:[{path,hash}], releaseHash}, sign with
  LICENCE_PRIVATE_KEY_JWK, POST to /api/public/licence/manifest with RELEASE_MANIFEST_SECRET.
- Issuer: store the manifest, verify the signature before accepting it, key it by (customerId, buildId).
- Activation/heartbeat: compare the client-reported releaseHash against the stored manifest.
  On mismatch, do not hard-block immediately: mark the device as INTEGRITY_MISMATCH, alert me
  by email, and only refuse presigned URLs after a configurable number of mismatched heartbeats.
- Expose mismatches in the admin diagnostics page.

Justify the soft-fail choice in the report. Stop and report.
```

## Prompt 10 — Onboarding automation scripts

```text
Create scripts/onboarding/ with these Node scripts, each idempotent, each with --dry-run:

1. r2-create-bucket.mjs   - creates the customer bucket via the Cloudflare API, applies a
                            lifecycle rule, prints the keys to hand over.
2. r2-install-cors.mjs    - installs the exact CORS policy the uploader needs for the
                            customer's domain only (no wildcards).
3. pages-install-env.mjs  - sets the customer's Cloudflare Pages env vars, including
                            VITE_CUSTOMER_ID / VITE_BUILD_ID / VITE_RELEASE_HASH.
4. dns-validate.mjs       - checks the customer domain resolves to Pages and that the origin
                            is registered in the licence's allowed_origins.
5. license-wizard.mjs     - creates the licence record, sets customer_id + allowed_origins +
                            device cap, and prints the licence key once.

Read credentials from env inside the function bodies, never at module scope, and never log them.
Add docs/onboarding.md with the exact command order for a new customer.
Stop and report.
```

## Prompt 11 — Invisible watermarking

```text
Propose and implement leaked-copy tracing that survives a client stripping obvious code:

- A build-time transform that embeds the customer ID into the emitted bundles in several
  independent, low-salience places (module ordering seed, a benign constant, a CSS custom
  property name, and the asset manifest).
- Server-side per-customer watermarking of generated media/.mind assets, as described in
  docs/anti-resale.md, applied at generation time on my infrastructure.
- A script scripts/trace-build.mjs that takes a suspect bundle or asset and reports which
  customer ID it matches.

Be explicit about the honest limits of each technique - what a determined reseller can strip.
Stop and report.
```

---

# Phase 3 — Verification

## Prompt 12 — Attack matrix reality check

```text
Take the attack matrix from docs/seller-guide-digest.md. For EACH row, inspect the actual
current implementation and fill in:
- Stopped / Partially stopped / Not stopped
- The exact file:line that provides the control
- If partial or not stopped, the smallest change that would close it

Be honest: mark anything as Not stopped when the control is only a deterrent (client-side
checks, watermarks, fingerprints the buyer can strip). Do not claim DRM-grade protection.

Then write hardening-implementation-report.md at the project root containing:
1. Phase 1 findings and what changed, with file paths.
2. Phase 2 findings and what changed, with file paths.
3. The completed attack matrix.
4. The 45-item pre-sale checklist with each item marked Done / Partial / Outstanding and,
   for Partial/Outstanding, why.
5. Residual risks I must accept, and the contractual controls (Source Licence Agreement)
   that cover them.

Stop and report.
```

---

## Guardrails to repeat in every prompt if the agent drifts

```text
Constraints, restate before acting:
- Do not remove or weaken any existing Row Level Security policy. Additive changes only.
- Keep AR Viewer, Dashboard, QR Scanner, Media Upload UI, and Licence Runtime fully working.
- Never print secret values, only names and paths.
- Never read process.env at module scope; read inside handlers.
- No direct supabase.from(...) in src/routes/** or src/components/** - the ESLint rule bans it.
- Flag anything you are unsure about instead of guessing.
- Stop after the phase and report; do not roll into the next phase unprompted.
```

## Order of execution, at a glance

```text
0 digest -> 1 leak audit -> 2 secret sweep -> 3 repo generator -> 4 fingerprint
-> 5 domain binding -> 6 sourcemaps -> 7 grace window -> 8 bootstrap admin
-> 9 attestation -> 10 automation -> 11 watermark -> 12 attack matrix + report
```
