# Aether AR — Client Onboarding Runbook

This runbook specifies the exact step-by-step automated workflow for onboarding a new paying client running their own Cloudflare Pages + R2 deployment.

---

## Prerequisites

On your operator machine:
- Node.js 20+ / Bun
- Cloudflare API Token (Permissions: `R2:Edit`, `Pages:Edit`)
- Supabase Admin Credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- Ed25519 Private Key for signing (`LICENCE_PRIVATE_KEY_JWK`)

---

## Step-by-Step Onboarding Execution

### Step 1: Create the Customer License Record
Run the license wizard to register the customer in your central license authority:

```bash
SUPABASE_URL="https://your-admin.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
node scripts/onboarding/license-wizard.mjs \
  --name="Royal Wedding Studio" \
  --email="studio@royalwedding.com" \
  --domain="ar.royalwedding.com" \
  --plan="pro" \
  --mobile=1 \
  --desktop=1
```
*Note the returned `Customer ID` and `Licence Key`.*

---

### Step 2: Generate the Client Environment & Build Fingerprint
Generate the customer-specific configuration package:

```bash
node scripts/provision-client.mjs \
  --name="Royal Wedding Studio" \
  --domain="ar.royalwedding.com" \
  --slug="royal-wedding" \
  --plan="pro"
```
This produces `.env.client-royal-wedding` with embedded `VITE_CUSTOMER_ID` and prints a one-time bootstrap admin password.

---

### Step 3: Provision Customer R2 Bucket & Locked CORS
Create their storage bucket and configure CORS locked to their exact domain:

```bash
CF_ACCOUNT_ID="client-or-vendor-cf-account-id" \
CF_API_TOKEN="client-or-vendor-cf-api-token" \
node scripts/onboarding/r2-create-bucket.mjs \
  --bucket="aether-media-royal-wedding"

node scripts/onboarding/r2-install-cors.mjs \
  --bucket="aether-media-royal-wedding" \
  --domain="ar.royalwedding.com"
```

---

### Step 4: Build & Sign Release Manifest
Compile the frontend bundle for the customer and generate the signed Ed25519 manifest:

```bash
# 1. Compile with customer environment
export $(cat .env.client-royal-wedding | grep -v '^#' | xargs)
bun run build

# 2. Sign the bundle manifest
BUILD_ID="royal-wedding-v1.0" \
CUSTOMER_ID="$VITE_CUSTOMER_ID" \
LICENCE_PRIVATE_KEY_JWK='{...}' \
LICENCE_API_URL="https://admin.your-domain.com" \
RELEASE_MANIFEST_SECRET="your-manifest-secret" \
node scripts/sign-manifest.mjs dist/client
```

---

### Step 5: Configure Cloudflare Pages Environment
Upload the customer environment variables to their Cloudflare Pages project:

```bash
CF_ACCOUNT_ID="client-cf-account-id" \
CF_API_TOKEN="client-cf-api-token" \
node scripts/onboarding/pages-install-env.mjs \
  --project="royal-wedding-ar" \
  --env-file=".env.client-royal-wedding"
```

---

### Step 6: Validate DNS & Allowed Origins
Run pre-flight verification before handing over the deployment:

```bash
SUPABASE_URL="https://your-admin.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key" \
node scripts/onboarding/dns-validate.mjs \
  --domain="ar.royalwedding.com" \
  --license-key="AETH-XXXX-XXXX-XXXX"
```

---

## Handover Deliverables for Customer
1. Domain DNS confirmation (`ar.royalwedding.com` pointing to Cloudflare Pages).
2. Cleaned `client-app` repository (stripped of all admin/issuer code).
3. Licence Agreement (`LICENSE_AGREEMENT.md`) with customer ID and domain schedule.
