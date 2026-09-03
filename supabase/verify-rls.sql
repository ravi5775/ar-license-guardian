WITH rls_disabled AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('table', c.relname)), '[]'::jsonb) AS rows
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity
),
tables_without_policies AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object('table', t.tablename)), '[]'::jsonb) AS rows
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = t.schemaname AND p.tablename = t.tablename
    )
),
grants AS (
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'table', table_name,
    'grantee', grantee,
    'privilege', privilege_type
  ) ORDER BY table_name, grantee, privilege_type), '[]'::jsonb) AS rows
  FROM information_schema.role_table_grants
  WHERE table_schema = 'public'
)
SELECT jsonb_build_object(
  'rls_disabled', (SELECT rows FROM rls_disabled),
  'tables_without_policies', (SELECT rows FROM tables_without_policies),
  'grants', (SELECT rows FROM grants)
);
