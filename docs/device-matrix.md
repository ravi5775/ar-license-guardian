# Aether AR — Real-Device AR Verification Matrix & Test Plan

This document outlines the scripted test matrix for validating the Aether AR runtime, WebGL context lifecycle, and security gates across real mobile devices and browsers.

---

## 1. Target Hardware & Browser Matrix

| Platform Tier | Target Device Profile | Primary Browser | Key Hardware Constraints | Target FPS |
|---|---|---|---|---|
| **Tier 1 (iOS High)** | iPhone 14 / 15 / 16 Pro | Mobile Safari (iOS 17.x / 18.x) | WebGL 2.0, Metal, A16+ Bionic | 60 FPS |
| **Tier 2 (Android Flagship)** | Samsung Galaxy S23 / S24, Pixel 8 / 9 | Chrome Mobile (v125+) | Adreno 740 / Mali-G715, 8GB+ RAM | 60 FPS |
| **Tier 3 (Android Mid/Low)** | Redmi Note 11 / Moto G / Galaxy A14 | Chrome Mobile | Mali-G52 / Adreno 610, 3–4GB RAM | 30–45 FPS |

---

## 2. Scripted Manual Test Procedures

### Test 2.1: Camera Permission Rejection & Recovery
- **Objective**: Ensure the AR viewer gracefully displays the camera permission fallback UI without unhandled exceptions or blank screens.
- **Steps**:
  1. Open `/ar/<album-slug>` in incognito/private mode.
  2. When prompted: **Deny / Block Camera Access**.
  3. Verify UI displays: *"Camera access is required for AR scanning"* with clear instructions for iOS (Settings → Safari → Camera) or Android (Site Settings → Camera).
  4. Manually re-grant permission in browser settings and tap **Retry**.
  5. **Pass Criteria**: Video stream attaches immediately; scanning reticle appears.

---

### Test 2.2: WebGL Context-Lost & Lifecycle Recovery
- **Objective**: Verify that switching away from the browser tab or receiving an incoming phone call does not crash the 3D scene or freeze MindAR.
- **Steps**:
  1. Open the AR viewer and successfully lock tracking on an album image.
  2. Switch to another app or lock the device for 15 seconds (forces WebGL context pause / memory purge on iOS).
  3. Unlock and return to Safari / Chrome.
  4. Trigger `webglcontextlost` simulation via DevTools or heavy memory usage.
  5. **Pass Criteria**: `webglcontextrestored` event triggers; MindAR compiler reinstates tracking pipeline without requiring a manual page refresh.

---

### Test 2.3: Album Multi-Target Tracking & Switching
- **Objective**: Verify stable tracking across multi-page photo albums without cross-target video bleeding.
- **Steps**:
  1. Load a multi-marker album containing 5 distinct photo targets.
  2. Aim camera at Target #1: Confirm Video #1 plays with audio unmuted on tap.
  3. Pan camera smoothly to Target #2: Confirm Video #1 pauses and detaches; Video #2 anchors to Target #2.
  4. Rapidly pan back and forth between targets.
  5. **Pass Criteria**: Zero texture flicker; correct audio stream mapped to active target; memory stays below 180MB.

---

### Test 2.4: PIN Gate Authentication & Session Expiry
- **Objective**: Validate bcrypt-hashed PIN gate on private wedding albums.
- **Steps**:
  1. Navigate to a PIN-protected album (`/ar/album/<private-slug>`).
  2. Enter incorrect 4-digit PIN 3 times: Verify progressive throttle (1s, 2s, 4s delay).
  3. Enter correct PIN: Confirm instant unlock and JWT storage in `sessionStorage`.
  4. Open in a secondary tab: Confirm session cookie unlocks without reprompting.
  5. **Pass Criteria**: No plaintext PIN in network requests; brute force throttled fail-closed.

---

### Test 2.5: Offline Grace Execution
- **Objective**: Verify offline playback behavior when event venue loses cellular connectivity.
- **Steps**:
  1. Load AR album while online (authenticates and downloads cached `.mind` and asset manifests).
  2. Enable Airplane Mode (complete network disconnect).
  3. Reload the page: Confirm client licence runtime uses cached signed token.
  4. Verify tracking and video playback continue for the duration of the 24-hour grace window.
  5. **Pass Criteria**: No blank blocking screen; UI displays *"Offline Mode (Grace Active)"* badge.

---

## 3. Remote Field Telemetry & Diagnostics

Every client device reports capability tier and initialization metrics during activation:
- **`lite`**: Devices with ≤4 CPU cores or ≤3GB RAM (triggers downscaled tracking resolution 480p).
- **`standard`**: Devices with 6 cores / 4–6GB RAM (720p tracking).
- **`high`**: Flagship iOS/Android (1080p tracking with 60fps smoothing).

Failure codes are recorded server-side in `license_violations` and visible in `/dashboard/diagnostics`.
