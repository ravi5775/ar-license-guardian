# Aether AR — Client Deployment & Operating Manual

Welcome to your dedicated **Aether AR** web experience platform.

---

## 1. Quickstart & Deployment (Cloudflare Pages)

### Step 1: Database Setup
1. Create a free project at [Neon.tech](https://neon.tech) or [Supabase.com](https://supabase.com).
2. Open the SQL Editor and execute the schema provided in `supabase/client-schema.sql`.
3. Copy your database connection string (`DATABASE_URL`).

### Step 2: Cloudflare R2 Media Storage
1. Go to **Cloudflare Dashboard** → **R2** → **Create Bucket**.
2. Name your bucket (e.g. `yourstudio-ar-media`).
3. Set the bucket access to **Private** (do not enable public R2.dev URLs).
4. Apply the CORS policy provided in your delivery package (`r2-cors.json`).

### Step 3: Cloudflare Pages Deployment
1. Connect this repository branch (`client-app`) to Cloudflare Pages.
2. Build Settings:
   - **Framework Preset:** None / Vite
   - **Build Command:** `bun run build` (or `npm run build`)
   - **Output Directory:** `dist`
3. Add your Environment Variables (from your provided `.env.client` file):
   - `VITE_LICENCE_KEY`
   - `VITE_LICENCE_API_URL`
   - `VITE_LICENCE_PUBLIC_KEY`
   - `VITE_CUSTOMER_ID`
   - `VITE_BUILD_ID`
   - `DATABASE_URL`
   - `R2_ACCOUNT_ID` / `R2_BUCKET` / `R2_ACCESS_KEY_ID` / `R2_SECRET`

---

## 2. Pre-Flight Verification Wizard

Once deployed, visit:
`https://your-domain.com/setup`

The setup wizard will test your environment variables, verify license connectivity, and confirm your R2/database bindings.

---

## 3. Creating & Publishing AR Albums

1. Log into your dashboard at `/auth`.
2. Navigate to **Albums** → **Create Album**.
3. Upload target wedding/event photographs and corresponding highlight video clips.
4. Download the generated QR codes and embed them on physical print cards or albums.
5. Guests scan the QR code to open the viewer directly in Mobile Safari or Chrome with zero app installation required.

---

## 4. Troubleshooting & Support

- **Device Limits**: Standard plans include 1 mobile device slot + 1 desktop slot. To switch workstations, click **Release Device** in the footer.
- **Offline Mode**: If event venue Wi-Fi drops, the AR viewer maintains a 24-hour offline grace window with cached assets.
