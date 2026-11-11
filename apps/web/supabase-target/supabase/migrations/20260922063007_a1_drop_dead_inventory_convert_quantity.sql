-- A1 SIMPLIFICATION -- remove confirmed-dead code.
-- inventory_convert_quantity(uuid,uuid,uuid,uuid,numeric): live-verified
-- zero SQL callers (prosrc cross-search across all of pg_proc) and zero
-- TS callers (repo grep across apps/web and apps/public-web, excluding
-- generated type declarations and one migration-content test assertion
-- which are not invocations). Its security exposure (anon/PUBLIC EXECUTE
-- on a function with no body-level permission check) was already closed
-- by the IC-7 closing pass's own grant hardening
-- (20260919093709_ic7_closing_grant_hardening_valuation_and_sensitive_
-- reads.sql); only the code-removal decision remained, deferred to this
-- pass by the architecture compression review's own simplification-plan
-- item A1.

DROP FUNCTION IF EXISTS public.inventory_convert_quantity(uuid, uuid, uuid, uuid, numeric);
