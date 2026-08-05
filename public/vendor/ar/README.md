# Vendored AR engine (same-origin)

These files are byte-for-byte copies of the exact upstream builds the AR
viewer and the album compiler load. They are served from our own origin so
that:

- a compromise of jsdelivr / aframe.io cannot inject script into `/ar/*`,
- CSP can stay at `script-src 'self'` with no third-party script host,
- an outage at a CDN cannot kill an AR viewer in the middle of a wedding.

| File | Upstream |
| --- | --- |
| `aframe-1.5.0.min.js` | `https://aframe.io/releases/1.5.0/aframe.min.js` |
| `mindar-image-aframe-1.2.5.prod.js` | `https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image-aframe.prod.js` |
| `mindar-image-1.2.5.prod.js` | `https://cdn.jsdelivr.net/npm/mind-ar@1.2.5/dist/mindar-image.prod.js` |
| `controller-mGt1s8dJ.js` | sibling ES chunk imported by `mindar-image.prod.js` |
| `ui-fBadYuor.js` | sibling ES chunk imported by `mindar-image.prod.js` |

`mindar-image.prod.js` is an **ES module** that imports the two hashed sibling
chunks by relative path — all three must be updated together, and the chunk
filenames change on every upstream release.

## Re-vendoring on a version bump

```bash
V=1.2.5   # <- new mind-ar version
A=1.5.0   # <- new A-Frame version
cd public/vendor/ar
curl -sSfL -o "aframe-$A.min.js" "https://aframe.io/releases/$A/aframe.min.js"
curl -sSfL -o "mindar-image-aframe-$V.prod.js" \
  "https://cdn.jsdelivr.net/npm/mind-ar@$V/dist/mindar-image-aframe.prod.js"
curl -sSfL -o "mindar-image-$V.prod.js" \
  "https://cdn.jsdelivr.net/npm/mind-ar@$V/dist/mindar-image.prod.js"

# Pull whatever sibling chunks the new module imports:
grep -oE 'from *"\./[^"]+"' "mindar-image-$V.prod.js" |
  sed 's|.*\./||;s|"||' |
  while read -r f; do
    curl -sSfL -o "$f" "https://cdn.jsdelivr.net/npm/mind-ar@$V/dist/$f"
  done

# Record hashes so a future diff can prove the files were not tampered with.
sha384sum *.js > SHA384SUMS.txt
```

Then update the paths in `src/lib/mindar-compiler.ts` and the `MINDAR_SCRIPTS`
arrays in `src/routes/ar.$slug.tsx` and `src/routes/ar.album.$slug.tsx`.

## Verifying integrity later

```bash
cd public/vendor/ar && sha384sum -c SHA384SUMS.txt
```
