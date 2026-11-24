#!/usr/bin/env bash
# Starts a throwaway local Supabase for the e2e suite, so the tests never touch
# the production project.
#
# 1. Dumps the production schema (DDL only: tables, functions, policies, no
#    rows) and a handful of reference tables (permissions, system roles,
#    plans, tool catalog, storage buckets). That is a few catalog queries
#    against production per run, instead of the thousands of API requests
#    the suite used to make there.
# 2. Starts Supabase in Docker with that schema as its only migration.
# 3. Seeds a test account with an organization, two branches and a product
#    (seed.sql).
# 4. Prints the env the app and the suite need (KEY=value lines), or appends
#    them to $GITHUB_ENV in GitHub Actions.
#
# The repo's own migrations are not used: they no longer rebuild production
# from scratch (part of the schema was applied outside the migration tree).
#
# Needs: the Supabase CLI, Docker, psql, curl, and SUPABASE_DB_URL, a
# connection string for production (Supabase Dashboard -> Connect -> Session
# pooler; GitHub runners have no IPv6, so not the direct db.* host).
#
# CLAUDE.md says never to run a local Supabase: that is about development,
# which works against the remote project. This stack lives only for one CI job.
set -euo pipefail

: "${SUPABASE_DB_URL:?SUPABASE_DB_URL is not set (production connection string, session pooler)}"

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
web="$(cd "$here/../.." && pwd)"
work="${E2E_SUPABASE_DIR:-${RUNNER_TEMP:-/tmp}/e2e-supabase}"
email="${E2E_TEST_EMAIL:-e2e@example.com}"
password="${E2E_TEST_PASSWORD:-e2e-$(openssl rand -hex 12)}"

rm -rf "$work"
mkdir -p "$work/supabase/migrations" "$work/data"

# Same settings as the real project (auth hook, no email confirmation), on
# Postgres 17 like production, without the services the app does not use here.
sed -e 's/^major_version = .*/major_version = 17/' \
  "$web/supabase-target/supabase/config.toml" > "$work/supabase/config.toml"

echo "::group::Dump the production schema"
supabase db dump --db-url "$SUPABASE_DB_URL" -f "$work/supabase/migrations/00000000000000_schema.sql"
echo "::endgroup::"

echo "::group::Copy the reference tables"
# target|query. Only rows that belong to no organization. Public tables come
# from the dump above, so their columns line up with production; the storage
# schema is the CLI's own, so the bucket columns are named.
reference=(
  "public.subscription_plans|select * from public.subscription_plans"
  "public.permissions|select * from public.permissions"
  "public.roles|select * from public.roles where organization_id is null"
  "public.role_permissions|select rp.* from public.role_permissions rp join public.roles r on r.id = rp.role_id where r.organization_id is null"
  "public.tools_catalog|select * from public.tools_catalog"
  "public.app_config|select * from public.app_config"
  "storage.buckets(id,name,public,file_size_limit,allowed_mime_types)|select id, name, public, file_size_limit, allowed_mime_types from storage.buckets"
)
for entry in "${reference[@]}"; do
  table="${entry%%|*}"
  file="$work/data/${table%%(*}.csv"
  query="${entry#*|}"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -qc "\\copy ($query) to '$file' with csv header"
  echo "${table%%(*}: $(($(wc -l < "$file") - 1)) rows"
done
echo "::endgroup::"

echo "::group::Start Supabase"
cd "$work"
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,supavisor,postgres-meta,mailpit
eval "$(supabase status -o env | sed -n -E 's/^(API_URL|DB_URL|ANON_KEY|SERVICE_ROLE_KEY)=/LOCAL_\1=/p')"
echo "::endgroup::"

echo "::group::Load reference data"
{
  for entry in "${reference[@]}"; do
    table="${entry%%|*}"
    echo "\\copy $table from '$work/data/${table%%(*}.csv' with csv header"
  done
} | psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -q
echo "::endgroup::"

echo "::group::Seed the test account"
user_id="$(
  curl -fsS "$LOCAL_API_URL/auth/v1/admin/users" \
    -H "apikey: $LOCAL_SERVICE_ROLE_KEY" \
    -H "Authorization: Bearer $LOCAL_SERVICE_ROLE_KEY" \
    -H "Content-Type: application/json" \
    --data "$(printf '{"email":"%s","password":"%s","email_confirm":true}' "$email" "$password")" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))'
)"
psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -q -v user_id="$user_id" -f "$here/seed.sql"
echo "::endgroup::"

env_lines=(
  "NEXT_PUBLIC_SUPABASE_URL=$LOCAL_API_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$LOCAL_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY=$LOCAL_SERVICE_ROLE_KEY"
  "E2E_TEST_EMAIL=$email"
  "E2E_TEST_PASSWORD=$password"
)
if [[ -n "${GITHUB_ENV:-}" ]]; then
  echo "::add-mask::$password"
  printf '%s\n' "${env_lines[@]}" >> "$GITHUB_ENV"
  echo "Local Supabase is up at $LOCAL_API_URL; env exported for the next steps."
else
  printf '%s\n' "${env_lines[@]}"
fi
