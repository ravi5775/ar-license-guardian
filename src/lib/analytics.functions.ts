import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EventInput = z.object({
  album_id: z.string().uuid(),
  experience_id: z.string().uuid().optional().nullable(),
  target_index: z.number().int().min(0).max(100).optional().nullable(),
  event_type: z.enum([
    "album_open",
    "target_found",
    "playback_start",
    "playback_complete",
    "recognition_timeout",
  ]),
  session_id: z.string().min(6).max(64),
  duration_ms: z
    .number()
    .int()
    .min(0)
    .max(6 * 60 * 60 * 1000)
    .optional()
    .nullable(),
});

/**
 * Public, unauthenticated telemetry from the album viewer.
 *
 * Being public, it is abuse-hardened three ways:
 *  1. per-IP and per-session sliding-window rate limits (fail-closed),
 *  2. the album must actually exist and be published — no writing rows for
 *     invented UUIDs, which would let anyone inflate the table,
 *  3. the experience, when supplied, must belong to that album.
 * A rejected event is silently dropped: telemetry must never surface errors
 * to a viewer mid-scan.
 */
export const logScanEvent = createServerFn({ method: "POST" })
  .validator((raw) => EventInput.parse(raw))
  .handler(async ({ data }) => {
    const { check } = await import("@/lib/adapters/ratelimit.server");
    const { callerIp } = await import("@/lib/content-access.server");
    const ip = callerIp();

    // 120 events / 5 min per IP, 60 / 5 min per viewer session.
    const [byIp, bySession] = await Promise.all([
      check(`scan:ip:${ip}`, 120, 300),
      check(`scan:sid:${data.session_id}`, 60, 300),
    ]);
    if (!byIp.allowed || !bySession.allowed) return { ok: false as const };

    const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        storage: undefined,
      },
    });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: album } = await supabaseAdmin
      .from("albums")
      .select("id")
      .eq("id", data.album_id)
      .eq("published", true)
      .maybeSingle();
    if (!album) return { ok: false as const };

    let experienceId: string | null = null;
    if (data.experience_id) {
      const { data: exp } = await supabaseAdmin
        .from("ar_experiences")
        .select("id")
        .eq("id", data.experience_id)
        .eq("album_id", data.album_id)
        .maybeSingle();
      experienceId = exp?.id ?? null;
    }

    await sb.from("scan_events").insert({
      album_id: data.album_id,
      experience_id: experienceId,
      target_index: data.target_index ?? null,
      event_type: data.event_type,
      session_id: data.session_id,
      duration_ms: data.duration_ms ?? null,
    });
    return { ok: true as const };
  });

export type PhotoStat = {
  target_index: number;
  title: string;
  found: number;
  starts: number;
  completes: number;
  completion_rate: number;
  avg_detect_ms: number | null;
};

export const getAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .validator((raw) =>
    z.object({ days: z.number().int().min(1).max(365).default(30) }).parse(raw ?? {}),
  )
  .handler(async ({ data, context }) => {
    const since = new Date(Date.now() - data.days * 24 * 60 * 60 * 1000).toISOString();

    const { data: albums, error: aErr } = await context.supabase
      .from("albums")
      .select("id, title, slug, target_count");
    if (aErr) throw new Error(aErr.message);

    const { data: exps } = await context.supabase
      .from("ar_experiences")
      .select("id, title, album_id, target_index");

    const { data: events, error: eErr } = await context.supabase
      .from("scan_events")
      .select("album_id, target_index, event_type, session_id, duration_ms, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20000);
    if (eErr) throw new Error(eErr.message);

    const rows = events ?? [];

    const perAlbum = (albums ?? []).map((album) => {
      const ev = rows.filter((e) => e.album_id === album.id);
      const opens = new Set(
        ev.filter((e) => e.event_type === "album_open").map((e) => e.session_id),
      ).size;
      const identifiedSessions = new Set(
        ev.filter((e) => e.event_type === "target_found").map((e) => e.session_id),
      ).size;
      const timeouts = ev.filter((e) => e.event_type === "recognition_timeout").length;

      const photos: PhotoStat[] = (exps ?? [])
        .filter((x) => x.album_id === album.id)
        .sort((a, b) => (a.target_index ?? 0) - (b.target_index ?? 0))
        .map((x) => {
          const idx = x.target_index ?? 0;
          const pe = ev.filter((e) => e.target_index === idx);
          const found = pe.filter((e) => e.event_type === "target_found");
          const starts = pe.filter((e) => e.event_type === "playback_start").length;
          const completes = pe.filter((e) => e.event_type === "playback_complete").length;
          const detects = found
            .map((e) => e.duration_ms)
            .filter((n): n is number => typeof n === "number");
          return {
            target_index: idx,
            title: x.title,
            found: found.length,
            starts,
            completes,
            completion_rate: starts ? Math.round((completes / starts) * 100) : 0,
            avg_detect_ms: detects.length
              ? Math.round(detects.reduce((a, b) => a + b, 0) / detects.length)
              : null,
          };
        });

      return {
        id: album.id,
        title: album.title,
        slug: album.slug,
        scans: opens,
        identified_sessions: identifiedSessions,
        identification_rate: opens ? Math.round((identifiedSessions / opens) * 100) : 0,
        timeouts,
        photos,
      };
    });

    return {
      days: data.days,
      totals: {
        scans: perAlbum.reduce((a, b) => a + b.scans, 0),
        identified: perAlbum.reduce((a, b) => a + b.identified_sessions, 0),
        timeouts: perAlbum.reduce((a, b) => a + b.timeouts, 0),
        plays: rows.filter((e) => e.event_type === "playback_start").length,
        completions: rows.filter((e) => e.event_type === "playback_complete").length,
      },
      albums: perAlbum,
    };
  });
