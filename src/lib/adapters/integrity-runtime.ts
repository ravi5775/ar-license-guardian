/**
 * Build integrity — the client re-hashes its own loaded chunks and reports the
 * digest. The verdict is always server-side: a tampered client can lie, but it
 * cannot forge a digest that matches the manifest CI signed for that build.
 */
const BUILD_ID = (import.meta.env as Record<string, string | undefined>)["VITE_BUILD_ID"];

async function digestOf(urls: string[]) {
  const chunks: string[] = [];
  for (const url of urls.sort()) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (!res.ok) continue;
      const buf = await res.arrayBuffer();
      const hash = await crypto.subtle.digest("SHA-256", buf);
      chunks.push(
        `${new URL(url, location.href).pathname}:${Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")}`,
      );
    } catch {
      /* unreachable chunk — digest simply won't match, which is the signal */
    }
  }
  const combined = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(chunks.join("\n")),
  );
  return Array.from(new Uint8Array(combined))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadedScriptUrls() {
  return Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"))
    .map((s) => s.src)
    .filter((src) => new URL(src, location.href).origin === location.origin);
}

export async function buildAttestation(): Promise<{ buildId?: string; assetDigest?: string }> {
  if (!BUILD_ID || typeof document === "undefined") return {};
  try {
    return { buildId: BUILD_ID, assetDigest: await digestOf(loadedScriptUrls()) };
  } catch {
    return { buildId: BUILD_ID };
  }
}
