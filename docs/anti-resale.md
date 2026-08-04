# Anti-resale: what actually raises the cost

The client-side fingerprint check in `src/routes/api/public/license/activate.ts`
is a deterrent only. The buyer holds the source; they can strip it. The signed
Source License Agreement is the enforcement mechanism. Below are two additions
that raise the cost of resale without pretending to make it impossible.

## 1. Per-client watermark baked in server-side at asset generation

When an album's `.mind` target file and transcoded media are generated, embed a
per-client identifier server-side — before the asset ever reaches the client
bundle:

- A low-alpha, spatially distributed watermark (client ID + issue date) burned
  into the transcoded video and any generated cover images.
- The same client ID written into the `.mind` file's metadata block and into
  the album record.

Because it is applied at generation time on our infrastructure, it cannot be
removed by editing the delivered front-end code. A reseller would have to
re-transcode every asset — which is exactly the point: it converts "copy the
folder" into "rebuild the product".

**Honest limit:** re-encoding at lower quality can degrade a visual watermark.
Treat it as attribution evidence, not DRM.

## 2. Server-side deployment check-in, logged not blocked

On first load of any deployed instance, the front end posts
`{ deployment_domain, supabase_ref, license_key }` to our endpoint. We log it
with a timestamp. We do **not** block on the result.

Why not block: a hard block breaks the client's wedding-day event when our
service has an outage, and generates support calls we do not want. Logging
gives us a dated record of "license X appeared on domain Y on date Z", which is
the evidence a contract dispute actually needs.

**Honest limit:** stripped client code stops checking in. Absence of a check-in
proves nothing; presence of an unexpected domain proves quite a lot.
