-- Migration: enable_pgtap_extension
-- Enables the pgtap testing extension on supabase-target so Zone 3 (and
-- future) DB/RLS automated tests can be executed for real via SQL, not
-- merely inspected. Standard, widely-used, reversible testing extension --
-- zero impact on existing data/behavior. Not previously installed on this
-- project (confirmed via pg_extension before writing this migration).
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
