# Room AR content pipeline

This pilot ships a public room viewer for one item at a time with wall and floor placement. The content pipeline is intentionally practical and strict: each SKU needs the right geometry, the right metadata, and the right delivery format for both WebXR and iOS Quick Look.

## Required asset set per SKU

- GLB or glTF binary with a real-world scale that matches the product dimensions.
- USDZ version for Quick Look fallback on iPhone/iPad Safari.
- Thumbnail image for the catalog drawer.
- Metadata: width_m, height_m, depth_m, category, placement, color_hex, SKU, and the catalog slug.

## Geometry guidance

- Keep the mesh Y-up and place the origin at the floor-contact point for floor items.
- Wall items should align to a vertical plane and keep a natural wall anchor point.
- Use real-world metres in the asset itself; do not rely on arbitrary scene scaling.
- Aim for a single material and a compact topology; 2K texture budgets keep downloads manageable.

## Asset delivery constraints

- Target GLB payloads at or below 5 MB for the pilot set.
- Use Draco compression when possible and avoid unnecessary animations.
- Keep the USDZ conversion faithful to the model, with Apple's Reality Converter or `usdzconvert`.
- Paint and flooring entries should render as swatches or simple quads rather than complex 3D meshes.

## Catalog composition

- Pilot target: 25 to 50 SKUs across furniture, paint, and flooring.
- Publish only active catalog items and keep the room catalog itself separate from the marker-based AR experiences.
- Use the dashboard catalog editor to upload all three files: GLB, USDZ, and thumbnail.

## Quality bar

- No item should ship without both GLB and USDZ.
- Dimensions must be greater than zero and realistic.
- Uploads above 8 MB should trigger a soft warning; files above the hard upload cap are rejected.

## Release note

This is a room-viewing pilot only. Multi-item scenes, occlusion, and checkout remain for the next phase.
