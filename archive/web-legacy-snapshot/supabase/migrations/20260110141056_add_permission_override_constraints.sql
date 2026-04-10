-- Add constraints to user_permission_overrides for data integrity

-- 1. Add uniqueness constraint (prevents duplicates, makes "newest wins" precedence unnecessary)
-- Note: Existing table already has unique(user_id, permission_id, scope, scope_id)
-- This adds a partial unique index that respects soft deletes
CREATE UNIQUE INDEX IF NOT EXISTS user_permission_overrides_unique_active
ON public.user_permission_overrides (user_id, scope, scope_id, permission_id)
WHERE deleted_at IS NULL;

COMMENT ON INDEX user_permission_overrides_unique_active
IS 'Prevents duplicate active overrides for same user+scope+permission. Soft-deleted rows are excluded.';

-- 2. Enforce global scope has NULL scope_id
ALTER TABLE public.user_permission_overrides
DROP CONSTRAINT IF EXISTS user_permission_overrides_global_scope_id_null;

ALTER TABLE public.user_permission_overrides
ADD CONSTRAINT user_permission_overrides_global_scope_id_null
CHECK (
  (scope = 'global' AND scope_id IS NULL)
  OR (scope <> 'global' AND scope_id IS NOT NULL)
);

COMMENT ON CONSTRAINT user_permission_overrides_global_scope_id_null
ON public.user_permission_overrides
IS 'Enforces that global scope must have NULL scope_id, and org/branch scopes must have non-NULL scope_id.';
