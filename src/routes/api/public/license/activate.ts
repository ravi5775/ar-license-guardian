/**
 * DEPRECATED — This endpoint has been permanently removed.
 *
 * The legacy /api/public/license/activate path used fingerprint-only
 * activation with no attestation, no device secrets, and no Ed25519 tokens.
 * It was replaced by /api/public/licence/activate (note: "licence") which
 * provides the full security model (§4.1–§4.8).
 *
 * All clients must migrate to the new endpoint. This tombstone returns
 * 410 Gone so existing clients get a machine-readable signal to upgrade
 * instead of a confusing 404 or silent misbehaviour.
 */
import { createFileRoute } from "@tanstack/react-router";

function gone() {
  return new Response(
    JSON.stringify({
      ok: false,
      error: "ENDPOINT_REMOVED",
      message:
        "This activation endpoint has been permanently removed. " +
        "Use /api/public/licence/activate instead.",
      migration: "/api/public/licence/activate",
    }),
    {
      status: 410,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    },
  );
}

export const Route = createFileRoute("/api/public/license/activate")({
  server: {
    handlers: {
      GET: async () => gone(),
      POST: async () => gone(),
      OPTIONS: async () => gone(),
    },
  },
});
