# Forensic Status Audit: 6 Critical Pre-Launch Items

**Audit Date:** 2026-08-21  
**Audit Scope:** Read-only forensic verification across working tree, build output, runtime handlers, database migrations, and Git commit history.  
**Repository:** `ar-license-guardian` (TanStack Start / Cloudflare Pages / Workers)

---

## 1. Executive Status Matrix

| # | Item | Verdict | Evidence (file:line / commit hash) | Confidence |
|---|---|---|---|---|
| **1** | **Secrets Audit / Sweep** | **PARTIALLY CLOSED** | Working tree sanitized; 8 of 10 secrets read in handler scope. However, `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` are read at module scope in [`src/lib/storage.server.ts:17-18`](file:///d:/aether_ar/ar-license-guardian/src/lib/storage.server.ts#L17-L18). Historical keys exist in Git commits (`cc4ab9b`, `3014e38`, `b780077`, `0b8ee0b`). | **HIGH** |
| **2** | **Build Fingerprinting** | **PARTIALLY CLOSED** | `VITE_BUILD_ID`, `VITE_CUSTOMER_ID`, `VITE_RELEASE_HASH` defined in [`.env.example:64-66`](file:///d:/aether_ar/ar-license-guardian/.env.example#L64-L66) and injected via [`vite.config.ts:14-19`](file:///d:/aether_ar/ar-license-guardian/vite.config.ts#L14-L19). `src/lib/build-info.ts` does not exist as a standalone file (split into [`src/lib/adapters/integrity-runtime.ts:6`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/integrity-runtime.ts#L6) and [`src/lib/adapters/licence-runtime.ts:60-73`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence-runtime.ts#L60-L73)). `customerId` and `releaseHash` are not yet included in the activation/refresh HTTP request body ([`licence-runtime.ts:243-250`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence-runtime.ts#L243-L250)). | **HIGH** |
| **3** | **Domain / Deployment Binding** | **CONFIRMED CLOSED** | `allowed_origins text[]` column exists in [`supabase/migrations/20260806071749_a98c7f44-a786-4d89-a782-6d24964f7775.sql:5`](file:///d:/aether_ar/ar-license-guardian/supabase/migrations/20260806071749_a98c7f44-a786-4d89-a782-6d24964f7775.sql#L5). Server-side origin verification strictly enforced in [`src/lib/adapters/licence.server.ts:266-278`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence.server.ts#L266-L278) & [`licence.server.ts:360-373`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence.server.ts#L360-L373) (deny-by-default, rejecting empty/unlisted origins with 403 `ORIGIN_NOT_ALLOWED`). Verified by 20 unit tests in [`tests/security-critical-fixes.test.ts:168-198`](file:///d:/aether_ar/ar-license-guardian/tests/security-critical-fixes.test.ts#L168-L198) and [`tests/licence.test.ts:86-98`](file:///d:/aether_ar/ar-license-guardian/tests/licence.test.ts#L86-L98). | **VERY HIGH** |
| **4** | **Source Maps Disabled in Production** | **CONFIRMED CLOSED** | Production sourcemap disabled via `sourcemap: isProd ? false : "inline"` in [`vite.config.ts:30-32`](file:///d:/aether_ar/ar-license-guardian/vite.config.ts#L30-L32). Production build executed (`NODE_ENV=production bun run build`), emitting **0** `.map` files across `.output/` and `dist/`. | **VERY HIGH** |
| **5** | **Bootstrap Admin Password & No Implicit Admins** | **CONFIRMED CLOSED** | Default admin password/email removed from all configuration files and templates. Standalone provisioning script [`scripts/bootstrap-admin.mjs:1-154`](file:///d:/aether_ar/ar-license-guardian/scripts/bootstrap-admin.mjs#L1-L154) generates 32-char crypto random password and enforces TOTP. Documented in [`README.md:5`](file:///d:/aether_ar/ar-license-guardian/README.md#L5) and [`docs/hosting.md:30`](file:///d:/aether_ar/ar-license-guardian/docs/hosting.md#L30). User signup trigger in [`supabase/migrations/20260725095353_05049894-c89a-47b6-96ed-d87a1f3e776b.sql:33-35`](file:///d:/aether_ar/ar-license-guardian/supabase/migrations/20260725095353_05049894-c89a-47b6-96ed-d87a1f3e776b.sql#L33-L35) sets strictly `viewer` role; non-admins cannot grant admin permissions ([`tests/rls-regression.test.ts:400-415`](file:///d:/aether_ar/ar-license-guardian/tests/rls-regression.test.ts#L400-L415)). | **VERY HIGH** |
| **6** | **License Server Code in Git History** | **STILL OPEN (in Git History)** | `src/lib/adapters/licence.server.ts` and `scripts/sign-manifest.mjs` are present across historical commits (`7290708`, `e300a30`, `4ae94f0`, `38dba28`, `3d19792`, `229af53`, `5dac5f8`) and are recoverable via `git show <hash>:<path>`. Safe delivery requires using `scripts/strip-client-app.sh` followed by a fresh `git init` + single squash commit on client delivery packages. | **VERY HIGH** |

---

## 2. Detailed Item Findings & Forensic Proof

### Item 1: Secrets Audit / Sweep
- **Working Tree Analysis**:
  - `SUPABASE_SERVICE_ROLE_KEY`: Read in function scope inside [`src/integrations/supabase/client.server.ts:34`](file:///d:/aether_ar/ar-license-guardian/src/integrations/supabase/client.server.ts#L34). Never exposed to browser.
  - `LICENCE_PRIVATE_KEY_JWK`: Read in handler scope inside [`src/lib/adapters/licence.server.ts:102`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence.server.ts#L102) and [`src/routes/api/public/licence/manifest.ts:51`](file:///d:/aether_ar/ar-license-guardian/src/routes/api/public/licence/manifest.ts#L51).
  - `RELEASE_MANIFEST_SECRET`: Read inside route handler [`src/routes/api/public/licence/manifest.ts:103`](file:///d:/aether_ar/ar-license-guardian/src/routes/api/public/licence/manifest.ts#L103).
  - `RESEND_API_KEY`: Read inside mailer adapter functions [`src/lib/adapters/mailer.server.ts:23, 37`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/mailer.server.ts#L23).
  - `R2_SECRET` / `R2_ACCESS_KEY_ID`: Read inside handler in [`src/lib/adapters/storage.server.ts:33-34`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/storage.server.ts#L33-L34), but legacy module [`src/lib/storage.server.ts:17-18`](file:///d:/aether_ar/ar-license-guardian/src/lib/storage.server.ts#L17-L18) reads `process.env.R2_ACCESS_KEY_ID` and `process.env.R2_SECRET_ACCESS_KEY` at **module scope**.
  - `DEFAULT_ADMIN_PASSWORD` / `DEFAULT_ADMIN_EMAIL`: 0 instances in working tree code.
  - `JWT_SECRET` / `VENDOR_LICENSE_SECRET`: Only present in inactive deployment examples ([`deploy/self-hosted/.env.example.selfhosted:15, 33`](file:///d:/aether_ar/ar-license-guardian/deploy/self-hosted/.env.example.selfhosted#L15)).
- **Frontend / Client Reachability**: Zero secrets are referenced in `src/components/**` or client routes.
- **Git History Appearance**:
  - `SUPABASE_SERVICE_ROLE_KEY`: Commits `cc4ab9b`, `3014e38`, `b780077`, `0b8ee0b`.
  - `LICENCE_PRIVATE_KEY_JWK`: Commits `85d480b`, `40fb7e2`, `3e2f72a`, `dfe2bdf`, `229af53`.
  - `RELEASE_MANIFEST_SECRET`: Commits `3e2f72a`, `dfe2bdf`, `229af53`.
  - `RESEND_API_KEY`: Commits `05c9b9a`, `af3c11a`, `3e2f72a`, `c87d19b`, `15d8f51`, `dfe2bdf`.
  - `R2_SECRET` / `R2_ACCESS_KEY_ID`: Commits `3e2f72a`, `dfe2bdf`, `229af53`, `64924c6`, `7fba17a`.

---

### Item 2: Build Fingerprinting
- **Environment Reference**: `VITE_BUILD_ID`, `VITE_CUSTOMER_ID`, `VITE_RELEASE_HASH` are present in [`.env.example:64-66`](file:///d:/aether_ar/ar-license-guardian/.env.example#L64-L66).
- **Injection Layer**: Defined in [`vite.config.ts:14-19`](file:///d:/aether_ar/ar-license-guardian/vite.config.ts#L14-L19) using Vite's `define` block for client-side evaluation.
- **Runtime Integrity & Attestation**:
  - `src/lib/adapters/licence-runtime.ts:60-73` evaluates `buildIntegrityOk()` ensuring non-placeholder values before app boots.
  - `src/lib/watermark.ts:79-92` embeds `VITE_CUSTOMER_ID` into DOM metadata and `window.__aether`.
  - `src/lib/adapters/integrity-runtime.ts:37-44` builds runtime chunk hash `assetDigest` paired with `BUILD_ID`.
- **Gap / Reason for Partial Closure**:
  - `src/lib/build-info.ts` does not exist as a single consolidated file.
  - While `buildId` and `assetDigest` are sent in the activation request body ([`licence-runtime.ts:249`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence-runtime.ts#L249)), `customerId` and `releaseHash` are not explicitly transmitted in the POST body to `/api/public/licence/activate` or `/refresh`.

---

### Item 3: Domain / Deployment Binding
- **Database Schema**: Column `allowed_origins text[] NOT NULL DEFAULT '{}'::text[]` on table `public.licenses` added in [`supabase/migrations/20260806071749_a98c7f44-a786-4d89-a782-6d24964f7775.sql:5`](file:///d:/aether_ar/ar-license-guardian/supabase/migrations/20260806071749_a98c7f44-a786-4d89-a782-6d24964f7775.sql#L5).
- **Server Enforcement**:
  - `src/routes/api/public/licence/activate.ts:37, 57-68` extracts `originHost` from request headers via `serverDerivedOrigin(request)`.
  - `src/lib/adapters/licence.server.ts:266-278` enforces `originAllowed(allowed, host)`:
    - Denies if `allowed_origins` is `null` or empty array `[]` (deny-by-default).
    - Denies if `host` is `null` or unlisted.
    - Matches exact host or valid subdomains (`*.domain.com`).
  - `src/lib/adapters/licence.server.ts:360-373` records `origin_not_allowed` or `origins_not_configured` violations and halts with `403 ORIGIN_NOT_ALLOWED`.

---

### Item 4: Source Maps
- **Configuration**: [`vite.config.ts:30-32`](file:///d:/aether_ar/ar-license-guardian/vite.config.ts#L30-L32):
  ```ts
  build: {
    sourcemap: isProd ? false : "inline",
  }
  ```
- **Physical Build Verification**:
  - Command: `$env:NODE_ENV="production"; bun run build`
  - Output directories checked: `.output/` (public, server, SSR) and `dist/`.
  - Scan result: **0** `.map` files detected across the entire output tree.

---

### Item 5: Bootstrap Admin Password
- **Default Elimination**: Searches for `DEFAULT_ADMIN_PASSWORD` and `DEFAULT_ADMIN_EMAIL` returned 0 matches in `.env.example`, `docs/hosting.md`, `README.md`, or source code.
- **Provisioning Engine**: [`scripts/bootstrap-admin.mjs`](file:///d:/aether_ar/ar-license-guardian/scripts/bootstrap-admin.mjs) accepts `--email`, verifies that no admin exists in `user_roles`, generates a 32-character crypto-secure random password, creates the Supabase user, assigns `admin` role, and requires immediate password change and TOTP enrollment.
- **No Implicit Elevation**:
  - `supabase/migrations/20260725095353_05049894-c89a-47b6-96ed-d87a1f3e776b.sql:33-35` sets default signup role to `'viewer'` with `approval_status = 'pending'`.
  - RLS policies on `user_roles` grant only `SELECT` to `authenticated` users, preventing self-promotion.

---

### Item 6: License Server Code in Git History
- **Historical Git Log Trace**:
  - `src/lib/adapters/licence.server.ts`: Commits `7290708`, `e300a30`, `4ae94f0`, `38dba28`, `2b05c45`, `673e1f1`, `64a6416`, `c87d19b`, `3d19792`, `229af53`.
  - `scripts/sign-manifest.mjs`: Commits `7290708`, `4ae94f0`, `3d19792`, `5dac5f8`, `229af53`.
  - `src/routes/api/public/licence/activate.ts` & `manifest.ts`: Commits `7290708`, `e300a30`, `637a5a1`, `fedb8f7`, `bddd7b3`, `16e8930`, `161bbe9`, `38dba28`.
- **Recoverability**: Running `git show 38dba28:src/lib/adapters/licence.server.ts` reconstructs the entire issuer signing engine.
- **Required Operational Delivery Protocol**: Client repositories must NEVER be delivered with original `.git` history. Operators must use `scripts/strip-client-app.sh` and initialize a fresh repository (`git init` + squash commit) per [`scripts/verify-client-branch.mjs`](file:///d:/aether_ar/ar-license-guardian/scripts/verify-client-branch.mjs) and [`CLIENT_README.md`](file:///d:/aether_ar/ar-license-guardian/CLIENT_README.md).

---

## 3. Recommended Next Actions for Open / Partial Items

- **For Item 1 (Secrets Audit)**:
  - Refactor [`src/lib/storage.server.ts:16-20`](file:///d:/aether_ar/ar-license-guardian/src/lib/storage.server.ts#L16-L20) to read environment variables inside `getR2Client()` rather than at top-level module evaluation.
  - Rotate all Supabase and Cloudflare credentials in production dashboards before distributing client packages. *(Addresses Prompt 8 / Env Hardening)*.

- **For Item 2 (Build Fingerprinting)**:
  - Create consolidated `src/lib/build-info.ts` exporting `{ buildId, customerId, releaseHash }`.
  - Add `customerId` and `releaseHash` to the JSON payload in [`src/lib/adapters/licence-runtime.ts:243-250`](file:///d:/aether_ar/ar-license-guardian/src/lib/adapters/licence-runtime.ts#L243-L250) and validate on the server in [`src/routes/api/public/licence/activate.ts`](file:///d:/aether_ar/ar-license-guardian/src/routes/api/public/licence/activate.ts). *(Addresses Prompt 2 / Build Fingerprinting)*.

- **For Item 6 (License Server Code in Git History)**:
  - Maintain the automated `bun run verify:client` (`scripts/verify-client-branch.mjs`) pre-flight check in CI to guarantee that shipped customer tarballs and client repos are created via a fresh `git init` without historical commits. *(Addresses Prompt 6 / Repository Delivery Separation)*.
