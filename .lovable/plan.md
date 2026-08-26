# Interior Design AR — Implementation Plan (Pilot)

Add markerless room visualization ("see this sofa / paint / floor in my room") alongside the
existing marker-based Aether AR viewer. No app download: WebAR only, same TanStack Start app,
same auth, same per-project ownership and licensing rules.

## 1. Decisions taken up front

| Item | Decision |
| --- | --- |
| AR type | Markerless SLAM + plane detection (no QR/marker) |
| Platform | WebAR — browser only, no install |
| Android/Chrome | WebXR `immersive-ar` with `hit-test` (live 6DoF placement) |
| iOS/Safari | No WebXR → USDZ AR Quick Look fallback (`<model-viewer ar>`) |
| Model formats | GLB/glTF (Android/Web) + USDZ (iOS) — both required per SKU |
| Hosting | Our own model library in R2, private, served via existing signed-URL path |
| Branding | White-label — reuses existing design tokens, no third-party logos |
| Vendors | None. Built in-house on WebXR + three.js (already a dependency) |

MVP scope: **one item placed at a time**, wall (vertical) + floor (horizontal) planes, screenshot
capture. Multi-item scenes, occlusion, and checkout are Phase 2.

## 2. Data model (new migration)

Two new tables, owned per `project_id` exactly like `ar_experiences`, with GRANTs + RLS scoped
to `owner_id` (and admin via `has_role`).

- `design_catalogs` — `id, project_id, owner_id, name, slug, is_active, created_at`
- `catalog_items` — `id, catalog_id, owner_id, name, sku, category` (`furniture` | `paint` |
  `flooring`), `glb_path, usdz_path, thumb_path, width_m, height_m, depth_m, color_hex,
  placement` (`floor` | `wall`), `sort_order, is_active`

Analytics reuses the existing `scan_events` table with a new `event_type` of `ar_place`, so
"which items get placed most" needs no new table.

## 3. Server layer (no direct DB from UI)

New `src/lib/catalog.functions.ts` (thin wrapper, logic in `catalog.server.ts`):

- `listCatalogs`, `createCatalog`, `updateCatalog`, `deleteCatalog` — authenticated, owner-scoped
- `listCatalogItems({ catalogSlug })` — public read of *active* items only, safe columns +
  short-TTL signed GLB/USDZ/thumb URLs via existing `access.server.ts` helpers
- `signCatalogUpload` — reuses `uploader-guard.server.ts` (`authorizeUploader` +
  `scopeUploadPath`) so editors upload only under their own prefix
- `logPlacement` — rate-limited item-placement event into `scan_events`

Presign gating (`presign-gate.server.ts`) applies to catalog assets the same as AR media, so
licence state still governs asset delivery.

## 4. Client: the AR room viewer

New route `src/routes/room.$catalog.tsx` (public, own `head()` metadata).

- Capability probe on mount: `navigator.xr?.isSessionSupported('immersive-ar')`
  - **supported** → WebXR path
  - **not supported** → iOS Quick Look path (USDZ) or a "not supported on this browser" card
- WebXR path, in a new `src/components/room/RoomArSession.tsx`:
  - `three` WebGLRenderer with `xr.enabled`, session requested with
    `requiredFeatures: ['hit-test']`, `optionalFeatures: ['dom-overlay','light-estimation']`,
    `domOverlay: { root: uiRef.current }` so the catalog drawer renders over the camera feed
  - reticle driven by an `XRHitTestSource` from the viewer space; tap places the loaded GLB at
    the hit pose, anchored (uses `XRAnchor` when available, otherwise the hit matrix)
  - `placement: 'wall'` items snap to vertical hit normals, `'floor'` to horizontal
  - real-world scale straight from `width_m/height_m/depth_m` — no manual scaling
  - paint/flooring items render as a tinted plane/quad rather than a mesh
  - single-item MVP: placing a new item replaces the current one; drag to reposition,
    two-finger twist to rotate on Y
- Reuses the existing `webgl-recovery.ts` context-lost handling and `ar-runtime.ts` device-tier
  resolution capping so mid-range phones stay smooth.
- Session cleanup on unmount (end session, stop tracks, dispose renderer/geometries).

iOS fallback (`src/components/room/QuickLookFallback.tsx`): `<model-viewer>` loaded from our
vendored assets with `ar ar-modes="quick-look webxr scene-viewer"` and the signed USDZ URL.
Tracking quality is Apple's; placement UI is theirs. Documented as an expected difference.

Capture: `renderer.domElement.toDataURL()` composited over a captured camera frame on the
WebXR path; Quick Look uses the OS-native screenshot (documented, not built).

## 5. Dashboard: catalog management

New `src/routes/_authenticated/dashboard.catalogs.tsx` (+ `dashboard.catalogs.$id.tsx`):

- Create a catalog, get a shareable `/room/<slug>` link and a QR via the existing
  `QRCodeDialog`
- Item editor: name, SKU, category, real dimensions in metres, placement surface, colour swatch
  for paint/flooring, GLB + USDZ + thumbnail upload through `MediaUploader`
- Validation: GLB and USDZ both required for furniture, size cap (default 15 MB per model) with
  a soft warning above 8 MB, dimensions must be non-zero
- Nav entry added to the dashboard sidebar behind a new `catalog` feature flag in
  `deployment.server.ts` (on for all branches by default, so it ships in `client-app` too)
- `scripts/verify-client-branch.mjs` updated to assert the catalog route survives stripping

## 6. Analytics

Extend `dashboard.analytics.tsx` with a "Room AR" panel: sessions started, AR-supported vs
fallback split, placements per item (top SKUs), and screenshot saves. All read through
`analytics.functions.ts`, no new client DB access.

## 7. Content pipeline (the real bottleneck)

Documented in a new `docs/room-ar-content.md`:

- Per SKU: GLB (Draco-compressed, ≤ 5 MB, Y-up, origin at floor contact point, real-world
  metres) + USDZ converted with Apple's `usdzconvert` or Reality Converter
- Texture budget 2K max, single material where possible
- Paint/flooring need no model — just a hex/texture swatch
- Pilot target: 25–50 SKUs

## 8. Out of scope for this phase

Occlusion (LiDAR depth), multi-item room layouts, saved/shared design projects, e-commerce
checkout, outdoor/geospatial AR, AI virtual staging.

## 9. Build order

1. Migration + GRANTs + RLS for `design_catalogs` / `catalog_items`
2. `catalog.server.ts` + `catalog.functions.ts` + upload guard wiring
3. Dashboard catalog CRUD + item editor + feature flag + branch verify
4. `/room/$catalog` route: capability probe, WebXR hit-test placement, catalog drawer
5. iOS Quick Look fallback + unsupported-browser card
6. Screenshot capture + placement analytics + analytics panel
7. `docs/room-ar-content.md`, device matrix update, CI/lint/typecheck pass

## 10. Open questions

1. Should the room viewer be **public** (anyone with the link) or gated behind the existing
   PIN/QR-token access like AR experiences?
2. Furniture, paint, and flooring all in the pilot — or narrow to one to cut modelling cost?
3. Do catalog items need to sync from an existing product catalog/CMS, or is dashboard-managed
   enough for the pilot?
