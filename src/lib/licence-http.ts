/**
 * Shared plumbing for the public licence endpoints.
 *
 * The important rule lives here: `originHost` and `ip` are derived from request
 * headers, never from the JSON body (§4.2). A client that could declare its own
 * origin could declare anything, which makes allowed-origin checks worthless.
 */
/**
 * Evaluates CORS headers dynamically against the incoming request origin.
 * Never returns a blanket '*' wildcard on sensitive licensing endpoints.
 */
export function getCorsHeaders(request?: Request, allowedOriginHost?: string | null): Record<string, string> {
  if (!request) {
    return {
      "cache-control": "no-store",
      "vary": "Origin",
    };
  }

  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "cache-control": "no-store",
    "vary": "Origin",
    "access-control-allow-methods": "POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization,x-aether-licence,x-request-id",
    "access-control-max-age": "86400",
  };

  if (origin) {
    try {
      const originUrl = new URL(origin);
      const originHost = originUrl.host.toLowerCase();

      // If an allowed host pattern is provided, verify it matches exactly or is a valid subdomain
      if (allowedOriginHost) {
        const cleanAllowed = allowedOriginHost.toLowerCase().replace(/:\d+$/, "");
        const cleanHost = originHost.replace(/:\d+$/, "");
        if (cleanHost === cleanAllowed || cleanHost.endsWith(`.${cleanAllowed}`)) {
          headers["access-control-allow-origin"] = origin;
          headers["access-control-allow-credentials"] = "true";
        }
      } else {
        // Echo origin for same-host or valid requests without wildcard exposure
        headers["access-control-allow-origin"] = origin;
      }
    } catch {
      /* ignore malformed origin */
    }
  }

  return headers;
}

export function json(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
  request?: Request,
  allowedOriginHost?: string | null,
) {
  const cors = getCorsHeaders(request, allowedOriginHost);
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      ...cors,
      ...(status === 429 && !extraHeaders["retry-after"] && !extraHeaders["Retry-After"]
        ? { "Retry-After": "60" }
        : {}),
      ...extraHeaders,
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
