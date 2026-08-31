#!/usr/bin/env bash
source "$(dirname "$0")/_lib.sh"
stage_init p09b "RLS Overhead"
require_cmd psql "PostgreSQL client"
require_env AUDIT_DATABASE_URL "staging database connection string (never production)"
out="$ARTIFACT_DIR/p09b-rls-overhead.txt"
psql "$AUDIT_DATABASE_URL" -A -F, -c "select c.relname, count(p.polname) as policies from pg_class c left join pg_policy p on p.polrelid=c.oid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' group by 1 order by 2 desc" > "$out" 2>&1 || not_verified "could not query the staging database"
artifact "artifacts/p09b-rls-overhead.txt"
unprotected=$(awk -F, 'NR>1 && $2==0 {c++} END{print c+0}' "$out")
metric tablesWithoutPolicies "$unprotected"
[ "$unprotected" -eq 0 ] && emit PASS || { blocker "$unprotected public table(s) have no RLS policy"; emit FAIL; }
