-- =============================================
-- Migration: Grant supabase_auth_admin access to all public tables
-- =============================================

-- Grant SELECT, INSERT, UPDATE, DELETE on all tables in the public schema to supabase_auth_admin
-- This is often needed for custom auth hooks or functions run by this role to access application data.
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO supabase_auth_admin;

-- Optional: Grant access on sequences for insert operations that use sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;
