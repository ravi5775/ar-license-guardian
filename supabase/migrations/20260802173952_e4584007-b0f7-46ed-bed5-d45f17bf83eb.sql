-- Column-level lockdown: anon may never read PIN secrets.
REVOKE SELECT ON public.albums FROM anon;
GRANT SELECT (
  id, slug, title, owner_id, compiled_mind_path, compiled_mind_url,
  target_count, published, created_at, updated_at, access_mode,
  show_in_gallery, pin_updated_at
) ON public.albums TO anon;

REVOKE SELECT ON public.ar_experiences FROM anon;
GRANT SELECT (
  id, owner_id, slug, title, description, cover_image_url, marker_url,
  media_url, media_type, autoplay, loop_playback, published, view_count,
  created_at, updated_at, marker_path, marker_mind_path, media_path,
  album_id, target_index, access_mode, show_in_gallery, pin_updated_at
) ON public.ar_experiences TO anon;