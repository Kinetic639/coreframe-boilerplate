-- =============================================
-- Migration: User Preferences V2
-- Purpose: Expand user_preferences table for full profile management
--          Add audit table for compliance
--          Enable cross-browser/cross-device UI settings persistence
-- Created: 2026-02-01
-- =============================================

-- =============================================
-- PART 1: SCHEMA EXPANSION
-- =============================================

-- Add new columns to user_preferences table
-- Using DO block for idempotency
DO $$
BEGIN
  -- Profile fields
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN display_name TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN phone TEXT;
  END IF;

  -- Regional settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'timezone'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN timezone TEXT DEFAULT 'UTC';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'date_format'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN date_format TEXT DEFAULT 'YYYY-MM-DD';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'time_format'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN time_format TEXT DEFAULT '24h';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'locale'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN locale TEXT DEFAULT 'pl';
  END IF;

  -- JSONB settings columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN notification_settings JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'dashboard_settings'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN dashboard_settings JSONB DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'module_settings'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN module_settings JSONB DEFAULT '{}';
  END IF;

  -- Audit tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_preferences'
    AND column_name = 'updated_by'
  ) THEN
    ALTER TABLE public.user_preferences ADD COLUMN updated_by UUID;
  END IF;
END
$$;

-- Add foreign key for updated_by if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preferences_updated_by_fkey'
  ) THEN
    ALTER TABLE public.user_preferences
    ADD CONSTRAINT user_preferences_updated_by_fkey
    FOREIGN KEY (updated_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL;
  END IF;
END
$$;

-- Add index on updated_at for efficient sync queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_updated_at
ON public.user_preferences(updated_at DESC NULLS LAST);

-- Add GIN index on dashboard_settings for JSONB queries
CREATE INDEX IF NOT EXISTS idx_user_preferences_dashboard_settings
ON public.user_preferences USING GIN (dashboard_settings);

-- =============================================
-- PART 2: AUDIT TABLE
-- =============================================

-- Create audit table for tracking preference changes
CREATE TABLE IF NOT EXISTS public.user_preference_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  changed_by UUID NOT NULL,
  change_type TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign keys for audit table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preference_audit_user_id_fkey'
  ) THEN
    ALTER TABLE public.user_preference_audit
    ADD CONSTRAINT user_preference_audit_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.users(id)
    ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_preference_audit_changed_by_fkey'
  ) THEN
    ALTER TABLE public.user_preference_audit
    ADD CONSTRAINT user_preference_audit_changed_by_fkey
    FOREIGN KEY (changed_by)
    REFERENCES public.users(id)
    ON DELETE SET NULL;
  END IF;
END
$$;

-- Add indexes for audit table
CREATE INDEX IF NOT EXISTS idx_user_preference_audit_user_id
ON public.user_preference_audit(user_id);

CREATE INDEX IF NOT EXISTS idx_user_preference_audit_created_at
ON public.user_preference_audit(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_preference_audit_change_type
ON public.user_preference_audit(change_type);

-- =============================================
-- PART 3: RLS POLICIES FOR user_preferences
-- =============================================

-- Enable RLS on user_preferences if not already enabled
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them (idempotent)
DROP POLICY IF EXISTS user_preferences_select_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_insert_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_update_own ON public.user_preferences;
DROP POLICY IF EXISTS user_preferences_delete_own ON public.user_preferences;

-- Policy: Users can read their own preferences
CREATE POLICY user_preferences_select_own ON public.user_preferences
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own preferences (first login initialization)
CREATE POLICY user_preferences_insert_own ON public.user_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own preferences
CREATE POLICY user_preferences_update_own ON public.user_preferences
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can soft delete their own preferences
CREATE POLICY user_preferences_delete_own ON public.user_preferences
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- PART 4: RLS POLICIES FOR user_preference_audit
-- =============================================

-- Enable RLS on audit table
ALTER TABLE public.user_preference_audit ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them (idempotent)
DROP POLICY IF EXISTS audit_insert_authenticated ON public.user_preference_audit;
DROP POLICY IF EXISTS audit_select_own ON public.user_preference_audit;

-- Policy: Authenticated users can insert audit records (for their own changes)
-- This allows the trigger/service to create audit entries
CREATE POLICY audit_insert_authenticated ON public.user_preference_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- Policy: Users can read their own audit trail
CREATE POLICY audit_select_own ON public.user_preference_audit
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- =============================================
-- PART 5: AUDIT TRIGGER FUNCTION
-- =============================================

-- Create or replace the audit trigger function
CREATE OR REPLACE FUNCTION public.user_preferences_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_old_values JSONB;
  v_new_values JSONB;
  v_change_type TEXT;
BEGIN
  -- Determine change type
  IF TG_OP = 'INSERT' THEN
    v_change_type := 'create';
    v_old_values := NULL;
    v_new_values := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_change_type := 'update';
    -- Only capture changed fields to reduce storage
    v_old_values := jsonb_build_object(
      'display_name', OLD.display_name,
      'phone', OLD.phone,
      'timezone', OLD.timezone,
      'date_format', OLD.date_format,
      'time_format', OLD.time_format,
      'locale', OLD.locale,
      'notification_settings', OLD.notification_settings,
      'dashboard_settings', OLD.dashboard_settings,
      'module_settings', OLD.module_settings,
      'organization_id', OLD.organization_id,
      'default_branch_id', OLD.default_branch_id,
      'updated_at', OLD.updated_at
    );
    v_new_values := jsonb_build_object(
      'display_name', NEW.display_name,
      'phone', NEW.phone,
      'timezone', NEW.timezone,
      'date_format', NEW.date_format,
      'time_format', NEW.time_format,
      'locale', NEW.locale,
      'notification_settings', NEW.notification_settings,
      'dashboard_settings', NEW.dashboard_settings,
      'module_settings', NEW.module_settings,
      'organization_id', NEW.organization_id,
      'default_branch_id', NEW.default_branch_id,
      'updated_at', NEW.updated_at
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_change_type := 'delete';
    v_old_values := to_jsonb(OLD);
    v_new_values := NULL;
  END IF;

  -- Insert audit record
  -- Note: This runs with the user's auth context
  INSERT INTO public.user_preference_audit (
    user_id,
    changed_by,
    change_type,
    old_values,
    new_values
  ) VALUES (
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.updated_by, auth.uid()),
    v_change_type,
    v_old_values,
    v_new_values
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS user_preferences_audit_trigger ON public.user_preferences;

-- Create the audit trigger
CREATE TRIGGER user_preferences_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.user_preferences_audit_trigger();

-- =============================================
-- PART 6: HELPER FUNCTION FOR JSONB MERGE
-- =============================================

-- Function to deep merge JSONB objects (useful for partial updates)
CREATE OR REPLACE FUNCTION public.jsonb_deep_merge(target JSONB, source JSONB)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT COALESCE(
      jsonb_object_agg(
        key,
        CASE
          WHEN jsonb_typeof(target_value) = 'object'
            AND jsonb_typeof(source_value) = 'object'
          THEN public.jsonb_deep_merge(target_value, source_value)
          ELSE COALESCE(source_value, target_value)
        END
      ),
      '{}'::jsonb
    )
    FROM (
      SELECT key, target_value, source_value
      FROM jsonb_each(COALESCE(target, '{}'::jsonb)) AS t(key, target_value)
      FULL OUTER JOIN jsonb_each(COALESCE(source, '{}'::jsonb)) AS s(key, source_value) USING (key)
    ) merged
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================
-- PART 7: COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.user_preference_audit IS
  'Audit trail for user preference changes. Tracks who changed what and when.';

COMMENT ON COLUMN public.user_preferences.display_name IS
  'User-chosen display name, separate from auth.users.raw_user_meta_data';

COMMENT ON COLUMN public.user_preferences.dashboard_settings IS
  'JSONB containing UI state, widget layout, and filter preferences. Synced across devices.';

COMMENT ON COLUMN public.user_preferences.notification_settings IS
  'JSONB containing email, push, and in-app notification preferences.';

COMMENT ON COLUMN public.user_preferences.module_settings IS
  'JSONB containing per-module settings like default views and sort orders.';

COMMENT ON FUNCTION public.jsonb_deep_merge(JSONB, JSONB) IS
  'Recursively merges two JSONB objects. Source values override target values.';
