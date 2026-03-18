-- ============================================================
-- TARGET Phase 1 — Batch 1 / File 1
-- Extensions & Utilities
-- ============================================================
-- Purpose      : Enable required extensions and create the generic
--                set_updated_at() trigger function used by Phase 1+ tables.
-- Dependencies : none
-- Applied to   : TARGET project only (rjeraydumwechpjjzrus)
-- DO NOT apply to LEGACY project (zlcnlalwfmmtusigeuyk)
-- ============================================================

-- ============================================================
-- Extensions
-- uuid-ossp and pgcrypto are enabled by default in Supabase.
-- These are idempotent no-ops if already active.
-- ============================================================
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ============================================================
-- set_updated_at()
-- Generic BEFORE UPDATE trigger function.
-- Sets updated_at = current UTC timestamp on every row update.
-- Applied to: organization_members (File 4), user_preferences (File 5),
-- and additional tables in Batch 2+ (invitations, etc.).
--
-- Note: LEGACY does not have this function — updated_at is maintained
-- manually in queries. TARGET introduces it as a clean utility.
-- ============================================================
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

-- ============================================================
-- supabase_auth_admin — schema access
--
-- supabase_auth_admin is NOT a superuser and has no BYPASSRLS.
-- Supabase grants USAGE on the public schema to this role by
-- default, but it is declared here explicitly for auditability.
--
-- This is the only grant needed in Batch 1. Both auth hook
-- functions (handle_user_signup_hook, custom_access_token_hook)
-- are SECURITY DEFINER owned by postgres (superuser). The caller
-- role (supabase_auth_admin) needs only:
--   1. USAGE on the schema         — to resolve function names
--   2. EXECUTE on each function    — to invoke them
--
-- The EXECUTE grants are added in Batch 2 when the functions are
-- created. Table-level grants to supabase_auth_admin are NOT
-- required because SECURITY DEFINER functions run as their
-- definer (postgres), not as the caller.
-- ============================================================
grant usage on schema public to supabase_auth_admin;
