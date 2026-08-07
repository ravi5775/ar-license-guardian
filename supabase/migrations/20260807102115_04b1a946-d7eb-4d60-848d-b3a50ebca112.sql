-- Revoke direct API access to privileged SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.check_and_record_hit(text, text, integer, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_media_nonce(text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.generate_content_pin(integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.issue_content_access_token(text, uuid, integer, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_content_access_tokens(text, uuid) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.set_content_pin(text, uuid, text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_content_pin(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.verify_content_access_token(text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_attempts_allowed(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_record_failure(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.pin_clear_failures(text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_self_approval() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_apply_approval() FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.storage_usage(uuid) FROM anon;

-- Trusted server-side callers keep access.
GRANT EXECUTE ON FUNCTION public.check_and_record_hit(text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_media_nonce(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_content_pin(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_content_access_token(text, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_content_access_tokens(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_content_pin(text, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_content_pin(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_content_access_token(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_attempts_allowed(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_record_failure(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.pin_clear_failures(text, text) TO service_role;

-- App-required helpers stay callable by signed-in users (RLS policies + dashboard).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.storage_usage(uuid) TO authenticated, service_role;