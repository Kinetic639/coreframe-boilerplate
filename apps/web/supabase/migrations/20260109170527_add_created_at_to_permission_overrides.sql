-- Add created_at column to user_permission_overrides for deterministic override precedence
-- This column is required for the "newest wins" tiebreaker when multiple overrides exist for the same permission+scope

-- Add created_at column with default to now()
ALTER TABLE public.user_permission_overrides
ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Add comment explaining the column's purpose
COMMENT ON COLUMN public.user_permission_overrides.created_at
IS 'Timestamp when override was created. Used for deterministic precedence: for same scope+slug, newest created_at wins.';

-- Add index for performance (often sorted/filtered by created_at)
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_created_at
ON public.user_permission_overrides(created_at DESC);

-- Also add updated_at for audit trail (optional but recommended)
ALTER TABLE public.user_permission_overrides
ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_user_permission_overrides_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS trigger_user_permission_overrides_updated_at
ON public.user_permission_overrides;

CREATE TRIGGER trigger_user_permission_overrides_updated_at
BEFORE UPDATE ON public.user_permission_overrides
FOR EACH ROW
EXECUTE FUNCTION update_user_permission_overrides_updated_at();

COMMENT ON COLUMN public.user_permission_overrides.updated_at
IS 'Timestamp when override was last updated. Auto-updated via trigger.';
