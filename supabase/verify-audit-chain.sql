WITH ordered AS (
  SELECT ae.*,
    lag(hash) OVER (PARTITION BY tenant_id ORDER BY occurred_at, id) AS expected_prev
  FROM public.audit_events ae
),
broken AS (
  SELECT id, tenant_id, prev_hash, expected_prev
  FROM ordered
  WHERE COALESCE(prev_hash, '') <> COALESCE(expected_prev, '')
     OR hash <> encode(digest(
       COALESCE(prev_hash, '') || jsonb_build_object(
         'id', id, 'tenant_id', tenant_id, 'actor_id', actor_id,
         'action', action, 'entity', entity, 'entity_id', entity_id,
         'before', before, 'after', after, 'occurred_at', occurred_at,
         'prev_hash', prev_hash
       )::text, 'sha256'), 'hex')
)
SELECT json_build_object(
  'breaks', COALESCE((SELECT json_agg(broken) FROM broken), '[]'::json),
  'rows_checked', (SELECT count(*) FROM ordered)
)::text;
