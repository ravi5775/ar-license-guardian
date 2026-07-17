## Goal

Two problems to fix:
1. **QR flow is broken** — scanning from Google Lens used to open the AR page and autoplay; now it doesn't. Users also want to scan the QR *from inside the site* instead of leaving to a camera app.
2. **AR viewer is laggy** — MindAR + A-Frame is heavy on mid-range phones.

## Part 1 — In-app QR scanner

Add a "Scan QR" entry point on the site so users never leave the browser.

- New route `src/routes/scan.tsx` with a full-screen camera view that decodes QR codes live.
- Use **`@zxing/browser`** (pure JS, ~50KB gz, no WASM, works on iOS Safari + Android Chrome). Lighter and more reliable than `jsQR` for live video.
- On decode: if the payload URL points to our own origin `/ar/<slug>`, navigate client-side (fast, no reload). Otherwise show the URL with an "Open" confirm button (safety — don't auto-follow arbitrary URLs).
- Add a **"Scan QR"** button in the site header and on the landing hero so it's discoverable.
- Handle camera permission denial, no-camera devices, and non-HTTPS contexts with a clear message.

## Part 2 — Fix the "used to autoplay, now doesn't" regression

Likely cause: mobile browsers block `autoplay` on `<video>` without a user gesture, and our recent scene rebuild lost the `muted` + `playsinline` combo required for iOS autoplay. Also the `.mind` marker path may have changed the code branch.

Fixes on `src/routes/ar.$slug.tsx`:
- Ensure the `<video id="ar-media">` asset has `muted`, `playsinline`, `webkit-playsinline`, `autoplay` set as **attributes** (not just properties) before it's added to `<a-assets>`. iOS reads them at parse time.
- In the "Launch AR" click handler (already a user gesture), pre-call `video.play().catch(()=>{})` so the browser records the gesture.
- Fallback: if `play()` rejects, show a tap-to-play overlay on the video plane.
- Fix the plain-camera fallback video the same way (currently missing `muted`, which is why iOS silently blocks autoplay).

## Part 3 — Reduce AR lag

Cheap wins without swapping the engine:

- **Lower MindAR filter/tracking cost**: pass tuning params `maxTrack: 1; filterMinCF: 0.0001; filterBeta: 0.01; warmupTolerance: 5; missTolerance: 5` — cuts per-frame CPU noticeably.
- **Downscale the video source**: constrain `getUserMedia` to `{ width: 640, height: 480, frameRate: 30 }` before MindAR grabs it (MindAR reads from `<video>`; smaller frame = less work per frame).
- **Compress the overlay media**: add a note in the upload UI recommending ≤720p H.264 for the video overlay; oversized 1080p/4K clips are the #1 lag source. (No transcoding server-side — just guidance + a soft warning if file >20 MB.)
- **Compress the `.mind` marker input image** before compilation guidance updated (smaller marker → smaller `.mind` → faster warm start).
- **Preload MindAR scripts** on the pre-launch screen (in parallel with the user reading the intro) instead of only after "Launch AR" is tapped — feels much snappier.
- **Lazy-mount the scene** with `requestIdleCallback` fallback so the initial paint isn't blocked.

## Part 4 — Small UX polish

- Add a "Having trouble? Tap here" link on the AR page that jumps straight to the plain-camera fallback (bypasses MindAR entirely for weak devices).
- Show a subtle FPS/tracking indicator in dev only.

## Files touched

- **New**: `src/routes/scan.tsx` (in-app QR scanner)
- **New**: `src/components/QRScannerButton.tsx` (header/hero entry)
- **Edit**: `src/routes/ar.$slug.tsx` (autoplay fix, perf tuning, preloaded scripts, tap-to-play fallback)
- **Edit**: `src/routes/index.tsx` (add "Scan QR" CTA in hero)
- **Edit**: `src/routes/__root.tsx` or header component (nav link to `/scan`)
- **Edit**: `src/routes/_authenticated/dashboard.experiences.tsx` (soft warning on oversized media)
- **Package**: `bun add @zxing/browser @zxing/library`

## Out of scope (ask before doing)

- Replacing MindAR with a lighter engine (e.g. AR.js NFT, or a WebGPU tracker) — bigger project.
- Server-side video transcoding to force ≤720p (needs a worker + ffmpeg-wasm; adds cost).

## Confirm before I build

1. OK to add `@zxing/browser` (~50KB) for in-app QR scanning?
2. Should the scanner **auto-navigate** on any URL from our own domain, or always show a confirm step?
3. Add a size warning at what threshold — **20 MB** for overlay video sounds right?
