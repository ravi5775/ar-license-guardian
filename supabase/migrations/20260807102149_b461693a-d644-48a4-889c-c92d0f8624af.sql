REVOKE ALL ON FUNCTION public.generate_content_pin(integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_content_access_token(text, uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_content_access_tokens(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_content_pin(text, uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_content_pin(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_content_access_token(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_approved(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storage_usage(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.generate_content_pin(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.issue_content_access_token(text, uuid, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.revoke_content_access_tokens(text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_content_pin(text, uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_content_pin(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_content_access_token(text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_approved(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.storage_usage(uuid) TO authenticated, service_role;