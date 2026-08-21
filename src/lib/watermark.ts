/**
 * ============================================================================
 * AETHER AR — Build Watermark (Anti-Resale Tracing)
 * ============================================================================
 * Embeds a customer-specific identifier into the compiled output in two ways:
 *
 * 1. VISIBLE (comment in source): `/* @aether:c:CUSTOMER_ID:BUILD_ID *\/`
 *    Survives most minification. Stripped from production by advanced minifiers
 *    but present in a standard Vite build.
 *
 * 2. INVISIBLE (steganographic string): Encodes the customer ID in the Unicode
 *    variation selector range (U+FE00–U+FE0F) attached to a zero-width
 *    space. Invisible in rendered text but readable by the detection script.
 *
 * Usage in app root (e.g. src/main.tsx or src/App.tsx):
 *   import { initWatermark } from "@/lib/watermark";
 *   initWatermark();
 *
 * The watermark is a no-op in non-production builds and adds <100 bytes to
 * the bundle.
 * ============================================================================
 */

/* @aether:watermark:DO_NOT_REMOVE — licensed software, tamper evidence active */

function envVar(name: string): string | undefined {
  return (import.meta.env as Record<string, string | undefined>)[name];
}

/**
 * Encodes a hex string into Unicode variation selectors (invisible characters).
 * Each hex nibble maps to U+FE0{0-F}.
 */
function encodeInvisible(hex: string): string {
  return hex
    .split("")
    .map((c) => {
      const n = parseInt(c, 16);
      return String.fromCodePoint(0xfe00 + n);
    })
    .join("\u200b"); // zero-width space between each nibble selector
}

/**
 * Retrieves the watermark from a string containing invisible variation selectors.
 * Returns the decoded hex string or null if no watermark is found.
 */
export function decodeWatermark(text: string): string | null {
  try {
    const nibbles = text
      .split("\u200b")
      .map((c) => {
        const cp = c.codePointAt(0);
        if (!cp || cp < 0xfe00 || cp > 0xfe0f) return null;
        return (cp - 0xfe00).toString(16);
      })
      .filter(Boolean);
    if (nibbles.length < 8) return null;
    return nibbles.join("");
  } catch {
    return null;
  }
}

/**
 * Initialise the watermark. Injects the customer identity into:
 *   1. A window property (inspectable via browser console on a leaked build).
 *   2. An invisible Unicode string appended to document.title.
 *   3. A <meta> tag with encoded customer ID.
 *
 * This is intentionally not obfuscated — the goal is forensic identification
 * of the source of a leak, not DRM. It cannot prevent a determined attacker
 * but it creates legal evidence.
 */
export function initWatermark(): void {
  if (typeof window === "undefined") return;
  if (import.meta.env.MODE !== "production") return;

  const customerId = envVar("VITE_CUSTOMER_ID");
  const buildId = envVar("VITE_BUILD_ID");

  if (!customerId || !buildId) return;

  const customerHex = customerId.replace(/-/g, "");
  const invisible = encodeInvisible(customerHex.slice(0, 16));

  // 1. Window property (visible to console.log(window.__aether))
  (window as Record<string, unknown>).__aether = {
    c: customerId,
    b: buildId,
    t: Date.now(),
  };

  // 2. Invisible Unicode appended to title
  try {
    document.title = document.title + "\u200b" + invisible;
  } catch {
    // ignore — SSR or restricted environment
  }

  // 3. Meta tag
  try {
    const meta = document.createElement("meta");
    meta.name = "x-aether-build";
    meta.content = `${buildId}\u200b${invisible}`;
    document.head.appendChild(meta);
  } catch {
    // ignore
  }

  // 4. CSS custom property on :root
  try {
    document.documentElement.style.setProperty("--aether-cid", customerId);
  } catch {
    // ignore
  }
}

/**
 * ============================================================================
 * DETECTION SCRIPT (run offline to trace a leaked build)
 * ============================================================================
 * To identify which customer a leaked build came from:
 *
 * 1. Open the leaked app in a browser.
 * 2. In DevTools console, run:
 *      console.log(window.__aether)
 *    → Output: { c: "<customerId>", b: "<buildId>", t: <timestamp> }
 *
 * 3. Or read document.title and strip visible text:
 *      const title = document.querySelector('meta[name="x-aether-build"]')?.content;
 *      // Decode with decodeWatermark() from this module
 *
 * 4. Cross-reference customerId with your vendor records
 *    (provision-client.mjs generates a .vendor.json with each customer's UUID).
 *
 * The watermark survives:
 *   - Standard Vite/esbuild minification
 *   - Normal deployment (Cloudflare Pages)
 *   - DOM inspection
 *
 * The watermark does NOT survive:
 *   - Deliberate source code editing before re-deployment
 *   - Manual find-replace of the customer ID string
 *   (These require the attacker to already know the watermark exists)
 * ============================================================================
 */
