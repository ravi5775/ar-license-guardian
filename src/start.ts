import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Strict security headers applied to every customer and admin route.
// CSP permits only the runtime dependencies the app actually loads:
// Supabase (auth, data, realtime, storage), Cloudflare R2 assets,
// Google Fonts, MindAR + A-Frame CDNs, Sentry, and camera/blob media.
const CSP = [
  "default-src 'self'",
  // 'unsafe-inline' + 'unsafe-eval' are required by TanStack Start's
  // hydration script and A-Frame's component system respectively.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://aframe.io https://*.sentry.io https://browser.sentry-cdn.com",
  "script-src-elem 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://aframe.io https://*.sentry.io https://browser.sentry-cdn.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://*.supabase.co https://*.r2.dev",
  "media-src 'self' blob: data: https://*.supabase.co https://*.r2.dev",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.r2.dev https://cdn.jsdelivr.net https://aframe.io https://*.sentry.io https://*.ingest.sentry.io",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-XSS-Protection": "0",
  "Cross-Origin-Opener-Policy": "same-origin",
  // camera=self is required so the AR viewer can call getUserMedia.
  "Permissions-Policy":
    "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(self), accelerometer=(self)",
};

const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const response = await next();
  if (response instanceof Response) {
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      if (!response.headers.has(key)) response.headers.set(key, value);
    }
  }
  return response;
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [securityHeadersMiddleware, errorMiddleware],
}));
