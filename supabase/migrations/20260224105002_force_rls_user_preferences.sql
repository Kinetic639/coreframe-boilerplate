-- Apply FORCE ROW LEVEL SECURITY to PII tables in user-account module.
-- Both tables contain sensitive personal data (display_name, phone, ip_address, user_agent).
-- FORCE RLS ensures policies apply even when accessed by the table owner role.

ALTER TABLE public.user_preferences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_preference_audit FORCE ROW LEVEL SECURITY;
