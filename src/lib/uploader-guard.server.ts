/**
 * Upload authorisation helpers.
 *
 * Every client-facing upload goes through a service-role signed upload URL, so
 * the private `ar-media` bucket needs no per-user storage.objects policy. The
 * ownership boundary lives here instead:
 *
 *  - admins may upload anywhere in the bucket;
 *  - approved editors may only upload inside their own `u/<user_id>/` prefix.
 *
 * Paths are namespaced server-side, so a client can never choose someone
 * else's folder, and `enforceMediaSize` re-checks the prefix before it records
 * the object or deletes it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type Uploader = { userId: string; isAdmin: boolean };

/** Throws unless the caller is an admin, or an approved editor. */
export async function authorizeUploader(
  supabase: SupabaseClient<any, any, any>,
  userId: string,
): Promise<Uploader> {
  const [{ data: roles }, { data: profile }] = await Promise.all([
    supabase.from("user_roles").select("role").eq("user_id", userId),
    supabase.from("profiles").select("approval_status").eq("id", userId).maybeSingle(),
  ]);

  const list = (roles ?? []) as Array<{ role: string }>;
  const isAdmin = list.some((r) => r.role === "admin");
  if (isAdmin) return { userId, isAdmin: true };

  const isEditor = list.some((r) => r.role === "editor");
  const approved = (profile as { approval_status?: string } | null)?.approval_status === "approved";

  if (!isEditor || !approved) {
    throw new Error(
      "Your account isn't approved for uploads yet. Ask an administrator to approve it.",
    );
  }
  return { userId, isAdmin: false };
}

const SAFE_SEGMENT = /^[A-Za-z0-9._-]+$/;

/**
 * Rewrites a client-supplied path into the caller's own namespace and strips
 * traversal attempts. Admins keep their existing flat paths for backwards
 * compatibility with content uploaded before namespacing.
 */
export function scopeUploadPath(uploader: Uploader, requested: string): string {
  const segments = requested
    .split("/")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== "." && s !== "..");

  if (segments.length === 0 || !segments.every((s) => SAFE_SEGMENT.test(s))) {
    throw new Error("Invalid upload path");
  }

  // Never let a caller address another user's namespace.
  if (segments[0] === "u") segments.splice(0, 2);
  const clean = segments.join("/");
  if (!clean) throw new Error("Invalid upload path");

  return uploader.isAdmin ? clean : `u/${uploader.userId}/${clean}`;
}

/** True when this caller is allowed to act on an already-stored object path. */
export function ownsUploadPath(uploader: Uploader, path: string): boolean {
  return uploader.isAdmin || path.startsWith(`u/${uploader.userId}/`);
}
