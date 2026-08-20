/**
 * Shared plumbing for the public licence endpoints.
 *
 * The important rule lives here: `originHost` and `ip` are derived from request
 * headers, never from the JSON body (§4.2). A client that could declare its own
 * origin could declare anything, which makes allowed-origin checks worthless.
 */
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "POST,OPTIONS",
    },
  });
}

export function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null
  );
}

/** Origin header first (set by the browser, not scriptable), then Host. */
export function serverDerivedOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host.toLowerCase();
    } catch {
      /* fall through to Host */
    }
  }
  const host = request.headers.get("host") ?? request.headers.get("x-forwarded-host");
  return host ? host.toLowerCase() : null;
}
